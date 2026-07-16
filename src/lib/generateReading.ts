import { generateObject } from "ai";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { curriculumItems, profiles, readings, type Profile } from "@/db/schema";
import { MODEL } from "@/lib/ai/model";
import { fetchNltPassage, fetchKoreanPassage } from "@/lib/bible";
import { searchWorshipSongs, searchSermons } from "@/lib/youtube";
import { todayDateString } from "@/lib/date";

const readingSchema = z.object({
  theme: z.string().describe("A one-line theme for today's passage"),
  storySummary: z
    .string()
    .describe("A story-like, engaging summary of what happens in this passage and how it fits the whole Bible"),
  historicalContext: z
    .string()
    .describe("What comes before/after this passage and the historical background needed to understand it"),
  personalMessage: z
    .string()
    .describe("A reflective message on what God might be saying to the reader through this passage today"),
});

async function fetchPassageTexts(passageRef: string) {
  const [ko, en] = await Promise.all([
    fetchKoreanPassage(passageRef).catch(() => null),
    fetchNltPassage(passageRef).catch(() => null),
  ]);
  return { ko, en };
}

// Generates (or returns the already-generated) reading for a profile's current cursor position,
// for today's date. Idempotent per (profile, day) — safe to call repeatedly from /api/today.
export async function generateDailyReading(profile: Profile) {
  const forDate = todayDateString();

  const [existing] = await db
    .select()
    .from(readings)
    .where(sql`${readings.profileId} = ${profile.id} AND ${readings.forDate} = ${forDate}`)
    .limit(1);
  if (existing) return existing;

  const [total] = await db.select({ count: sql<number>`count(*)` }).from(curriculumItems);
  const curriculumLength = Number(total?.count ?? 0);
  if (curriculumLength === 0) throw new Error("curriculum_items is empty — seed it first");

  const position = profile.cursorPosition % curriculumLength;
  const [item] = await db
    .select()
    .from(curriculumItems)
    .where(eq(curriculumItems.orderIndex, position))
    .limit(1);
  if (!item) throw new Error(`No curriculum item at order_index ${position}`);

  const { ko, en } = await fetchPassageTexts(item.passageRef);

  const { object } = await generateObject({
    model: MODEL,
    schema: readingSchema,
    system:
      "You write short, engaging daily Bible reading companions for a personal QT-style app called Wordflow. " +
      "Tone: story-like, warm, never dry or academic. Write in Korean. Keep each field to about 3-5 sentences " +
      "(the whole thing should read aloud in roughly 5 minutes).",
    prompt: [
      `Today's passage: ${item.passageRef} (theme bucket: ${item.theme})`,
      ko ? `한글 새번역 본문:\n${ko}` : null,
      en ? `English NLT text:\n${en}` : null,
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  const [worshipLinks, sermonLinks] = await Promise.all([
    searchWorshipSongs(object.theme).catch(() => []),
    searchSermons(object.theme, item.passageRef).catch(() => []),
  ]);

  const [row] = await db
    .insert(readings)
    .values({
      profileId: profile.id,
      curriculumItemId: item.id,
      forDate,
      theme: object.theme,
      storySummary: object.storySummary,
      historicalContext: object.historicalContext,
      personalMessage: object.personalMessage,
      passageTextKo: ko,
      passageTextEn: en,
      worshipLinks,
      sermonLinks: sermonLinks.map((s) => ({ title: s.title, channel: s.channelTitle, url: s.url })),
    })
    .returning();

  await db
    .update(profiles)
    .set({ cursorPosition: (position + 1) % curriculumLength, lastReadDate: forDate })
    .where(eq(profiles.id, profile.id));

  return row;
}

export async function findOrCreateProfile(name: string): Promise<Profile> {
  const [existing] = await db.select().from(profiles).where(eq(profiles.name, name)).limit(1);
  if (existing) return existing;

  const [created] = await db.insert(profiles).values({ name }).returning();
  return created;
}

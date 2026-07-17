import { generateObject } from "ai";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { curriculumItems, profiles, readings, type Profile } from "@/db/schema";
import { MODEL } from "@/lib/ai/model";
import { fetchNltPassage } from "@/lib/bible";
import { searchWorshipSongs, searchSermons } from "@/lib/youtube";
import { todayDateString } from "@/lib/date";

const bilingualField = (description: string) =>
  z.object({
    ko: z.string().describe(`${description} (Korean)`),
    en: z.string().describe(`${description} (English)`),
  });

const readingSchema = z.object({
  theme: bilingualField("A one-line theme for today's passage"),
  storySummary: bilingualField(
    "A story-like, engaging summary of what happens in this passage and how it fits the whole Bible",
  ),
  historicalContext: bilingualField(
    "What comes before/after this passage and the historical background needed to understand it",
  ),
  personalMessage: bilingualField("A reflective message on what God might be saying to the reader today"),
});

const koreanPassageSchema = z.object({
  verses: z
    .string()
    .describe(
      "쉬운성경 스타일의 한글 본문, 절 번호를 (1), (2)... 형식으로 붙여 절별로 줄바꿈해 적은 버전",
    ),
  story: z
    .string()
    .describe("같은 본문을 절 구분 없이, 하나로 자연스럽게 이어지는 이야기체 문단으로 적은 버전"),
});

// No reliable Bible API exists for Korean 새번역 (API.Bible's key kept rejecting requests — see
// src/lib/bible.ts), so Claude renders the Korean text itself instead, grounded in the NLT
// English text so it isn't inventing the passage's content from scratch.
async function generateKoreanPassage(reference: string, englishText: string | null) {
  const { object } = await generateObject({
    model: MODEL,
    schema: koreanPassageSchema,
    system:
      "당신은 성경 본문을 쉬운 한글로 옮기는 번역가입니다. 원문의 사건과 의미를 정확히 지키되, " +
      "성경을 처음 읽는 사람도 이해할 수 있는 쉬운성경 스타일의 자연스러운 한글로 표현하세요. " +
      "새로운 내용을 지어내지 말고 주어진 영어 본문(NLT)의 내용에 충실하게 옮기세요.",
    prompt: [
      `본문: ${reference}`,
      englishText ? `영어 NLT 원문:\n${englishText}` : null,
    ]
      .filter(Boolean)
      .join("\n\n"),
  });
  return object;
}

async function fetchPassageTexts(passageRef: string) {
  const en = await fetchNltPassage(passageRef).catch(() => null);
  const ko = await generateKoreanPassage(passageRef, en).catch(() => null);
  return { koVerses: ko?.verses ?? null, koStory: ko?.story ?? null, en };
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
  if (existing) {
    const [existingItem] = await db
      .select()
      .from(curriculumItems)
      .where(eq(curriculumItems.id, existing.curriculumItemId))
      .limit(1);
    return { ...existing, passageRef: existingItem?.passageRef ?? null };
  }

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

  const { koVerses, koStory, en } = await fetchPassageTexts(item.passageRef);

  const { object } = await generateObject({
    model: MODEL,
    schema: readingSchema,
    system:
      "You write short, engaging daily Bible reading companions for a personal QT-style app called Wordflow. " +
      "Tone: story-like, warm, never dry or academic. Write every field in BOTH Korean and English — the two " +
      "should carry the same meaning, not be a literal translation of each other, each natural in its own " +
      "language. Keep each field to about 3-5 sentences (the whole thing should read aloud in roughly 5 minutes).",
    prompt: [
      `Today's passage: ${item.passageRef} (theme bucket: ${item.theme})`,
      koStory ? `한글 본문(이야기체):\n${koStory}` : null,
      en ? `English NLT text:\n${en}` : null,
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  const [worship, sermonLinks] = await Promise.all([
    searchWorshipSongs(object.theme.ko, object.theme.en).catch(() => ({ ko: null, en: null })),
    searchSermons(object.theme.ko, item.passageRef).catch(() => []),
  ]);
  const worshipLinks = [worship.ko, worship.en]
    .filter((w): w is NonNullable<typeof w> => w !== null)
    .map((w) => ({ title: w.title, url: w.url }));

  const [row] = await db
    .insert(readings)
    .values({
      profileId: profile.id,
      curriculumItemId: item.id,
      forDate,
      theme: object.theme.ko,
      storySummary: object.storySummary.ko,
      historicalContext: object.historicalContext.ko,
      personalMessage: object.personalMessage.ko,
      themeEn: object.theme.en,
      storySummaryEn: object.storySummary.en,
      historicalContextEn: object.historicalContext.en,
      personalMessageEn: object.personalMessage.en,
      passageTextKoVerses: koVerses,
      passageTextKoStory: koStory,
      passageTextEn: en,
      worshipLinks,
      sermonLinks: sermonLinks.map((s) => ({ title: s.title, channel: s.channelTitle, url: s.url })),
    })
    .returning();

  await db
    .update(profiles)
    .set({ cursorPosition: (position + 1) % curriculumLength, lastReadDate: forDate })
    .where(eq(profiles.id, profile.id));

  return { ...row, passageRef: item.passageRef };
}

export async function findOrCreateProfile(name: string): Promise<Profile> {
  const [existing] = await db.select().from(profiles).where(eq(profiles.name, name)).limit(1);
  if (existing) return existing;

  const [created] = await db.insert(profiles).values({ name }).returning();
  return created;
}

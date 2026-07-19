import { generateObject, generateText } from "ai";
import { after } from "next/server";
import { z } from "zod";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { curriculumItems, profiles, readings, type CurriculumItem, type Profile } from "@/db/schema";
import { MODEL } from "@/lib/ai/model";
import { fetchNltPassage } from "@/lib/bible";
import { searchWorshipSongs } from "@/lib/youtube";
import { todayDateString, pacificDateString } from "@/lib/date";
import { getActiveSeason } from "@/lib/season";

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
    .describe(
      "같은 본문을 절 구분 없이, 하나로 자연스럽게 이어지는 이야기체 문단으로 적은 버전. " +
        "verses 버전과 담긴 사건·대사·세부 내용의 양이 동일해야 하며, 절 번호와 줄바꿈만 제거하고 " +
        "자연스러운 문장으로 이어붙이는 것— 요약하거나 일부 절을 생략하면 안 됨.",
    ),
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
      "새로운 내용을 지어내지 말고 주어진 영어 본문(NLT)의 내용에 충실하게 옮기세요. " +
      "story 버전은 verses 버전을 요약한 것이 아닙니다 — 모든 절의 내용을 빠짐없이 담아 절 번호만 " +
      "빼고 이야기체 문장으로 자연스럽게 이어붙이세요.",
    prompt: [
      `본문: ${reference}`,
      englishText ? `영어 NLT 원문:\n${englishText}` : null,
    ]
      .filter(Boolean)
      .join("\n\n"),
  });
  return object;
}

// The NLT API text is already verse-numbered ("by verse"), so English only needs a story-mode
// counterpart generated — same idea as generateKoreanPassage's "story" field, just English to
// English: flow the same NLT wording into continuous prose with verse markers removed, no new
// content invented.
export async function generateEnglishStoryPassage(reference: string, englishVersesText: string): Promise<string | null> {
  const { text } = await generateText({
    model: MODEL,
    system:
      "You render Bible passages as smooth, continuous story-style prose in English. Preserve the given " +
      "NLT wording and meaning as closely as possible — don't add or omit content, just remove verse-number " +
      "markers and join the text into one natural flowing narrative with no verse breaks. Output only the " +
      "passage text, no preamble.",
    prompt: `Passage: ${reference}\n\nNLT text (verse-numbered):\n${englishVersesText}`,
  });
  return text.trim();
}

async function fetchPassageTexts(passageRef: string) {
  const en = await fetchNltPassage(passageRef).catch(() => null);
  const [ko, enStory] = await Promise.all([
    generateKoreanPassage(passageRef, en).catch(() => null),
    en ? generateEnglishStoryPassage(passageRef, en).catch(() => null) : Promise.resolve(null),
  ]);
  return { koVerses: ko?.verses ?? null, koStory: ko?.story ?? null, en, enStory };
}

// Generates and inserts a reading for a specific curriculum item — the shared content-generation
// step, with no opinion on cursor position. Optional createdAt lets a caller backdate a row so it
// sorts correctly among a profile's other readings for the day (used by catchUpReading below).
// `revealed = false` inserts it as a hidden prefetch buffer instead of an immediately-visible
// reading — see revealOrGenerate/ensurePrefetchedNext below.
async function buildReadingForItem(
  profile: Profile,
  forDate: string,
  item: CurriculumItem,
  createdAt?: Date,
  revealed = true,
) {
  const { koVerses, koStory, en, enStory } = await fetchPassageTexts(item.passageRef);

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

  const worship = await searchWorshipSongs(object.theme.ko, object.theme.en).catch(() => ({
    ko: null,
    en: null,
  }));

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
      passageTextEnStory: enStory,
      worshipLinkKo: worship.ko ? { title: worship.ko.title, url: worship.ko.url } : null,
      worshipLinkEn: worship.en ? { title: worship.en.title, url: worship.en.url } : null,
      revealed,
      ...(createdAt ? { createdAt } : {}),
    })
    .returning();

  return { ...row, passageRef: item.passageRef };
}

// Always generates a fresh reading at the profile's current cursor position and advances the
// cursor — the building block for both the idempotent daily path and the user-triggered
// "read next" action. forDate is which calendar date the row is stamped with; readings are no
// longer unique per (profile, date), so a profile can have several from the same day.
// `revealed = false` generates it as the hidden prefetch buffer (see ensurePrefetchedNext) — the
// cursor still advances immediately either way, since the buffered item is a real committed step
// through the curriculum, just not shown to the profile yet.
async function buildReading(profile: Profile, forDate: string, revealed = true) {
  // season IS NULL: season entries share this table (see schema.ts) but use a disjoint
  // orderIndex range and must never be counted into the normal rotation's length/position math.
  const [total] = await db
    .select({ count: sql<number>`count(*)` })
    .from(curriculumItems)
    .where(isNull(curriculumItems.season));
  const curriculumLength = Number(total?.count ?? 0);
  if (curriculumLength === 0) throw new Error("curriculum_items is empty — seed it first");

  const position = profile.cursorPosition % curriculumLength;
  const [item] = await db
    .select()
    .from(curriculumItems)
    .where(and(eq(curriculumItems.orderIndex, position), isNull(curriculumItems.season)))
    .limit(1);
  if (!item) throw new Error(`No curriculum item at order_index ${position}`);

  const nextPosition = (position + 1) % curriculumLength;
  // Wrapping back to 0 means this reading completed a full pass through the curriculum — start
  // a new cycle. The very first reading ever also starts a cycle (cycle 1), since
  // currentCycleStartedAt is otherwise still null at that point.
  const cycleJustCompleted = nextPosition === 0;
  const isFirstReadingEver = profile.lastReadDate === null;
  // Captured once and reused as both this reading's createdAt and the new
  // currentCycleStartedAt, so the reading that starts a cycle is never itself excluded from
  // "this cycle" scope — getReadingProgress filters readings with `createdAt >=
  // currentCycleStartedAt`, which would otherwise miss it by the few milliseconds between the
  // insert below and a separately-timestamped update.
  const cycleStartTimestamp = cycleJustCompleted || isFirstReadingEver ? new Date() : undefined;

  const result = await buildReadingForItem(profile, forDate, item, cycleStartTimestamp, revealed);

  await db
    .update(profiles)
    .set({
      cursorPosition: nextPosition,
      ...(cycleJustCompleted ? { cycleCount: profile.cycleCount + 1 } : {}),
      ...(cycleStartTimestamp ? { currentCycleStartedAt: cycleStartTimestamp } : {}),
      lastReadDate: forDate,
    })
    .where(eq(profiles.id, profile.id));

  return result;
}

// Reveals the profile's buffered next reading if one's ready — restamping it with today's date
// and flipping it visible — instead of generating on the spot, so "next passage" feels instant.
// Falls back to a normal synchronous buildReading() when nothing was buffered yet (the very
// first reading ever for this profile, or the background prefetch just hadn't finished in time).
async function revealOrGenerate(profile: Profile, forDate: string) {
  const [hidden] = await db
    .select()
    .from(readings)
    .where(and(eq(readings.profileId, profile.id), eq(readings.revealed, false)))
    .orderBy(readings.createdAt)
    .limit(1);

  if (hidden) {
    const [updated] = await db
      .update(readings)
      .set({ forDate, revealed: true })
      .where(eq(readings.id, hidden.id))
      .returning();
    const [item] = await db
      .select()
      .from(curriculumItems)
      .where(eq(curriculumItems.id, updated.curriculumItemId))
      .limit(1);
    return { ...updated, passageRef: item?.passageRef ?? null };
  }

  return buildReading(profile, forDate);
}

// Keeps exactly one not-yet-revealed reading buffered ahead of a profile's cursor, generating it
// in the background if missing — a no-op whenever one's already buffered. Wired up via
// next/server's after() at every call site that can trigger a reveal, so it runs post-response
// and never adds latency to the request that's actually waiting on a human. Re-reads the profile
// from the DB rather than trusting a possibly-stale in-memory copy, since a reveal or a
// synchronous buildReading() may have just advanced cursorPosition moments earlier in the same
// request. Deliberately just one item deep — this is a "make the very next step instant" cache,
// not a background job that keeps generating regardless of whether anyone's reading, which is
// exactly the behavior that used to let the curriculum silently drift ahead of a profile that
// hadn't opened the app in days.
async function ensurePrefetchedNext(profileId: number): Promise<void> {
  const [hidden] = await db
    .select({ id: readings.id })
    .from(readings)
    .where(and(eq(readings.profileId, profileId), eq(readings.revealed, false)))
    .limit(1);
  if (hidden) return;

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
  if (!profile) return;

  await buildReading(profile, todayDateString(), false).catch(() => {
    // best-effort — if this fails, the next reveal just falls back to synchronous generation
  });
}

// The FIRST reading of a calendar day (idempotent GET path only, never "read next"): if today
// falls in an active season window (Holy Week / Christmas / Thanksgiving — see src/lib/season.ts),
// serves that season's reading instead of the normal rotation, without touching the cursor at
// all. Because the cursor is untouched, any *subsequent* reading that day (via "read next", which
// always calls buildReading directly, bypassing this function) falls straight back to normal
// progress — that's the "regenerating during a season always catches up" behavior — and the
// cursor resumes exactly where it was once the season window closes.
async function buildFirstReadingOfDay(profile: Profile, forDate: string) {
  const activeSeason = getActiveSeason(pacificDateString());
  if (activeSeason) {
    const [seasonItem] = await db
      .select()
      .from(curriculumItems)
      .where(
        and(
          eq(curriculumItems.season, activeSeason.season),
          eq(curriculumItems.seasonDayIndex, activeSeason.dayIndex),
        ),
      )
      .limit(1);
    if (seasonItem) return buildReadingForItem(profile, forDate, seasonItem);
  }
  return revealOrGenerate(profile, forDate);
}

// Repair helper: generates a reading for a specific curriculum orderIndex without touching the
// profile's cursor. For backfilling a chapter whose generated content was lost (e.g. deleted by
// mistake) without re-walking or disturbing the profile's forward progress. createdAt lets the
// row be backdated so it sorts into its correct narrative position among that day's readings.
export async function catchUpReading(profile: Profile, orderIndex: number, forDate: string, createdAt?: Date) {
  const [item] = await db.select().from(curriculumItems).where(eq(curriculumItems.orderIndex, orderIndex)).limit(1);
  if (!item) throw new Error(`No curriculum item at order_index ${orderIndex}`);
  return buildReadingForItem(profile, forDate, item, createdAt);
}

// Returns today's most recent reading if one already exists, otherwise reveals/generates the
// first one for today. Idempotent for repeat calls with nothing new to do — safe for /api/today
// and the chat assistant to call on every visit without spamming generations. The cursor only
// ever advances when a profile actually shows up (there's no background job pre-generating it on
// a schedule) — a day nobody visits doesn't silently consume a cursor step; the next visit
// (whenever that is) picks up right where it left off. Also tops up the one-item prefetch buffer
// in the background (after() — doesn't add latency here) so that visit's *next* passage is ready
// before it's asked for.
export async function generateDailyReading(profile: Profile) {
  const forDate = todayDateString();
  after(() => ensurePrefetchedNext(profile.id));

  const [existing] = await db
    .select()
    .from(readings)
    .where(and(eq(readings.profileId, profile.id), eq(readings.forDate, forDate), eq(readings.revealed, true)))
    .orderBy(desc(readings.createdAt))
    .limit(1);
  if (existing) {
    const [existingItem] = await db
      .select()
      .from(curriculumItems)
      .where(eq(curriculumItems.id, existing.curriculumItemId))
      .limit(1);
    return { ...existing, passageRef: existingItem?.passageRef ?? null };
  }

  return buildFirstReadingOfDay(profile, forDate);
}

// User-triggered "read next" action: reveals the buffered reading if one's ready (instant) or
// generates on the spot as a fallback, either way advancing the cursor, regardless of whether a
// reading already exists for today. Lets someone who finishes today's reading keep going the
// same day instead of waiting until they next open the app. Also tops up the prefetch buffer in
// the background for whatever comes after this one.
export async function generateNextReading(profile: Profile) {
  after(() => ensurePrefetchedNext(profile.id));
  return revealOrGenerate(profile, todayDateString());
}

// All of today's readings for a profile, oldest first, so the UI can page back and forth
// through however many times someone has read ahead today. Generates the first one if none
// exist yet, same as generateDailyReading.
export async function getTodayReadings(profile: Profile) {
  const forDate = todayDateString();
  after(() => ensurePrefetchedNext(profile.id));

  const existing = await db
    .select()
    .from(readings)
    .where(and(eq(readings.profileId, profile.id), eq(readings.forDate, forDate), eq(readings.revealed, true)))
    .orderBy(readings.createdAt);

  const rows = existing.length > 0 ? existing : [await buildFirstReadingOfDay(profile, forDate)];

  return Promise.all(
    rows.map(async (r) => {
      const [item] = await db
        .select()
        .from(curriculumItems)
        .where(eq(curriculumItems.id, r.curriculumItemId))
        .limit(1);
      return { ...r, passageRef: item?.passageRef ?? null };
    }),
  );
}

export async function findOrCreateProfile(name: string): Promise<Profile> {
  const [existing] = await db.select().from(profiles).where(eq(profiles.name, name)).limit(1);
  if (existing) return existing;

  const [created] = await db.insert(profiles).values({ name }).returning();
  return created;
}

// Read-only: reports which curriculum item a profile's cursor is CURRENTLY sitting on, without
// generating a reading or advancing anything. Mirrors buildReading/buildFirstReadingOfDay's own
// season-then-rotation lookup so the answer always matches what actually shows up if the profile
// opens the app right now — but must NEVER call buildReading/generateDailyReading itself, since
// this is used by the morning-reminder cron and calling either of those on a schedule is exactly
// the bug that removing the old nightly cron fixed (see vercel.ts): it would silently consume a
// curriculum step for every profile whether or not they actually visited that day.
export async function peekCurrentCurriculumItem(profile: Profile): Promise<CurriculumItem | null> {
  const activeSeason = getActiveSeason(pacificDateString());
  if (activeSeason) {
    const [seasonItem] = await db
      .select()
      .from(curriculumItems)
      .where(
        and(
          eq(curriculumItems.season, activeSeason.season),
          eq(curriculumItems.seasonDayIndex, activeSeason.dayIndex),
        ),
      )
      .limit(1);
    if (seasonItem) return seasonItem;
  }

  const [total] = await db
    .select({ count: sql<number>`count(*)` })
    .from(curriculumItems)
    .where(isNull(curriculumItems.season));
  const curriculumLength = Number(total?.count ?? 0);
  if (curriculumLength === 0) return null;

  const position = profile.cursorPosition % curriculumLength;
  const [item] = await db
    .select()
    .from(curriculumItems)
    .where(and(eq(curriculumItems.orderIndex, position), isNull(curriculumItems.season)))
    .limit(1);
  return item ?? null;
}

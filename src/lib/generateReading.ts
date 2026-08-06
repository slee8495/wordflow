import { generateObject, generateText } from "ai";
import { after } from "next/server";
import { z } from "zod";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  curriculumItems,
  profiles,
  readings,
  type CurriculumItem,
  type Profile,
  type WorshipLink,
} from "@/db/schema";
import { MODEL } from "@/lib/ai/model";
import { fetchNltPassage } from "@/lib/bible";
import { searchWorshipSongs } from "@/lib/youtube";
import { profileDateString } from "@/lib/date";
import { getActiveSeason } from "@/lib/season";

// Postgres advisory locks share one global keyspace, so two different lock uses (per-profile vs.
// per-curriculum-item, below) need distinct namespaces or a profile id could collide with an
// unrelated curriculum item id. Using the two-key form of pg_advisory_xact_lock(namespace, id)
// keeps them apart.
const LOCK_NAMESPACE_PROFILE = 1;
const LOCK_NAMESPACE_CURRICULUM_ITEM = 2;

// Serializes any check-then-generate-then-advance-cursor sequence for a given profile behind a
// Postgres transaction-scoped advisory lock, keyed on the profile's id. Without this, two
// near-simultaneous requests (e.g. a double-tap, or two tabs) can both pass the "no reading yet
// today" check before either has inserted its row, and both go on to generate a reading and
// advance the cursor — producing a duplicate reading and skipping a curriculum step. The lock is
// held only for the duration of fn(); the row inserts inside fn() still commit immediately on the
// shared `db` connection, so by the time a second, blocked caller acquires the lock, the first
// caller's insert is already visible and the "existing reading" check they re-run finds it.
async function withProfileLock<T>(profileId: number, fn: () => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_NAMESPACE_PROFILE}, ${profileId})`);
    return fn();
  });
}

// Same pattern, keyed on curriculum item id — guards the shared-content cache in
// buildReadingForItem below (see its comment) so two profiles reaching a never-before-seen item
// at the same instant can't both miss the cache and each pay for their own AI generation.
async function withCurriculumItemLock<T>(itemId: number, fn: () => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_NAMESPACE_CURRICULUM_ITEM}, ${itemId})`);
    return fn();
  });
}

// Cheap truncation detector: a prose field that got cut off mid-generation (hit a token limit,
// leaked a dangling prompt fragment, etc.) almost never ends on sentence-ending punctuation —
// it just stops mid-word or mid-clause. Not a grammar checker, just a smoke test.
const SENTENCE_END = /[.!?"'”’」）)]\s*$/;
function looksComplete(text: string | null | undefined, minLength = 10): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  return trimmed.length >= minLength && SENTENCE_END.test(trimmed);
}

// Re-runs fn() (a full model call) up to `attempts` times until isValid passes, returning the
// last result either way — a validated response beats retrying forever, but an imperfect one
// still beats throwing and blocking the whole reading over a single flaky field.
async function withRetry<T>(fn: () => Promise<T>, isValid: (value: T) => boolean, attempts = 2): Promise<T> {
  let result = await fn();
  for (let i = 1; i < attempts && !isValid(result); i++) {
    result = await fn();
  }
  return result;
}

// Shared guidance for every prompt that renders Korean Bible text — addresses recurring quality
// issues: (1) names/places rendered as ad-hoc phonetic transliterations of the English NLT
// spelling instead of the long-established Korean Bible spelling (e.g. "캐나안" instead of
// "가나안", "떤기나무" instead of "떨기나무"), (2) sibling terms translated as a flat "brother"/
// "sister" without accounting for actual birth order — e.g. Joseph (younger than 10 of his
// brothers, older than Benjamin) getting mislabeled as everyone's "형" instead of "형들의 동생이자
// 베냐민의 형" — and (3) speech level (존댓말/반말) not reflecting who outranks whom — e.g. God
// addressing Jacob, or Jacob (father) addressing Joseph (son), rendered in deferential 존댓말 as if
// the higher-status speaker were being polite to the lower-status one, which reads backwards in
// Korean.
export const KOREAN_STYLE_GUIDANCE =
  "인명·지명 등 고유명사는 영어 철자를 그대로 음역하지 말고, 한국어 성경(개역개정/새번역/쉬운성경)에서 " +
  "널리 쓰이는 표준 표기를 정확히 쓰세요 (예: '가나안'이 맞고 '캐나안'은 틀림, '떨기나무'가 맞고 " +
  "'떤기나무'는 틀림) — 표기가 헷갈리면 지어내지 말고 가장 널리 알려진 표준 표기를 쓰세요. " +
  "여러 형제를 뭉뚱그려 가리킬 때(예: 요셉을 판 형제들 전체)는 나이 순서를 단정하지 말고 중립적인 " +
  "'형제들'을 쓰세요 — 이 경우 무조건 'brother'를 '형'으로 옮기지 마세요. 성경에 나이 순서가 명확한 " +
  "두 사람을 직접 비교할 때만(예: 형인 에서와 동생인 야곱, 형들보다 어리고 베냐민보다는 손위인 요셉처럼) " +
  "'형'과 '동생'을 정확히 구분해서 쓰고, 그 관계가 확실하지 않으면 절대 추측하지 말고 중립적인 '형제'를 쓰세요. " +
  "대화체 말투(존댓말/반말)는 두 인물의 위계에 맞게 쓰세요 — 하나님이 사람에게 말할 때, 부모가 자녀에게 " +
  "말할 때, 왕이 신하에게 말할 때처럼 손윗사람·윗사람이 손아랫사람·아랫사람에게 말할 때는 존댓말이 아니라 " +
  "반말이나 명령형(예: '가거라', '두려워하지 말라')을 쓰고, 반대로 아랫사람이 윗사람에게 말할 때만 " +
  "존댓말을 쓰세요.";

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
  const { object } = await withRetry(
    () =>
      generateObject({
        model: MODEL,
        schema: koreanPassageSchema,
        system:
          "당신은 성경 본문을 쉬운 한글로 옮기는 번역가입니다. 원문의 사건과 의미를 정확히 지키되, " +
          "성경을 처음 읽는 사람도 이해할 수 있는 쉬운성경 스타일의 자연스러운 한글로 표현하세요. " +
          "새로운 내용을 지어내지 말고 주어진 영어 본문(NLT)의 내용에 충실하게 옮기세요. " +
          "story 버전은 verses 버전을 요약한 것이 아닙니다 — 모든 절의 내용을 빠짐없이 담아 절 번호만 " +
          "빼고 이야기체 문장으로 자연스럽게 이어붙이세요. " +
          KOREAN_STYLE_GUIDANCE,
        prompt: [
          `본문: ${reference}`,
          englishText ? `영어 NLT 원문:\n${englishText}` : null,
        ]
          .filter(Boolean)
          .join("\n\n"),
      }),
    ({ object }) => looksComplete(object.verses, 20) && looksComplete(object.story, 20),
  );
  return object;
}

// The NLT API text is already verse-numbered ("by verse"), so English only needs a story-mode
// counterpart generated — same idea as generateKoreanPassage's "story" field, just English to
// English: flow the same NLT wording into continuous prose with verse markers removed, no new
// content invented.
export async function generateEnglishStoryPassage(reference: string, englishVersesText: string): Promise<string | null> {
  const { text } = await withRetry(
    () =>
      generateText({
        model: MODEL,
        system:
          "You render Bible passages as smooth, continuous story-style prose in English. Preserve the given " +
          "NLT wording and meaning as closely as possible — don't add or omit content, just remove verse-number " +
          "markers and join the text into one natural flowing narrative with no verse breaks. Output only the " +
          "passage text, no preamble.",
        prompt: `Passage: ${reference}\n\nNLT text (verse-numbered):\n${englishVersesText}`,
      }),
    ({ text }) => looksComplete(text, 20),
  );
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

// The set of fields that make up a curriculum item's generated content — everything that's a
// pure function of the passage itself, with no profile-specific input anywhere in how it's
// produced. Shared type between generateFreshContent's return and the readings-table columns it
// gets copied into/out of.
export type ReadingContent = {
  theme: string;
  storySummary: string;
  historicalContext: string;
  personalMessage: string;
  themeEn: string;
  storySummaryEn: string;
  historicalContextEn: string;
  personalMessageEn: string;
  passageTextKoVerses: string | null;
  passageTextKoStory: string | null;
  passageTextEn: string | null;
  passageTextEnStory: string | null;
  worshipLinkKo: WorshipLink | null;
  worshipLinkEn: WorshipLink | null;
};

const CONTENT_COLUMNS = {
  theme: readings.theme,
  storySummary: readings.storySummary,
  historicalContext: readings.historicalContext,
  personalMessage: readings.personalMessage,
  themeEn: readings.themeEn,
  storySummaryEn: readings.storySummaryEn,
  historicalContextEn: readings.historicalContextEn,
  personalMessageEn: readings.personalMessageEn,
  passageTextKoVerses: readings.passageTextKoVerses,
  passageTextKoStory: readings.passageTextKoStory,
  passageTextEn: readings.passageTextEn,
  passageTextEnStory: readings.passageTextEnStory,
  worshipLinkKo: readings.worshipLinkKo,
  worshipLinkEn: readings.worshipLinkEn,
} as const;

// Actually calls the model — fetches passage text, writes the theme/story/context/message
// commentary, and looks up a worship song. Nothing here reads anything profile-specific, so its
// output is safe to reuse for every profile that ever reaches this curriculum item.
// Exported (not just used internally by buildReadingForItem) so one-off maintenance scripts —
// e.g. src/db/regenerateContent.ts — can re-run generation for an already-generated curriculum
// item after a prompt/quality fix, without duplicating this logic.
export async function generateFreshContent(item: CurriculumItem): Promise<ReadingContent> {
  const { koVerses, koStory, en, enStory } = await fetchPassageTexts(item.passageRef);

  const { object } = await withRetry(
    () =>
      generateObject({
        model: MODEL,
        schema: readingSchema,
        system:
          "You write short, engaging daily Bible reading companions for a personal QT-style app called Wordflow. " +
          "Tone: story-like, warm, never dry or academic. Write every field in BOTH Korean and English — the two " +
          "should carry the same meaning, not be a literal translation of each other, each natural in its own " +
          "language. Keep each field to about 3-5 sentences (the whole thing should read aloud in roughly 5 minutes). " +
          `For the Korean fields: ${KOREAN_STYLE_GUIDANCE}`,
        prompt: [
          `Today's passage: ${item.passageRef} (theme bucket: ${item.theme})`,
          koStory ? `한글 본문(이야기체):\n${koStory}` : null,
          en ? `English NLT text:\n${en}` : null,
        ]
          .filter(Boolean)
          .join("\n\n"),
      }),
    ({ object }) =>
      looksComplete(object.storySummary.ko) &&
      looksComplete(object.storySummary.en) &&
      looksComplete(object.historicalContext.ko) &&
      looksComplete(object.historicalContext.en) &&
      looksComplete(object.personalMessage.ko) &&
      looksComplete(object.personalMessage.en),
  );

  const worship = await searchWorshipSongs(object.theme.ko, object.theme.en).catch(() => ({
    ko: null,
    en: null,
  }));

  return {
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
  };
}

// Generates (or reuses) and inserts a reading for a specific curriculum item — the shared
// content-generation step, with no opinion on cursor position. Optional createdAt lets a caller
// backdate a row so it sorts correctly among a profile's other readings for the day (used by
// catchUpReading below). `revealed = false` inserts it as a hidden prefetch buffer instead of an
// immediately-visible reading — see revealOrGenerate/ensurePrefetchedNext below.
//
// Content is a pure function of the curriculum item (no profile-specific input goes into the
// prompt), so once any profile has generated it, every later profile — and every later cycle
// through the curriculum, by anyone — reuses the same row's content instead of paying for a fresh
// AI generation. Guarded by a per-item advisory lock so two profiles reaching a brand-new item at
// the same instant can't both miss the cache and each generate their own copy.
async function buildReadingForItem(
  profile: Profile,
  forDate: string,
  item: CurriculumItem,
  createdAt?: Date,
  revealed = true,
) {
  // The insert must happen *inside* the lock, not after — otherwise a second caller blocked on
  // the same item can acquire the lock in the gap between "content resolved" and "row inserted",
  // find nothing yet committed, and generate its own redundant copy anyway.
  return withCurriculumItemLock(item.id, async () => {
    const [existing] = await db
      .select(CONTENT_COLUMNS)
      .from(readings)
      .where(eq(readings.curriculumItemId, item.id))
      .limit(1);
    const content = existing ?? (await generateFreshContent(item));

    const [row] = await db
      .insert(readings)
      .values({
        profileId: profile.id,
        curriculumItemId: item.id,
        forDate,
        ...content,
        revealed,
        ...(createdAt ? { createdAt } : {}),
      })
      .returning();

    return { ...row, passageRef: item.passageRef };
  });
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
  await withProfileLock(profileId, async () => {
    const [hidden] = await db
      .select({ id: readings.id })
      .from(readings)
      .where(and(eq(readings.profileId, profileId), eq(readings.revealed, false)))
      .limit(1);
    if (hidden) return;

    const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
    if (!profile) return;

    await buildReading(profile, profileDateString(profile), false).catch(() => {
      // best-effort — if this fails, the next reveal just falls back to synchronous generation
    });
  });
}

// Looks up today's season-specific curriculum item (Holy Week / Christmas / Thanksgiving — see
// src/lib/season.ts), or null outside any active window. Seasons are the one deliberate exception
// to the "stay on whatever was last revealed" rule below: they're an intentional day-by-day
// series, so each new season day is still meant to swap in automatically.
async function activeSeasonItemFor(profile: Profile): Promise<CurriculumItem | null> {
  const activeSeason = getActiveSeason(profileDateString(profile));
  if (!activeSeason) return null;
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
  return seasonItem ?? null;
}

// The very first reading a brand-new profile ever gets: if today falls in an active season
// window, serves that season's reading instead of the normal rotation, without touching the
// cursor at all. Because the cursor is untouched, any *subsequent* reading that day (via "read
// next", which always calls buildReading directly, bypassing this function) falls straight back
// to normal progress, and the cursor resumes exactly where it was once the season window closes.
async function buildFirstReadingOfDay(profile: Profile, forDate: string) {
  const seasonItem = await activeSeasonItemFor(profile);
  if (seasonItem) return buildReadingForItem(profile, forDate, seasonItem);
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

// User-triggered "read next" action: reveals the buffered reading if one's ready (instant) or
// generates on the spot as a fallback, either way advancing the cursor, regardless of whether a
// reading already exists for today. Lets someone who finishes today's reading keep going the
// same day instead of waiting until they next open the app. Also tops up the prefetch buffer in
// the background for whatever comes after this one.
export async function generateNextReading(profile: Profile) {
  after(() => ensurePrefetchedNext(profile.id));
  return withProfileLock(profile.id, () => revealOrGenerate(profile, profileDateString(profile)));
}

// The readings the "Today" tab currently shows, oldest first, so the UI can page back and forth
// through however many times someone has read ahead in one sitting (via "read next"). Opening the
// app on a later calendar day does NOT walk this forward on its own — the profile stays on
// whatever was last revealed (and any others sharing its forDate) until they explicitly tap "read
// next" (see generateNextReading). The one exception is an active season window: that's an
// intentional day-by-day series, so a new season day still swaps in automatically even without a
// "read next" tap. Generates the very first reading ever for a brand-new profile, same as before.
export async function getTodayReadings(profile: Profile) {
  const forDate = profileDateString(profile);
  after(() => ensurePrefetchedNext(profile.id));

  const rows = await withProfileLock(profile.id, async () => {
    const [latest] = await db
      .select()
      .from(readings)
      .where(and(eq(readings.profileId, profile.id), eq(readings.revealed, true)))
      .orderBy(desc(readings.createdAt))
      .limit(1);

    if (!latest) return [await buildFirstReadingOfDay(profile, forDate)];

    const seasonItem = await activeSeasonItemFor(profile);
    if (seasonItem && seasonItem.id !== latest.curriculumItemId) {
      return [await buildReadingForItem(profile, forDate, seasonItem)];
    }

    return db
      .select()
      .from(readings)
      .where(and(eq(readings.profileId, profile.id), eq(readings.forDate, latest.forDate), eq(readings.revealed, true)))
      .orderBy(readings.createdAt);
  });

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

// Read-only lookup for the Today tab's "browse previous days" navigation. Unlike getTodayReadings,
// never generates or reveals anything — a date the profile never opened the app on simply has no
// rows (the curriculum cursor only advances on days someone actually shows up), and the UI shows
// an empty state for those.
export async function getReadingsForDate(profile: Profile, forDate: string) {
  const rows = await db
    .select()
    .from(readings)
    .where(and(eq(readings.profileId, profile.id), eq(readings.forDate, forDate), eq(readings.revealed, true)))
    .orderBy(readings.createdAt);

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

// Updates + returns the profile with a client-supplied timezone applied immediately, instead of
// waiting on ProfileSettingsSync's separate POST to land first. Without this, a profile's very
// first request of the day (the one that actually decides that day's forDate) could race ahead of
// the sync and generate against DEFAULT_TIMEZONE — a mistake that then persists for that whole
// calendar day. Every read-heavy route that calls requireProfile() (src/lib/authProfile.ts) and
// then immediately does something forDate-sensitive (getTodayReadings, generateNextReading, etc.)
// should pass through here first with whatever timezone the client's TimezoneProvider currently
// has.
export async function syncProfileTimezone(profile: Profile, timezone: string | null | undefined): Promise<Profile> {
  if (!timezone || profile.timezone === timezone) return profile;
  const [updated] = await db.update(profiles).set({ timezone }).where(eq(profiles.id, profile.id)).returning();
  return updated ?? profile;
}

// Read-only: reports whichever curriculum item is CURRENTLY being shown to the profile — the same
// thing getTodayReadings would return, without generating or advancing anything — so the
// morning-reminder cron's notification always describes what's actually on screen right now
// (season item, else the latest revealed reading), never the buffered "next" item that only shows
// up once the profile explicitly taps "read next". Must NEVER call buildReading/getTodayReadings
// itself, since this is used on a schedule and calling either of those would silently consume a
// curriculum step for every profile whether or not they actually visited that day (see vercel.ts).
export async function peekCurrentCurriculumItem(profile: Profile): Promise<CurriculumItem | null> {
  const seasonItem = await activeSeasonItemFor(profile);
  if (seasonItem) return seasonItem;

  const [latest] = await db
    .select({ curriculumItemId: readings.curriculumItemId })
    .from(readings)
    .where(and(eq(readings.profileId, profile.id), eq(readings.revealed, true)))
    .orderBy(desc(readings.createdAt))
    .limit(1);
  if (latest) {
    const [latestItem] = await db
      .select()
      .from(curriculumItems)
      .where(eq(curriculumItems.id, latest.curriculumItemId))
      .limit(1);
    if (latestItem) return latestItem;
  }

  // No revealed reading exists at all yet — a brand-new profile who's never opened the app.
  // Falls back to cursorPosition, which is still 0 at that point.
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

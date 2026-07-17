// Reading-progress analytics for the Reading tab's Progress dashboard — combines the daily
// Claude-generated readings with whatever's been browsed in the deep-reading tab, per the
// user's explicit ask that both activity sources count toward the same picture.
//
// Progress is expressed against the real Bible structure (66 books, each book's real chapter
// count) rather than the 49-entry curriculum, which was confusing: an entry like "Genesis
// 6:5-7:16" reads as "1 of 11 Genesis entries done" (36%), not "chapters read out of 50" — the
// unit didn't match what a reader intuitively expects "% of Genesis" to mean. cycleCount and
// the completion projection stay curriculum-entry-based, since those are specifically about
// finishing the curriculum loop, a different (and still well-defined) concept.
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { curriculumItems, deepReadingLogs, readings, type Profile } from "@/db/schema";
import { BIBLE_BOOKS, chapterCountForBook } from "@/lib/bibleBooks";
import { pacificDateString } from "@/lib/date";
import { parsePassageRef } from "@/lib/passageRef";

const TRAILING_PACE_DAYS = 14;

export type ProgressScope = "cycle" | "all";

export type ProgressPayload = {
  scope: ProgressScope;
  cycleStartedAt: string | null; // ISO timestamp, null if scope is "all" or no cycle started yet
  cycleCount: number;
  booksTouchedCount: number;
  booksProgressPct: number; // booksTouchedCount / 66 * 100
  currentBook: string | null;
  currentBookChaptersTouched: number | null;
  currentBookTotalChapters: number | null;
  currentBookProgressPct: number | null; // chaptersTouched / totalChapters * 100, for currentBook
  projectedCompletionDate: string | null; // YYYY-MM-DD, Pacific
  perBookProgress: { book: string; testament: "old" | "new"; chaptersTouched: number; totalChapters: number; pct: number }[];
  activityCount: number; // readings + deep-reading-log rows, scoped the same as everything else
};

function daysAgoDateString(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Every chapter a profile has touched, per book — from daily readings (whose curriculum
// passageRef may span several chapters, e.g. "Genesis 6:5-7:16" touches both 6 and 7) and from
// the deep-reading tab's explicit per-chapter log. `since`, when given, scopes this to activity
// recorded after that timestamp (used for the "this cycle" view — omit for lifetime-cumulative).
async function getTouchedChapters(profileId: number, since?: Date): Promise<Map<string, Set<number>>> {
  const touched = new Map<string, Set<number>>();

  const readingRows = await db
    .select({ passageRef: curriculumItems.passageRef })
    .from(readings)
    .innerJoin(curriculumItems, eq(curriculumItems.id, readings.curriculumItemId))
    .where(since ? and(eq(readings.profileId, profileId), gte(readings.createdAt, since)) : eq(readings.profileId, profileId));

  for (const r of readingRows) {
    const p = parsePassageRef(r.passageRef);
    const set = touched.get(p.book) ?? new Set<number>();
    for (let c = p.startChapter; c <= p.endChapter; c++) set.add(c);
    touched.set(p.book, set);
  }

  const deepRows = await db
    .select({ book: deepReadingLogs.book, chapter: deepReadingLogs.chapter })
    .from(deepReadingLogs)
    .where(
      since
        ? and(eq(deepReadingLogs.profileId, profileId), gte(deepReadingLogs.createdAt, since))
        : eq(deepReadingLogs.profileId, profileId),
    );

  for (const r of deepRows) {
    const set = touched.get(r.book) ?? new Set<number>();
    set.add(r.chapter);
    touched.set(r.book, set);
  }

  return touched;
}

export async function getReadingProgress(profile: Profile, scope: ProgressScope): Promise<ProgressPayload> {
  const [{ count: curriculumLength }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(curriculumItems);

  const since = scope === "cycle" ? (profile.currentCycleStartedAt ?? undefined) : undefined;
  const touchedChapters = await getTouchedChapters(profile.id, since);
  const booksTouchedCount = touchedChapters.size;
  const booksProgressPct = (booksTouchedCount / BIBLE_BOOKS.length) * 100;

  let currentBook: string | null = null;
  let currentBookChaptersTouched: number | null = null;
  let currentBookTotalChapters: number | null = null;
  let currentBookProgressPct: number | null = null;

  // lastReadDate is only set once a profile has actually generated a reading — before that,
  // cursorPosition is 0 with nothing "just read" yet, so there's no current book to report.
  if (profile.lastReadDate !== null && curriculumLength > 0) {
    const justReadIndex = (profile.cursorPosition - 1 + curriculumLength) % curriculumLength;
    const [item] = await db
      .select()
      .from(curriculumItems)
      .where(eq(curriculumItems.orderIndex, justReadIndex))
      .limit(1);
    if (item) {
      currentBook = item.book;
      currentBookTotalChapters = chapterCountForBook(item.book);
      currentBookChaptersTouched = touchedChapters.get(item.book)?.size ?? 0;
      if (currentBookTotalChapters) {
        currentBookProgressPct = (currentBookChaptersTouched / currentBookTotalChapters) * 100;
      }
    }
  }

  const perBookProgress = BIBLE_BOOKS.map((b) => {
    const chaptersTouched = touchedChapters.get(b.name)?.size ?? 0;
    return {
      book: b.name,
      testament: b.testament,
      chaptersTouched,
      totalChapters: b.chapters,
      pct: (chaptersTouched / b.chapters) * 100,
    };
  });

  // Trailing pace for the completion projection — always a fixed 14-day window regardless of
  // `scope`. Stays curriculum-entry-based: it's projecting when the CURRICULUM LOOP finishes,
  // not Bible chapter coverage.
  const paceSince = daysAgoDateString(TRAILING_PACE_DAYS);
  const [readingPace] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(readings)
    .where(and(eq(readings.profileId, profile.id), gte(readings.forDate, paceSince)));
  const [deepPace] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(deepReadingLogs)
    .where(and(eq(deepReadingLogs.profileId, profile.id), gte(deepReadingLogs.forDate, paceSince)));
  const pace = ((readingPace?.count ?? 0) + (deepPace?.count ?? 0)) / TRAILING_PACE_DAYS;

  const remaining = curriculumLength - profile.cursorPosition;
  const projectedCompletionDate = pace > 0 ? pacificDateString(Math.ceil(remaining / pace)) : null;

  // Same scope as everything else on this payload — "this cycle" or lifetime, no separate
  // day-range picker.
  const [readingActivity] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(readings)
    .where(since ? and(eq(readings.profileId, profile.id), gte(readings.createdAt, since)) : eq(readings.profileId, profile.id));
  const [deepActivity] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(deepReadingLogs)
    .where(
      since
        ? and(eq(deepReadingLogs.profileId, profile.id), gte(deepReadingLogs.createdAt, since))
        : eq(deepReadingLogs.profileId, profile.id),
    );

  return {
    scope,
    cycleStartedAt: scope === "cycle" ? (profile.currentCycleStartedAt?.toISOString() ?? null) : null,
    cycleCount: profile.cycleCount,
    booksTouchedCount,
    booksProgressPct,
    currentBook,
    currentBookChaptersTouched,
    currentBookTotalChapters,
    currentBookProgressPct,
    projectedCompletionDate,
    perBookProgress,
    activityCount: (readingActivity?.count ?? 0) + (deepActivity?.count ?? 0),
  };
}

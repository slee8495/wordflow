// Reading-progress analytics for the Reading tab's Progress dashboard — combines the daily
// Claude-generated readings with whatever's been browsed in the deep-reading tab, per the
// user's explicit ask that both activity sources count toward the same picture.
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { curriculumItems, deepReadingLogs, readings, type Profile } from "@/db/schema";
import { BIBLE_BOOKS } from "@/lib/bibleBooks";
import { pacificDateString } from "@/lib/date";

const TRAILING_PACE_DAYS = 14;

export type ProgressPayload = {
  cycleCount: number;
  cycleProgressPct: number;
  currentBook: string | null;
  currentBookProgressPct: number | null;
  projectedCompletionDate: string | null; // YYYY-MM-DD, Pacific
  perBookCounts: { book: string; testament: "old" | "new"; count: number }[];
  recentActivityCount: number;
  recentActivityDays: number;
};

function daysAgoDateString(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function getReadingProgress(profile: Profile, days: number): Promise<ProgressPayload> {
  const [{ count: curriculumLength }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(curriculumItems);

  let currentBook: string | null = null;
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
      const [range] = await db
        .select({
          min: sql<number>`min(${curriculumItems.orderIndex})::int`,
          max: sql<number>`max(${curriculumItems.orderIndex})::int`,
        })
        .from(curriculumItems)
        .where(eq(curriculumItems.book, item.book));
      if (range) {
        const span = range.max - range.min + 1;
        currentBookProgressPct = ((justReadIndex - range.min + 1) / span) * 100;
      }
    }
  }

  const cycleProgressPct = curriculumLength > 0 ? (profile.cursorPosition / curriculumLength) * 100 : 0;

  // Per-book counts: merge daily-Claude-reading activity with deep-reading-tab activity.
  const readingCounts = await db
    .select({ book: curriculumItems.book, count: sql<number>`count(*)::int` })
    .from(readings)
    .innerJoin(curriculumItems, eq(curriculumItems.id, readings.curriculumItemId))
    .where(eq(readings.profileId, profile.id))
    .groupBy(curriculumItems.book);

  const deepCounts = await db
    .select({ book: deepReadingLogs.book, count: sql<number>`count(*)::int` })
    .from(deepReadingLogs)
    .where(eq(deepReadingLogs.profileId, profile.id))
    .groupBy(deepReadingLogs.book);

  const countByBook = new Map<string, number>();
  for (const r of readingCounts) countByBook.set(r.book, (countByBook.get(r.book) ?? 0) + r.count);
  for (const r of deepCounts) countByBook.set(r.book, (countByBook.get(r.book) ?? 0) + r.count);

  const perBookCounts = BIBLE_BOOKS.map((b) => ({
    book: b.name,
    testament: b.testament,
    count: countByBook.get(b.name) ?? 0,
  }));

  // Trailing pace for the completion projection — a fixed window, independent of the UI's
  // requested `days` filter (which only affects recentActivityCount below).
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

  const sinceDate = daysAgoDateString(days);
  const [readingRecent] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(readings)
    .where(and(eq(readings.profileId, profile.id), gte(readings.forDate, sinceDate)));
  const [deepRecent] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(deepReadingLogs)
    .where(and(eq(deepReadingLogs.profileId, profile.id), gte(deepReadingLogs.forDate, sinceDate)));

  return {
    cycleCount: profile.cycleCount,
    cycleProgressPct,
    currentBook,
    currentBookProgressPct,
    projectedCompletionDate,
    perBookCounts,
    recentActivityCount: (readingRecent?.count ?? 0) + (deepRecent?.count ?? 0),
    recentActivityDays: days,
  };
}

import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { curriculumItems, profiles, readings, users } from "@/db/schema";
import { profileDateString } from "@/lib/date";
import { getReadingProgress } from "@/lib/progress";

// A status report for Brownie (the SL Studio assistant app), so it can answer "지금 통독
// 어디야?" / "오늘 말씀 어디야?" without the owner opening this app.
//
// Read-only and deliberately shallow: it reports what is already stored and never generates a
// reading. Generation is slow, costs a model call, and — more importantly — would mean an
// assistant's question silently *advanced* someone's reading. Asking where you are should not
// move you.
//
// Authenticated by a shared token rather than a session, because the caller is another server
// with no browser and no cookie. Same shape as CRON_SECRET, which this app already does.

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const expected = process.env.BROWNIE_TOKEN;
  if (!expected) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const offered = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!offered || offered !== expected) return unauthorized();

  // The owner's profile — the same single-operator assumption adminAuth.ts already makes.
  const [profile] = await db
    .select()
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .where(eq(users.email, process.env.ADMIN_EMAIL ?? ""))
    .limit(1)
    .then((rows) => rows.map((r) => r.profiles));

  if (!profile) return NextResponse.json({ error: "no profile" }, { status: 404 });

  const today = profileDateString(profile);

  // season IS NULL for the same reason the cursor math excludes them (see schema.ts): season
  // readings do not advance the plan.
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(curriculumItems)
    .where(isNull(curriculumItems.season));
  const planLength = Number(count) || 0;

  const [todays] = await db
    .select({ theme: readings.theme, passageRef: curriculumItems.passageRef, book: curriculumItems.book })
    .from(readings)
    .innerJoin(curriculumItems, eq(curriculumItems.id, readings.curriculumItemId))
    .where(and(eq(readings.profileId, profile.id), eq(readings.forDate, today), eq(readings.revealed, true)))
    .limit(1);

  // What the next reading would be, for the days it has not been opened yet. Peeked from the
  // cursor rather than generated.
  const [next] = todays
    ? []
    : await db
        .select({ passageRef: curriculumItems.passageRef, book: curriculumItems.book, theme: curriculumItems.theme })
        .from(curriculumItems)
        .where(
          and(
            eq(curriculumItems.orderIndex, planLength ? profile.cursorPosition % planLength : 0),
            isNull(curriculumItems.season),
          ),
        )
        .limit(1);

  // The same numbers the progress dashboard shows — computed by the app's own function rather
  // than a second copy of the maths here. The per-book breakdown (66 rows) is dropped: an
  // assistant reads answers out loud, and a list that long is not an answer.
  const progress = await getReadingProgress(profile, "cycle");

  return NextResponse.json({
    profile: profile.name,
    today,
    lastReadDate: profile.lastReadDate,
    readToday: Boolean(todays),
    reading: todays ?? next ?? null,
    progress: {
      position: profile.cursorPosition,
      planLength,
      percent: planLength ? Math.round((profile.cursorPosition / planLength) * 100) : null,
      remaining: Math.max(0, planLength - profile.cursorPosition),
      cycleCount: profile.cycleCount,
      // null when nothing has been read in the trailing two weeks — there is no pace to
      // project from. That is a real answer ("you have stopped"), not a missing one, so it is
      // reported rather than hidden.
      projectedCompletionDate: progress.projectedCompletionDate,
      currentBook: progress.currentBook,
      currentBookChaptersTouched: progress.currentBookChaptersTouched,
      currentBookTotalChapters: progress.currentBookTotalChapters,
      booksTouchedCount: progress.booksTouchedCount,
      booksTotal: 66,
      readingsThisCycle: progress.activityCount,
      cycleStartedAt: progress.cycleStartedAt,
    },
  });
}

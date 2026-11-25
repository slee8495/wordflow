import { afterEach, describe, expect, it, vi } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { curriculumItems, profiles, readings } from "@/db/schema";
import { getTodayReadings } from "@/lib/generateReading";
import { profileDateString } from "@/lib/date";

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: () => {} };
});

// Pin "today" to Thanksgiving day 0 (Psalm 100), whatever the real date is.
vi.mock("@/lib/season", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/season")>();
  return { ...actual, getActiveSeason: () => ({ season: "thanksgiving", dayIndex: 0 }) };
});

// Integration test against the real dev DB, disposable rows only (see the sibling test file).
// Regression (2026-11-25): after reading the day's season passage and then "read next" into the
// normal curriculum, reopening the app inserted the season reading a second time.
const testProfileName = `test-today-season-${Date.now()}`;
let createdProfileId: number | null = null;

afterEach(async () => {
  if (createdProfileId !== null) {
    await db.delete(readings).where(eq(readings.profileId, createdProfileId));
    await db.delete(profiles).where(eq(profiles.id, createdProfileId));
    createdProfileId = null;
  }
});

const content = {
  theme: "t",
  storySummary: "s",
  historicalContext: "h",
  personalMessage: "m",
};

describe("getTodayReadings during a season", () => {
  it("doesn't add the season reading again after reading past it the same day", async () => {
    const [seasonItem] = await db
      .select()
      .from(curriculumItems)
      .where(and(eq(curriculumItems.season, "thanksgiving"), eq(curriculumItems.seasonDayIndex, 0)))
      .limit(1);
    const [normalItem] = await db
      .select()
      .from(curriculumItems)
      .where(and(isNull(curriculumItems.season), eq(curriculumItems.orderIndex, 3)))
      .limit(1);

    const [profile] = await db
      .insert(profiles)
      .values({ name: testProfileName, cursorPosition: 4, timezone: "America/Los_Angeles" })
      .returning();
    createdProfileId = profile.id;
    const today = profileDateString(profile);

    await db.insert(readings).values([
      { profileId: profile.id, curriculumItemId: seasonItem.id, forDate: today, ...content, createdAt: new Date(Date.now() - 60_000) },
      { profileId: profile.id, curriculumItemId: normalItem.id, forDate: today, ...content, createdAt: new Date() },
    ]);

    const shown = await getTodayReadings(profile);

    expect(shown.map((r) => r.curriculumItemId)).toEqual([seasonItem.id, normalItem.id]);
    const all = await db.select().from(readings).where(eq(readings.profileId, profile.id));
    expect(all).toHaveLength(2);
  });
});

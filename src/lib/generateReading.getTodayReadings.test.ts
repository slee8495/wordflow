import { afterEach, describe, expect, it, vi } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { curriculumItems, profiles, readings } from "@/db/schema";
import { getTodayReadings } from "@/lib/generateReading";

// getTodayReadings schedules its background prefetch via next/server's after(), which throws
// outside a real request scope (which this test isn't running in). Stub it to a no-op — the
// prefetch itself would otherwise also trigger a real (slow, costly) AI content generation call,
// which this test has no reason to pay for.
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: () => {} };
});

// Integration test against the real dev DB (no separate test DB exists — see vitest.setup.ts).
// Only ever touches disposable rows it creates itself under a unique profile name, cleaned up in
// afterEach; never reads or writes any real profile's data.
//
// Regression test for the "stay on the current passage" behavior: opening the app on a later
// calendar day must not silently reveal the next curriculum item on its own — the profile should
// keep seeing whatever was last revealed until they explicitly tap "read next" (generateNextReading).
//
// Assumes no active season window (Holy Week/Christmas/Thanksgiving) when run — during one of
// those, getTodayReadings would correctly swap in that day's season reading instead, which is the
// one deliberate exception to "stay" (see activeSeasonItemFor's comment in generateReading.ts).

const testProfileName = `test-today-${Date.now()}`;
let createdProfileId: number | null = null;

afterEach(async () => {
  if (createdProfileId !== null) {
    await db.delete(readings).where(eq(readings.profileId, createdProfileId));
    await db.delete(profiles).where(eq(profiles.id, createdProfileId));
    createdProfileId = null;
  }
});

async function makeProfile(cursorPosition: number) {
  const [profile] = await db
    .insert(profiles)
    .values({ name: testProfileName, cursorPosition, timezone: "America/Los_Angeles" })
    .returning();
  createdProfileId = profile.id;
  return profile;
}

describe("getTodayReadings", () => {
  it("keeps showing the last revealed reading instead of generating a new one for a later date", async () => {
    const [item] = await db
      .select()
      .from(curriculumItems)
      .where(and(isNull(curriculumItems.season), eq(curriculumItems.orderIndex, 3)))
      .limit(1);

    // cursorPosition (4) is already one step past this item — buildReading advances it the moment
    // the item is buffered — but the profile hasn't actually moved on from it themselves.
    const profile = await makeProfile(4);
    const staleForDate = "2020-01-01"; // stands in for "an earlier day the profile last read on"
    await db.insert(readings).values({
      profileId: profile.id,
      curriculumItemId: item.id,
      forDate: staleForDate,
      theme: "test",
      storySummary: "test",
      historicalContext: "test",
      personalMessage: "test",
      revealed: true,
    });

    const result = await getTodayReadings(profile);

    expect(result).toHaveLength(1);
    expect(result[0].curriculumItemId).toBe(item.id);
    expect(result[0].forDate).toBe(staleForDate);

    const rows = await db.select().from(readings).where(eq(readings.profileId, profile.id));
    expect(rows).toHaveLength(1); // no new reading was generated just because the date moved on
  });
});

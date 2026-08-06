import { afterEach, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { curriculumItems, profiles, readings } from "@/db/schema";
import { getReadingProgress } from "@/lib/progress";

// Integration test against the real dev DB (no separate test DB exists — see vitest.setup.ts).
// Only ever touches disposable rows it creates itself under a unique profile name, cleaned up in
// afterEach; never reads or writes any real profile's data.
//
// Regression test: getReadingProgress used to derive "current book" from cursorPosition - 1, but
// cursorPosition is always one step ahead of what's really on screen (buildReading() advances it
// the moment the one-item prefetch buffer is generated — see ensurePrefetchedNext in
// generateReading.ts) — so the Progress dashboard reported a chapter the profile hadn't actually
// reached yet as "current". This checks it now reports the latest actually-revealed reading.

const testProfileName = `test-progress-${Date.now()}`;
let createdProfileId: number | null = null;

afterEach(async () => {
  if (createdProfileId !== null) {
    await db.delete(readings).where(eq(readings.profileId, createdProfileId));
    await db.delete(profiles).where(eq(profiles.id, createdProfileId));
    createdProfileId = null;
  }
});

async function makeProfile(cursorPosition: number, lastReadDate: string) {
  const [profile] = await db
    .insert(profiles)
    .values({ name: testProfileName, cursorPosition, lastReadDate, timezone: "America/Los_Angeles" })
    .returning();
  createdProfileId = profile.id;
  return profile;
}

describe("getReadingProgress", () => {
  it("reports the latest revealed reading's book as current, not cursorPosition's", async () => {
    // Different books at these two order_indexes (Genesis vs Exodus in the seeded curriculum),
    // so the assertion below can't pass merely by the two happening to share a book name.
    const [itemAtCursor, itemActuallyShown] = await Promise.all([
      db.select().from(curriculumItems).where(and(isNull(curriculumItems.season), eq(curriculumItems.orderIndex, 50))).limit(1).then((r) => r[0]),
      db.select().from(curriculumItems).where(and(isNull(curriculumItems.season), eq(curriculumItems.orderIndex, 3))).limit(1).then((r) => r[0]),
    ]);

    // Simulates the real "stay" behavior: cursorPosition (50) has already moved on ahead via the
    // prefetch buffer, but the profile is actually still on order_index 3's reading.
    const profile = await makeProfile(50, new Date().toISOString().slice(0, 10));
    await db.insert(readings).values({
      profileId: profile.id,
      curriculumItemId: itemActuallyShown.id,
      forDate: new Date().toISOString().slice(0, 10),
      theme: "test",
      storySummary: "test",
      historicalContext: "test",
      personalMessage: "test",
      revealed: true,
    });

    const result = await getReadingProgress(profile, "all");

    expect(result.currentBook).toBe(itemActuallyShown.book);
    expect(result.currentBook).not.toBe(itemAtCursor.book);
  });
});

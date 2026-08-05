import { afterEach, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { curriculumItems, profiles, readings } from "@/db/schema";
import { peekCurrentCurriculumItem } from "@/lib/generateReading";

// Integration test against the real dev DB (no separate test DB exists — see vitest.setup.ts).
// Only ever touches disposable rows it creates itself under a unique profile name, cleaned up in
// afterEach; never reads or writes any real profile's data.
//
// Regression test for the morning-notification bug: peekCurrentCurriculumItem used to compute its
// answer straight from cursorPosition, but buildReading() always advances cursorPosition the
// moment a reading is buffered ahead of time — including the hidden prefetch buffer — so
// cursorPosition already points one step past whatever the buffered "next" reading actually is.
// The app itself reveals that buffered reading, not whatever's at cursorPosition, so the old
// behavior was consistently one chapter ahead of what actually showed up when the app was opened.

const testProfileName = `test-peek-${Date.now()}`;
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

describe("peekCurrentCurriculumItem", () => {
  it("prefers the hidden prefetch buffer over cursorPosition when one exists", async () => {
    const [itemAtCursor, itemBeforeCursor] = await Promise.all([
      db.select().from(curriculumItems).where(and(isNull(curriculumItems.season), eq(curriculumItems.orderIndex, 5))).limit(1).then((r) => r[0]),
      db.select().from(curriculumItems).where(and(isNull(curriculumItems.season), eq(curriculumItems.orderIndex, 4))).limit(1).then((r) => r[0]),
    ]);

    // Simulates the real sequence: cursorPosition (5) already advanced past the buffered item
    // (order_index 4) the moment ensurePrefetchedNext buffered it.
    const profile = await makeProfile(5);
    await db.insert(readings).values({
      profileId: profile.id,
      curriculumItemId: itemBeforeCursor.id,
      forDate: new Date().toISOString().slice(0, 10),
      theme: "test",
      storySummary: "test",
      historicalContext: "test",
      personalMessage: "test",
      revealed: false,
    });

    const result = await peekCurrentCurriculumItem(profile);

    expect(result?.id).toBe(itemBeforeCursor.id);
    expect(result?.id).not.toBe(itemAtCursor.id);
  });

  it("falls back to cursorPosition when there's no hidden buffer", async () => {
    const [itemAtCursor] = await db
      .select()
      .from(curriculumItems)
      .where(and(isNull(curriculumItems.season), eq(curriculumItems.orderIndex, 5)))
      .limit(1);

    const profile = await makeProfile(5);
    const result = await peekCurrentCurriculumItem(profile);

    expect(result?.id).toBe(itemAtCursor.id);
  });
});

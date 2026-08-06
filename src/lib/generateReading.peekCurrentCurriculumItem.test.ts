import { afterEach, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { curriculumItems, profiles, readings } from "@/db/schema";
import { peekCurrentCurriculumItem } from "@/lib/generateReading";

// Integration test against the real dev DB (no separate test DB exists — see vitest.setup.ts).
// Only ever touches disposable rows it creates itself under a unique profile name, cleaned up in
// afterEach; never reads or writes any real profile's data.
//
// Regression coverage for the "stay on the current passage" behavior: opening the app on a later
// calendar day must not silently reveal the next curriculum item — peekCurrentCurriculumItem (used
// by the morning-reminder cron) must describe the latest REVEALED reading, never cursorPosition
// (which buildReading already advances past it the moment a reading is buffered ahead of time) and
// never a hidden, not-yet-revealed prefetch buffer (which only becomes visible once the profile
// explicitly taps "read next").

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
  it("prefers the latest revealed reading over cursorPosition", async () => {
    const [itemAtCursor, itemCurrentlyShown] = await Promise.all([
      db.select().from(curriculumItems).where(and(isNull(curriculumItems.season), eq(curriculumItems.orderIndex, 5))).limit(1).then((r) => r[0]),
      db.select().from(curriculumItems).where(and(isNull(curriculumItems.season), eq(curriculumItems.orderIndex, 3))).limit(1).then((r) => r[0]),
    ]);

    // Simulates the real "stay" behavior: cursorPosition (5) has already moved on ahead via the
    // prefetch buffer, but the profile hasn't actually read past order_index 3 yet — the
    // notification should describe what's on screen right now (3), not the cursor's position.
    const profile = await makeProfile(5);
    await db.insert(readings).values({
      profileId: profile.id,
      curriculumItemId: itemCurrentlyShown.id,
      forDate: new Date().toISOString().slice(0, 10),
      theme: "test",
      storySummary: "test",
      historicalContext: "test",
      personalMessage: "test",
      revealed: true,
    });

    const result = await peekCurrentCurriculumItem(profile);

    expect(result?.id).toBe(itemCurrentlyShown.id);
    expect(result?.id).not.toBe(itemAtCursor.id);
  });

  it("ignores a hidden, not-yet-revealed prefetch buffer", async () => {
    const [itemAtCursor, hiddenBufferItem] = await Promise.all([
      db.select().from(curriculumItems).where(and(isNull(curriculumItems.season), eq(curriculumItems.orderIndex, 5))).limit(1).then((r) => r[0]),
      db.select().from(curriculumItems).where(and(isNull(curriculumItems.season), eq(curriculumItems.orderIndex, 4))).limit(1).then((r) => r[0]),
    ]);

    const profile = await makeProfile(5);
    await db.insert(readings).values({
      profileId: profile.id,
      curriculumItemId: hiddenBufferItem.id,
      forDate: new Date().toISOString().slice(0, 10),
      theme: "test",
      storySummary: "test",
      historicalContext: "test",
      personalMessage: "test",
      revealed: false,
    });

    const result = await peekCurrentCurriculumItem(profile);

    expect(result?.id).toBe(itemAtCursor.id);
    expect(result?.id).not.toBe(hiddenBufferItem.id);
  });

  it("falls back to cursorPosition when there's no reading at all yet", async () => {
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

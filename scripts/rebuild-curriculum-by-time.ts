// Second curriculum migration: replaces the one-chapter-per-entry curriculum (1189 entries, just
// shipped) with a time-balanced curriculum (822 entries, src/db/curriculumData.ts) that chunks by
// real verse counts so a day's reading is roughly consistent length (~5-7 min guideline) instead
// of swinging between Psalm 119 (176 verses) and Obadiah (21 verses) alike. Same shape as
// scripts/rebuild-curriculum.ts's migration, one level up:
//
//   1. Archives the current live rotation (season IS NULL, orderIndex 0..1188) by shifting
//      orderIndex +300000 and tagging season='legacy'. Distinct offset from the FIRST archival
//      batch (90000+, from the original ~49-entry curriculum) so the two don't collide — both
//      are inert once tagged 'legacy', but orderIndex is still globally unique.
//   2. Remaps every profile's cursorPosition to the equivalent point in the new curriculum: their
//      current cursor points at a whole-chapter entry (e.g. "Genesis 15"); this finds the first
//      new-curriculum entry (in that book, in order) whose range reaches verse 1 of that chapter
//      — i.e. the earliest new entry that actually contains their next-unread material, so nobody
//      skips ahead or re-reads a chunk that already covers material they've read.
//   3. Deletes hidden (revealed=false) prefetch-buffer readings, same reasoning as before — they'd
//      otherwise reveal old-scheme content that no longer matches the remapped cursor.
//   4. Inserts the new curriculum at orderIndex 0..821.
//
// Run with: set -a && source .env.local && set +a && npx tsx scripts/rebuild-curriculum-by-time.ts
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { curriculumItems, profiles, readings } from "../src/db/schema";
import { STARTER_CURRICULUM } from "../src/db/curriculumData";
import { parsePassageRef } from "../src/lib/passageRef";

const ARCHIVE_OFFSET = 300000;

async function main() {
  // Build, per book, the new curriculum's entries in order with their parsed chapter range, so we
  // can find "the first new entry that reaches chapter C" for any old (book, chapter).
  const newEntriesByBook = new Map<
    string,
    { orderIndex: number; startChapter: number; endChapter: number }[]
  >();
  STARTER_CURRICULUM.forEach((item, orderIndex) => {
    const { startChapter, endChapter } = parsePassageRef(item.passageRef);
    const list = newEntriesByBook.get(item.book) ?? [];
    list.push({ orderIndex, startChapter, endChapter });
    newEntriesByBook.set(item.book, list);
  });

  function findNewCursor(book: string, targetChapter: number): number {
    const list = newEntriesByBook.get(book);
    if (!list) throw new Error(`No new-curriculum entries for book "${book}"`);
    const hit = list.find((e) => e.endChapter >= targetChapter);
    if (!hit) throw new Error(`No new-curriculum entry in "${book}" reaching chapter ${targetChapter}`);
    return hit.orderIndex;
  }

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`update curriculum_items set order_index = order_index + ${ARCHIVE_OFFSET}, season = 'legacy' where season is null`,
    );
    console.log(`Archived the current live rotation to the ${ARCHIVE_OFFSET}+ range.`);

    // The just-archived rows are still needed below to read what each profile's cursor pointed
    // at, so re-select them post-shift (orderIndex - ARCHIVE_OFFSET recovers the pre-shift value).
    const archivedLiveRows = await tx
      .select()
      .from(curriculumItems)
      .where(sql`${curriculumItems.season} = 'legacy' and ${curriculumItems.orderIndex} >= ${ARCHIVE_OFFSET}`);
    const oldItemByPosition = new Map<number, { book: string; passageRef: string }>();
    for (const row of archivedLiveRows) {
      oldItemByPosition.set(row.orderIndex - ARCHIVE_OFFSET, { book: row.book, passageRef: row.passageRef });
    }
    const oldCurriculumLength = oldItemByPosition.size;
    if (oldCurriculumLength === 0) throw new Error("No live rows found to archive — refusing to continue.");

    const allProfiles = await tx.select().from(profiles);
    for (const profile of allProfiles) {
      const oldPosition = profile.cursorPosition % oldCurriculumLength;
      const oldItem = oldItemByPosition.get(oldPosition);
      if (!oldItem) throw new Error(`No archived item at old position ${oldPosition} (profile ${profile.name})`);
      const { startChapter } = parsePassageRef(oldItem.passageRef);
      const newCursor = findNewCursor(oldItem.book, startChapter);
      await tx.update(profiles).set({ cursorPosition: newCursor }).where(sql`${profiles.id} = ${profile.id}`);
      console.log(
        `${profile.name}: cursor ${profile.cursorPosition} (old #${oldPosition} "${oldItem.passageRef}") -> ${newCursor} ("${STARTER_CURRICULUM[newCursor].passageRef}")`,
      );
    }

    await tx.delete(readings).where(sql`${readings.revealed} = false`);
    console.log(`Deleted stale hidden prefetch reading(s).`);

    await tx.insert(curriculumItems).values(STARTER_CURRICULUM.map((item, orderIndex) => ({ ...item, orderIndex })));
    console.log(`Inserted ${STARTER_CURRICULUM.length} new curriculum items at order_index 0..${STARTER_CURRICULUM.length - 1}.`);
  });

  const [{ count: liveCount }] = await db.execute<{ count: number }>(
    sql`select count(*)::int as count from curriculum_items where season is null`,
  );
  const [{ count: legacyCount }] = await db.execute<{ count: number }>(
    sql`select count(*)::int as count from curriculum_items where season = 'legacy'`,
  );
  const [{ count: seasonCount }] = await db.execute<{ count: number }>(
    sql`select count(*)::int as count from curriculum_items where season is not null and season != 'legacy'`,
  );
  console.log(`Post-migration counts — live rotation: ${liveCount}, legacy: ${legacyCount}, season: ${seasonCount}.`);
  if (liveCount !== STARTER_CURRICULUM.length) {
    throw new Error(`Expected ${STARTER_CURRICULUM.length} live rotation rows, found ${liveCount}`);
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));

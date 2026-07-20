// One-off migration for the curriculum rebuild (old ~50-entry thematic sampler, full of gaps like
// jumping from Genesis 13 straight to Genesis 15 -> new 1189-entry one-chapter-per-book
// curriculum, see src/db/curriculumData.ts). Run exactly once against production.
//
// What this does, in a single transaction:
//   1. Archives the old season rows (season IS NOT NULL) by shifting orderIndex +99000, landing
//      them at the new 100000+ range declared in src/db/seasonCurriculumData.ts. Same row ids,
//      same content — just renumbered, so existing readings' curriculumItemId FK stays valid.
//   2. Archives the old ~50 main-rotation rows (season IS NULL) by shifting orderIndex +90000 and
//      tagging season='legacy'. This retires them from the live rotation (curriculumLength is a
//      COUNT of season-IS-NULL rows, so a lingering season-NULL row anywhere would silently
//      re-inflate it and reintroduce old sparse content into future cycles) while keeping the row
//      itself intact, so historical readings' passageRef still resolves to what was actually
//      generated for them. progress.ts's getTouchedChapters() doesn't filter by season, so past
//      per-book progress stats are unaffected either way.
//   3. Remaps every profile's cursorPosition from its old-curriculum meaning to the equivalent
//      (book, chapter) position in the new curriculum, so nobody's "next reading" silently jumps
//      to an unrelated passage or re-reads something they already covered. cursorPosition always
//      means "the item about to be read next" (see buildReading in generateReading.ts), so this
//      maps to the *start* chapter of whatever old entry the profile's cursor was sitting on.
//   4. Deletes hidden (revealed=false) prefetch-buffer readings — they're an invisible
//      make-the-next-load-instant cache (see ensurePrefetchedNext), never shown to anyone, and
//      after the remap they'd reference the old scheme. Deleting is safe; the buffer regenerates
//      itself in the background against each profile's remapped cursor on next visit.
//   5. Inserts the new 1189-entry curriculum at orderIndex 0..1188 (now vacated by step 2).
//
// Run with: set -a && source .env.local && set +a && npx tsx scripts/rebuild-curriculum.ts
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { curriculumItems, profiles, readings } from "../src/db/schema";
import { STARTER_CURRICULUM } from "../src/db/curriculumData";
import { parsePassageRef } from "../src/lib/passageRef";

// The old curriculum being replaced, captured verbatim so the migration is self-contained and
// still correct even after src/db/curriculumData.ts has been overwritten with the new content.
const OLD_CURRICULUM: { theme: string; book: string; passageRef: string; testament: "old" | "new" }[] = [
  { theme: "창조", book: "Genesis", passageRef: "Genesis 1:1-2:3", testament: "old" },
  { theme: "사람의 자리", book: "Genesis", passageRef: "Genesis 2:4-25", testament: "old" },
  { theme: "타락", book: "Genesis", passageRef: "Genesis 3", testament: "old" },
  { theme: "형제 살인", book: "Genesis", passageRef: "Genesis 4", testament: "old" },
  { theme: "심판과 새 출발", book: "Genesis", passageRef: "Genesis 6:5-7:16", testament: "old" },
  { theme: "무지개 언약", book: "Genesis", passageRef: "Genesis 9", testament: "old" },
  { theme: "부르심", book: "Genesis", passageRef: "Genesis 12-13", testament: "old" },
  { theme: "믿음이라 여기신 것", book: "Genesis", passageRef: "Genesis 15", testament: "old" },
  { theme: "이삭을 바치라", book: "Genesis", passageRef: "Genesis 22:1-19", testament: "old" },
  { theme: "요셉의 꿈에서 총리까지", book: "Genesis", passageRef: "Genesis 37", testament: "old" },
  { theme: "너희는 나를 해하려 하였으나", book: "Genesis", passageRef: "Genesis 50:15-26", testament: "old" },
  { theme: "떨기나무의 부르심", book: "Exodus", passageRef: "Exodus 3", testament: "old" },
  { theme: "유월절", book: "Exodus", passageRef: "Exodus 12:1-32", testament: "old" },
  { theme: "홍해를 가르시다", book: "Exodus", passageRef: "Exodus 14:10-15:21", testament: "old" },
  { theme: "십계명", book: "Exodus", passageRef: "Exodus 19:16-20:21", testament: "old" },
  { theme: "함께하시겠다는 약속", book: "Exodus", passageRef: "Exodus 33:12-23", testament: "old" },
  { theme: "여호수아의 용기", book: "Joshua", passageRef: "Joshua 1-2", testament: "old" },
  { theme: "룻의 신실함", book: "Ruth", passageRef: "Ruth 1:15-2:23", testament: "old" },
  { theme: "다윗과 골리앗", book: "1 Samuel", passageRef: "1 Samuel 17:32-58", testament: "old" },
  { theme: "다윗의 회개", book: "Psalms", passageRef: "Psalm 51", testament: "old" },
  { theme: "여호와는 나의 목자시니", book: "Psalms", passageRef: "Psalm 23-25", testament: "old" },
  { theme: "네 마음을 다하여", book: "Proverbs", passageRef: "Proverbs 3", testament: "old" },
  { theme: "고난 속의 질문", book: "Job", passageRef: "Job 38", testament: "old" },
  { theme: "오실 왕에 대한 예언", book: "Isaiah", passageRef: "Isaiah 9:1-7", testament: "old" },
  { theme: "고난받는 종", book: "Isaiah", passageRef: "Isaiah 52:1-53:12", testament: "old" },
  { theme: "새 언약의 약속", book: "Jeremiah", passageRef: "Jeremiah 31:15-40", testament: "old" },
  { theme: "마른 뼈 골짜기", book: "Ezekiel", passageRef: "Ezekiel 37", testament: "old" },
  { theme: "풀무불 속에서", book: "Daniel", passageRef: "Daniel 3", testament: "old" },
  { theme: "선지자의 부르심", book: "Jonah", passageRef: "Jonah 1-2", testament: "old" },
  { theme: "예수의 탄생", book: "Luke", passageRef: "Luke 2:1-40", testament: "new" },
  { theme: "세례 요한과 광야의 시험", book: "Matthew", passageRef: "Matthew 4", testament: "new" },
  { theme: "산상수훈: 팔복", book: "Matthew", passageRef: "Matthew 5", testament: "new" },
  { theme: "무엇을 먹을까 입을까 염려하지 말라", book: "Matthew", passageRef: "Matthew 6:5-34", testament: "new" },
  { theme: "선한 사마리아인", book: "Luke", passageRef: "Luke 10:1-42", testament: "new" },
  { theme: "돌아온 탕자", book: "Luke", passageRef: "Luke 15", testament: "new" },
  { theme: "오병이어", book: "John", passageRef: "John 6:1-40", testament: "new" },
  { theme: "나는 부활이요 생명이니", book: "John", passageRef: "John 11:1-44", testament: "new" },
  { theme: "제자의 발을 씻기시다", book: "John", passageRef: "John 13:1-35", testament: "new" },
  { theme: "겟세마네의 기도", book: "Matthew", passageRef: "Matthew 26:36-75", testament: "new" },
  { theme: "십자가", book: "John", passageRef: "John 19:16-42", testament: "new" },
  { theme: "부활", book: "John", passageRef: "John 20:1-29", testament: "new" },
  { theme: "엠마오로 가는 길", book: "Luke", passageRef: "Luke 24:13-49", testament: "new" },
  { theme: "성령강림", book: "Acts", passageRef: "Acts 2:1-41", testament: "new" },
  { theme: "다메섹 도상의 회심", book: "Acts", passageRef: "Acts 9:1-31", testament: "new" },
  { theme: "사랑은", book: "1 Corinthians", passageRef: "1 Corinthians 13", testament: "new" },
  { theme: "은혜로 구원받았느니라", book: "Ephesians", passageRef: "Ephesians 2", testament: "new" },
  { theme: "아무것도 염려하지 말고", book: "Philippians", passageRef: "Philippians 4", testament: "new" },
  { theme: "믿음의 선한 싸움", book: "2 Timothy", passageRef: "2 Timothy 3-4", testament: "new" },
  { theme: "새 하늘과 새 땅", book: "Revelation", passageRef: "Revelation 21", testament: "new" },
];

async function main() {
  if (OLD_CURRICULUM.length !== 49) {
    throw new Error(`Expected 49 old entries, found ${OLD_CURRICULUM.length} — refusing to run.`);
  }

  const newIndexByBookChapter = new Map<string, number>();
  STARTER_CURRICULUM.forEach((item, idx) => {
    const { startChapter } = parsePassageRef(item.passageRef);
    newIndexByBookChapter.set(`${item.book}|${startChapter}`, idx);
  });

  await db.transaction(async (tx) => {
    await tx.execute(sql`update curriculum_items set order_index = order_index + 99000 where season is not null`);
    console.log(`Archived season rows to the 100000+ range.`);

    await tx.execute(
      sql`update curriculum_items set order_index = order_index + 90000, season = 'legacy' where season is null`,
    );
    console.log(`Archived legacy rows to the 90000+ range.`);

    const allProfiles = await tx.select().from(profiles);
    for (const profile of allProfiles) {
      const oldPosition = profile.cursorPosition % OLD_CURRICULUM.length;
      const oldItem = OLD_CURRICULUM[oldPosition];
      const { startChapter } = parsePassageRef(oldItem.passageRef);
      const key = `${oldItem.book}|${startChapter}`;
      const newCursor = newIndexByBookChapter.get(key);
      if (newCursor === undefined) {
        throw new Error(
          `No new-curriculum mapping for ${key} (profile ${profile.name}, old cursor ${profile.cursorPosition})`,
        );
      }
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

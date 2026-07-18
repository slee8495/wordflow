// One-off backfill: existing `readings` rows were written before two fixes landed —
// (1) fetchNltPassage() used to leave NLT API HTML junk (citation header, chapter headers,
// translator footnotes) baked into passage_text_en, and (2) passage_text_en_story didn't exist
// yet, so the English by-verse/story toggle had nothing to switch to. This re-fetches a clean
// passage_text_en and generates passage_text_en_story for every row still missing either,
// leaving every other field (Korean text, theme, story summary, etc.) untouched.
//
// Run with: set -a && source .env.local && set +a && npx tsx scripts/backfill-en-passage.ts
import { eq, or, isNull, like } from "drizzle-orm";
import { db } from "@/db";
import { readings, curriculumItems } from "@/db/schema";
import { fetchNltPassage } from "@/lib/bible";
import { generateEnglishStoryPassage } from "@/lib/generateReading";

async function main() {
  const rows = await db
    .select({
      id: readings.id,
      curriculumItemId: readings.curriculumItemId,
      passageRef: curriculumItems.passageRef,
    })
    .from(readings)
    .innerJoin(curriculumItems, eq(readings.curriculumItemId, curriculumItems.id))
    .where(or(isNull(readings.passageTextEnStory), like(readings.passageTextEn, "NLT API%")));

  console.log(`Backfilling ${rows.length} reading(s)...`);

  for (const row of rows) {
    try {
      const en = await fetchNltPassage(row.passageRef);
      const enStory = await generateEnglishStoryPassage(row.passageRef, en);
      await db
        .update(readings)
        .set({ passageTextEn: en, passageTextEnStory: enStory })
        .where(eq(readings.id, row.id));
      console.log(`OK   reading ${row.id} (${row.passageRef})`);
    } catch (err) {
      console.error(`FAIL reading ${row.id} (${row.passageRef}):`, err instanceof Error ? err.message : err);
    }
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));

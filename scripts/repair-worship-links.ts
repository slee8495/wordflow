// One-off repair: reading content is now shared/cached across every profile that reaches the
// same curriculum item (see buildReadingForItem in generateReading.ts) — great for cost, but it
// also means a bad worship-song match generated before the youtube.ts quality fixes (citation-
// style titles like "Ephesians Chapter 2 (...)" from scripture-narration channels, wrong-language
// results, unescaped HTML entities) is now permanently cached and would keep surfacing for every
// future reader of that chapter unless explicitly repaired.
//
// This re-runs searchWorshipSongs for every curriculum item whose cached worship link either:
//   - fails the current quality checks (would be rejected by pickWorship's filters today), or
//   - contains an HTML entity that was never decoded (e.g. "&#39;", "&amp;").
// and overwrites that link on every reading row sharing the curriculum item, so the fix reaches
// everyone who already has a cached copy, not just future reads.
//
// Run with: set -a && source .env.local && set +a && npx tsx scripts/repair-worship-links.ts
import { eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import { readings, type WorshipLink } from "../src/db/schema";
import { isSafeWorshipResult, searchWorshipSongs, type YoutubeResult } from "../src/lib/youtube";

// Imports the real check from youtube.ts instead of keeping a separate copy — a duplicated copy
// silently drifted out of sync the first time youtube.ts's rules were tightened (a repair run
// under the stale copy found nothing, even though the newly-added rules should have caught two
// more bad links). WorshipLink only stores {title, url} (no channelTitle), so this is checked
// with an empty channelTitle — a real gap versus the live search path, but every rule reported so
// far has been catchable from the title alone.
const HTML_ENTITY_PATTERN = /&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/;
function looksBad(link: WorshipLink | null, lang: "ko" | "en"): boolean {
  if (!link) return false;
  if (HTML_ENTITY_PATTERN.test(link.title)) return true;
  const asResult: YoutubeResult = { title: link.title, channelTitle: "", channelId: "", url: link.url };
  return !isSafeWorshipResult(asResult, lang);
}

async function main() {
  const rows = await db.execute<{
    curriculum_item_id: number;
    theme: string;
    theme_en: string;
    worship_link_ko: WorshipLink | null;
    worship_link_en: WorshipLink | null;
  }>(
    sql`select distinct on (curriculum_item_id) curriculum_item_id, theme, theme_en, worship_link_ko, worship_link_en
        from readings
        where worship_link_ko is not null or worship_link_en is not null
        order by curriculum_item_id, id desc`,
  );

  console.log(`Checking ${rows.length} curriculum item(s) with a cached worship link...`);

  let repaired = 0;
  for (const row of rows) {
    const badKo = looksBad(row.worship_link_ko, "ko");
    const badEn = looksBad(row.worship_link_en, "en");
    if (!badKo && !badEn) continue;

    const fresh = await searchWorshipSongs(row.theme, row.theme_en);
    const newKo = badKo ? (fresh.ko ? { title: fresh.ko.title, url: fresh.ko.url } : null) : row.worship_link_ko;
    const newEn = badEn ? (fresh.en ? { title: fresh.en.title, url: fresh.en.url } : null) : row.worship_link_en;

    await db
      .update(readings)
      .set({ worshipLinkKo: newKo, worshipLinkEn: newEn })
      .where(eq(readings.curriculumItemId, row.curriculum_item_id));

    repaired++;
    console.log(
      `item ${row.curriculum_item_id} (${row.theme_en}): ` +
        `${badKo ? `ko "${row.worship_link_ko?.title}" -> ${newKo ? `"${newKo.title}"` : "null"}` : "ko ok"}, ` +
        `${badEn ? `en "${row.worship_link_en?.title}" -> ${newEn ? `"${newEn.title}"` : "null"}` : "en ok"}`,
    );
  }

  console.log(`Done. Repaired ${repaired}/${rows.length} curriculum item(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));

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
import { searchWorshipSongs } from "../src/lib/youtube";

const HANGUL_PATTERN = /[가-힣]/;
const OTHER_SCRIPT_PATTERN = /[؀-ۿݐ-ݿ一-鿿぀-ヿЀ-ӿ֐-׿]/;
const CITATION_TITLE_PATTERN = /\bchapter\s*\d+\b|\d+\s*장\b/i;
const HTML_ENTITY_PATTERN = /&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/;
const EXCLUDE_CHANNELS = ["kononia", "koinonia watch"];
const EXCLUDE_TERMS = [
  "신부", "강론", "미사", "성당", "수녀", "발췌문", "큐티", "말씀나눔", "말씀 나눔", "강해", "설교", "새벽기도",
  "sermon", "devotional", "bible study", "scripture reading", "homily",
];

function looksBad(link: WorshipLink | null, lang: "ko" | "en"): boolean {
  if (!link) return false;
  const title = link.title.toLowerCase();
  if (HTML_ENTITY_PATTERN.test(link.title)) return true;
  if (CITATION_TITLE_PATTERN.test(link.title)) return true;
  if (EXCLUDE_TERMS.some((t) => title.includes(t))) return true;
  if (EXCLUDE_CHANNELS.some((t) => title.includes(t))) return true;
  const hasHangul = HANGUL_PATTERN.test(link.title);
  const hasOtherScript = OTHER_SCRIPT_PATTERN.test(link.title);
  if (lang === "ko") return !hasHangul;
  return hasHangul || hasOtherScript;
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

// One-off: fetches the real verse count for every chapter of every book from the NLT API (the
// same source src/lib/bible.ts uses for actual passage text), so the time-balanced curriculum
// chunker (scripts/rebuild-curriculum-by-time.ts) works off real numbers instead of an external
// versification table that might not match NLT's own verse boundaries.
//
// Run with: set -a && source .env.local && set +a && npx tsx scripts/fetch-verse-counts.ts
import { writeFileSync } from "node:fs";
import { BIBLE_BOOKS } from "../src/lib/bibleBooks";
import { fetchNltPassage } from "../src/lib/bible";

const CONCURRENCY = 8;

// The NLT API doesn't recognize "Song of Solomon" as a reference (returns empty) — "Song" works
// (same token curriculumData.ts's generator uses for that book's passageRef), so query with that.
function nltRefBook(book: string): string {
  return book === "Song of Solomon" ? "Song" : book;
}

async function fetchChapterVerseCount(book: string, chapter: number): Promise<number> {
  const text = await fetchNltPassage(`${nltRefBook(book)} ${chapter}`);
  const verseNumbers = [...text.matchAll(/\((\d+)\)/g)].map((m) => Number(m[1]));
  if (verseNumbers.length === 0) throw new Error(`No verses parsed for ${book} ${chapter}`);
  return Math.max(...verseNumbers);
}

async function main() {
  const jobs: { book: string; chapter: number }[] = [];
  for (const b of BIBLE_BOOKS) {
    for (let ch = 1; ch <= b.chapters; ch++) jobs.push({ book: b.name, chapter: ch });
  }

  const results: { book: string; chapter: number; verses: number }[] = [];
  let cursor = 0;
  let done = 0;

  async function worker() {
    for (;;) {
      const idx = cursor++;
      if (idx >= jobs.length) return;
      const { book, chapter } = jobs[idx];
      let verses: number | null = null;
      for (let attempt = 0; attempt < 3 && verses === null; attempt++) {
        try {
          verses = await fetchChapterVerseCount(book, chapter);
        } catch (err) {
          if (attempt === 2) {
            console.error(`FAILED ${book} ${chapter}:`, err instanceof Error ? err.message : err);
          }
        }
      }
      results.push({ book, chapter, verses: verses ?? 0 });
      done++;
      if (done % 100 === 0) console.log(`${done}/${jobs.length}...`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const failed = results.filter((r) => r.verses === 0);
  if (failed.length > 0) {
    console.error(`${failed.length} chapter(s) failed to fetch a verse count:`, failed);
    process.exit(1);
  }

  results.sort((a, b) => {
    const bookOrder = BIBLE_BOOKS.findIndex((x) => x.name === a.book) - BIBLE_BOOKS.findIndex((x) => x.name === b.book);
    return bookOrder !== 0 ? bookOrder : a.chapter - b.chapter;
  });

  writeFileSync("scripts/data/chapter-verse-counts.json", JSON.stringify(results, null, 2));
  console.log(`Wrote ${results.length} chapter verse counts to scripts/data/chapter-verse-counts.json`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));

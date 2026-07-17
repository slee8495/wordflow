// Report-only audit: fetches the NLT text for every curriculum entry, estimates spoken
// minutes at ~150 wpm, and for entries outside the 5-7 minute target suggests a mechanically
// widened/narrowed verse range (refetching NLT to confirm each candidate). Nothing is written
// back automatically — review the suggestions, then hand-edit src/db/curriculumData.ts and
// re-seed.
//
// Run with: set -a && source .env.local && set +a && npx tsx scripts/tune-curriculum-length.ts
import { fetchNltPassage } from "@/lib/bible";
import { STARTER_CURRICULUM } from "@/db/curriculumData";
import { parsePassageRef, type ParsedPassageRef } from "@/lib/passageRef";

const WORDS_PER_MINUTE = 150;
const TARGET_MIN = 5;
const TARGET_MAX = 7;
const TARGET_MID = 6;

function minutesFor(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length / WORDS_PER_MINUTE;
}

function buildRef(p: ParsedPassageRef): string {
  if (p.startVerse === null) {
    return p.startChapter === p.endChapter
      ? `${p.book} ${p.startChapter}`
      : `${p.book} ${p.startChapter}-${p.endChapter}`;
  }
  return p.startChapter === p.endChapter
    ? `${p.book} ${p.startChapter}:${p.startVerse}-${p.endVerse}`
    : `${p.book} ${p.startChapter}:${p.startVerse}-${p.endChapter}:${p.endVerse}`;
}

// Tries a handful of end-boundary extensions/contractions, in order, stopping as soon as one
// lands in [TARGET_MIN, TARGET_MAX]. This is a suggestion tool for human review, not a fully
// automated content pipeline — chapter-crossing extensions and theological boundary sense are
// left to the reviewer.
async function findBetterRange(entryRef: string): Promise<{ ref: string; minutes: number } | null> {
  const p = parsePassageRef(entryRef);
  const candidates: ParsedPassageRef[] = [];

  if (p.startVerse === null) {
    // Whole-chapter reference — only chapter-level extension is safe without knowing verse counts.
    for (const delta of [1, 2]) candidates.push({ ...p, endChapter: p.endChapter + delta });
  } else {
    const currentEnd = p.endVerse ?? p.startVerse;
    for (const delta of [8, 16, 24]) candidates.push({ ...p, endVerse: currentEnd + delta });
    for (const delta of [-8, -16, -24]) {
      const newEnd = currentEnd + delta;
      if (newEnd > p.startVerse) candidates.push({ ...p, endVerse: newEnd });
    }
  }

  let best: { ref: string; minutes: number } | null = null;
  for (const candidate of candidates) {
    const ref = buildRef(candidate);
    try {
      const text = await fetchNltPassage(ref);
      const minutes = minutesFor(text);
      if (minutes >= TARGET_MIN && minutes <= TARGET_MAX) return { ref, minutes };
      if (!best || Math.abs(minutes - TARGET_MID) < Math.abs(best.minutes - TARGET_MID)) {
        best = { ref, minutes };
      }
    } catch {
      // Candidate range invalid (e.g. past the chapter's last verse) — skip it.
    }
  }
  return best;
}

async function main() {
  console.log(
    `Auditing ${STARTER_CURRICULUM.length} curriculum entries against a ${TARGET_MIN}-${TARGET_MAX} min target (${WORDS_PER_MINUTE} wpm)...\n`,
  );

  const outOfBand: { theme: string; ref: string; minutes: number }[] = [];

  for (const item of STARTER_CURRICULUM) {
    const text = await fetchNltPassage(item.passageRef);
    const minutes = minutesFor(text);
    const inBand = minutes >= TARGET_MIN && minutes <= TARGET_MAX;
    console.log(`${inBand ? "OK  " : "FLAG"} ${item.passageRef.padEnd(28)} ${minutes.toFixed(1)} min  (${item.theme})`);
    if (!inBand) outOfBand.push({ theme: item.theme, ref: item.passageRef, minutes });
  }

  if (outOfBand.length === 0) {
    console.log("\nAll entries are within the 5-7 minute target. Nothing to suggest.");
    return;
  }

  console.log(`\n--- Suggested adjustments for ${outOfBand.length} out-of-band entries ---\n`);
  for (const entry of outOfBand) {
    const suggestion = await findBetterRange(entry.ref);
    if (suggestion) {
      console.log(
        `${entry.ref}  (${entry.minutes.toFixed(1)} min)  ->  ${suggestion.ref}  (${suggestion.minutes.toFixed(1)} min)  [${entry.theme}]`,
      );
    } else {
      console.log(`${entry.ref}  (${entry.minutes.toFixed(1)} min)  ->  NEEDS MANUAL REVIEW  [${entry.theme}]`);
    }
  }
  console.log(
    "\nThis is a report only — nothing has been changed. Review the suggestions, then update " +
      "src/db/curriculumData.ts by hand and re-seed.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

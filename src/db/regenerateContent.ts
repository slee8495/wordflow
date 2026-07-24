// One-off maintenance script: re-runs generateFreshContent() for every curriculum item that
// already has generated content, overwriting the stored theme/story/context/message/passage text/
// worship pick shared by every reading row that points at it. Run after a prompt/quality fix
// (see KOREAN_STYLE_GUIDANCE in generateReading.ts) so already-generated content picks up the fix
// too, not just content generated from here on.
//
// Resumable: each completed item's id is appended to PROGRESS_FILE as it finishes, so a kill/crash
// partway through doesn't lose work — re-running the script skips ids already in that file instead
// of starting over. Delete the file (or pass FRESH=1) to force a full re-run from scratch.
import { existsSync, appendFileSync, readFileSync, rmSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { curriculumItems, readings } from "./schema";
import { generateFreshContent } from "@/lib/generateReading";

const PROGRESS_FILE = "/tmp/wordflow-regenerate-content-progress.txt";

async function main() {
  if (process.env.FRESH === "1" && existsSync(PROGRESS_FILE)) rmSync(PROGRESS_FILE);

  const done = new Set(
    existsSync(PROGRESS_FILE)
      ? readFileSync(PROGRESS_FILE, "utf-8").split("\n").filter(Boolean).map(Number)
      : [],
  );

  const rows = await db
    .selectDistinct({
      id: curriculumItems.id,
      book: curriculumItems.book,
      passageRef: curriculumItems.passageRef,
      orderIndex: curriculumItems.orderIndex,
    })
    .from(readings)
    .innerJoin(curriculumItems, eq(curriculumItems.id, readings.curriculumItemId))
    .orderBy(curriculumItems.orderIndex);

  const remaining = rows.filter((r) => !done.has(r.id));
  console.log(`${rows.length} curriculum items total, ${done.size} already done, ${remaining.length} remaining...`);

  for (const [i, item] of remaining.entries()) {
    const [fullItem] = await db.select().from(curriculumItems).where(eq(curriculumItems.id, item.id)).limit(1);
    if (!fullItem) continue;

    const content = await generateFreshContent(fullItem);
    await db.update(readings).set(content).where(eq(readings.curriculumItemId, item.id));
    appendFileSync(PROGRESS_FILE, `${item.id}\n`);
    console.log(`[${i + 1}/${remaining.length}] ${item.book} ${item.passageRef} — done`);
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));

import { sql } from "drizzle-orm";
import { db } from "./index";
import { curriculumItems } from "./schema";
import { STARTER_CURRICULUM } from "./curriculumData";

async function seed() {
  await db
    .insert(curriculumItems)
    .values(STARTER_CURRICULUM.map((item, orderIndex) => ({ ...item, orderIndex })))
    .onConflictDoUpdate({
      target: curriculumItems.orderIndex,
      set: {
        theme: sql`excluded.theme`,
        book: sql`excluded.book`,
        passageRef: sql`excluded.passage_ref`,
        testament: sql`excluded.testament`,
      },
    });
  console.log(`Seeded/updated ${STARTER_CURRICULUM.length} curriculum items.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

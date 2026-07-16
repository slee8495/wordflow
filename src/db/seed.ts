import { db } from "./index";
import { curriculumItems } from "./schema";

// Starter theme-curated curriculum — a narrative arc through the Bible rather than book order,
// short enough (~5 min read/listen each) to add momentum early. This is a first pass covering
// the big turning points; expand freely, the cursor just loops through however many rows exist.
const STARTER_CURRICULUM: {
  theme: string;
  book: string;
  passageRef: string;
  testament: "old" | "new";
}[] = [
  { theme: "창조", book: "Genesis", passageRef: "Genesis 1:1-2:3", testament: "old" },
  { theme: "사람의 자리", book: "Genesis", passageRef: "Genesis 2:4-25", testament: "old" },
  { theme: "타락", book: "Genesis", passageRef: "Genesis 3", testament: "old" },
  { theme: "형제 살인", book: "Genesis", passageRef: "Genesis 4:1-16", testament: "old" },
  { theme: "심판과 새 출발", book: "Genesis", passageRef: "Genesis 6:5-22", testament: "old" },
  { theme: "무지개 언약", book: "Genesis", passageRef: "Genesis 9:1-17", testament: "old" },
  { theme: "부르심", book: "Genesis", passageRef: "Genesis 12:1-9", testament: "old" },
  { theme: "믿음이라 여기신 것", book: "Genesis", passageRef: "Genesis 15", testament: "old" },
  { theme: "이삭을 바치라", book: "Genesis", passageRef: "Genesis 22:1-19", testament: "old" },
  { theme: "요셉의 꿈에서 총리까지", book: "Genesis", passageRef: "Genesis 37:1-11", testament: "old" },
  { theme: "너희는 나를 해하려 하였으나", book: "Genesis", passageRef: "Genesis 50:15-21", testament: "old" },
  { theme: "떨기나무의 부르심", book: "Exodus", passageRef: "Exodus 3:1-15", testament: "old" },
  { theme: "유월절", book: "Exodus", passageRef: "Exodus 12:1-14", testament: "old" },
  { theme: "홍해를 가르시다", book: "Exodus", passageRef: "Exodus 14:10-31", testament: "old" },
  { theme: "십계명", book: "Exodus", passageRef: "Exodus 20:1-17", testament: "old" },
  { theme: "함께하시겠다는 약속", book: "Exodus", passageRef: "Exodus 33:12-23", testament: "old" },
  { theme: "여호수아의 용기", book: "Joshua", passageRef: "Joshua 1:1-9", testament: "old" },
  { theme: "룻의 신실함", book: "Ruth", passageRef: "Ruth 1:15-18", testament: "old" },
  { theme: "다윗과 골리앗", book: "1 Samuel", passageRef: "1 Samuel 17:32-50", testament: "old" },
  { theme: "다윗의 회개", book: "Psalms", passageRef: "Psalm 51:1-12", testament: "old" },
  { theme: "여호와는 나의 목자시니", book: "Psalms", passageRef: "Psalm 23", testament: "old" },
  { theme: "네 마음을 다하여", book: "Proverbs", passageRef: "Proverbs 3:1-12", testament: "old" },
  { theme: "고난 속의 질문", book: "Job", passageRef: "Job 38:1-18", testament: "old" },
  { theme: "오실 왕에 대한 예언", book: "Isaiah", passageRef: "Isaiah 9:1-7", testament: "old" },
  { theme: "고난받는 종", book: "Isaiah", passageRef: "Isaiah 53", testament: "old" },
  { theme: "새 언약의 약속", book: "Jeremiah", passageRef: "Jeremiah 31:31-34", testament: "old" },
  { theme: "마른 뼈 골짜기", book: "Ezekiel", passageRef: "Ezekiel 37:1-14", testament: "old" },
  { theme: "풀무불 속에서", book: "Daniel", passageRef: "Daniel 3", testament: "old" },
  { theme: "선지자의 부르심", book: "Jonah", passageRef: "Jonah 1-2", testament: "old" },
  { theme: "예수의 탄생", book: "Luke", passageRef: "Luke 2:1-20", testament: "new" },
  { theme: "세례 요한과 광야의 시험", book: "Matthew", passageRef: "Matthew 4:1-11", testament: "new" },
  { theme: "산상수훈: 팔복", book: "Matthew", passageRef: "Matthew 5:1-12", testament: "new" },
  { theme: "무엇을 먹을까 입을까 염려하지 말라", book: "Matthew", passageRef: "Matthew 6:25-34", testament: "new" },
  { theme: "선한 사마리아인", book: "Luke", passageRef: "Luke 10:25-37", testament: "new" },
  { theme: "돌아온 탕자", book: "Luke", passageRef: "Luke 15:11-32", testament: "new" },
  { theme: "오병이어", book: "John", passageRef: "John 6:1-14", testament: "new" },
  { theme: "나는 부활이요 생명이니", book: "John", passageRef: "John 11:1-44", testament: "new" },
  { theme: "제자의 발을 씻기시다", book: "John", passageRef: "John 13:1-17", testament: "new" },
  { theme: "겟세마네의 기도", book: "Matthew", passageRef: "Matthew 26:36-46", testament: "new" },
  { theme: "십자가", book: "John", passageRef: "John 19:16-30", testament: "new" },
  { theme: "부활", book: "John", passageRef: "John 20:1-18", testament: "new" },
  { theme: "엠마오로 가는 길", book: "Luke", passageRef: "Luke 24:13-35", testament: "new" },
  { theme: "성령강림", book: "Acts", passageRef: "Acts 2:1-21", testament: "new" },
  { theme: "다메섹 도상의 회심", book: "Acts", passageRef: "Acts 9:1-19", testament: "new" },
  { theme: "사랑은", book: "1 Corinthians", passageRef: "1 Corinthians 13", testament: "new" },
  { theme: "은혜로 구원받았느니라", book: "Ephesians", passageRef: "Ephesians 2:1-10", testament: "new" },
  { theme: "아무것도 염려하지 말고", book: "Philippians", passageRef: "Philippians 4:4-9", testament: "new" },
  { theme: "믿음의 선한 싸움", book: "2 Timothy", passageRef: "2 Timothy 4:1-8", testament: "new" },
  { theme: "새 하늘과 새 땅", book: "Revelation", passageRef: "Revelation 21:1-8", testament: "new" },
];

async function seed() {
  await db
    .insert(curriculumItems)
    .values(STARTER_CURRICULUM.map((item, orderIndex) => ({ ...item, orderIndex })))
    .onConflictDoNothing();
  console.log(`Seeded ${STARTER_CURRICULUM.length} curriculum items.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

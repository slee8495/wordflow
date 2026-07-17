// Starter theme-curated curriculum — a narrative arc through the Bible rather than book order,
// short enough (~5 min read/listen each) to add momentum early. This is a first pass covering
// the big turning points; expand freely, the cursor just loops through however many rows exist.
//
// Split out from seed.ts (which has a top-level side-effecting seed() call on import) so this
// data can also be imported by scripts/tune-curriculum-length.ts without triggering a seed run.
export const STARTER_CURRICULUM: {
  theme: string;
  book: string;
  passageRef: string;
  testament: "old" | "new";
}[] = [
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

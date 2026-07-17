// Season-tagged curriculum entries — Holy Week, Christmas, and US Thanksgiving. These live in
// the same curriculum_items table as the normal thematic rotation but are never part of it:
// orderIndex uses a dedicated 1000+ range so they can never collide with the normal 0..48
// rotation, and every query that walks the normal cursor filters `season IS NULL` (see
// src/lib/generateReading.ts and src/lib/progress.ts). Looked up by (season, seasonDayIndex)
// via getActiveSeason() in src/lib/season.ts.
export const SEASON_CURRICULUM: {
  orderIndex: number;
  season: "holy_week" | "christmas" | "thanksgiving";
  seasonDayIndex: number;
  theme: string;
  book: string;
  passageRef: string;
  testament: "old" | "new";
}[] = [
  // Holy Week — Palm Sunday through Easter Sunday, 8 days.
  { orderIndex: 1000, season: "holy_week", seasonDayIndex: 0, theme: "종려주일 · 예루살렘 입성", book: "Matthew", passageRef: "Matthew 21:1-11", testament: "new" },
  { orderIndex: 1001, season: "holy_week", seasonDayIndex: 1, theme: "성전을 깨끗하게 하시다", book: "Matthew", passageRef: "Matthew 21:12-22", testament: "new" },
  { orderIndex: 1002, season: "holy_week", seasonDayIndex: 2, theme: "배신의 그림자", book: "Matthew", passageRef: "Matthew 26:1-16", testament: "new" },
  { orderIndex: 1003, season: "holy_week", seasonDayIndex: 3, theme: "마지막 밤의 시작", book: "John", passageRef: "John 13:1-30", testament: "new" },
  { orderIndex: 1004, season: "holy_week", seasonDayIndex: 4, theme: "최후의 만찬과 겟세마네", book: "Matthew", passageRef: "Matthew 26:26-46", testament: "new" },
  { orderIndex: 1005, season: "holy_week", seasonDayIndex: 5, theme: "십자가에 달리시다", book: "Matthew", passageRef: "Matthew 27:11-54", testament: "new" },
  { orderIndex: 1006, season: "holy_week", seasonDayIndex: 6, theme: "무덤에 누우시다", book: "Matthew", passageRef: "Matthew 27:57-66", testament: "new" },
  { orderIndex: 1007, season: "holy_week", seasonDayIndex: 7, theme: "부활하셨습니다", book: "Matthew", passageRef: "Matthew 28:1-10", testament: "new" },

  // Christmas — Dec 19-25, 7 days.
  { orderIndex: 1100, season: "christmas", seasonDayIndex: 0, theme: "마리아에게 하신 약속", book: "Luke", passageRef: "Luke 1:26-38", testament: "new" },
  { orderIndex: 1101, season: "christmas", seasonDayIndex: 1, theme: "마리아의 찬가", book: "Luke", passageRef: "Luke 1:39-56", testament: "new" },
  { orderIndex: 1102, season: "christmas", seasonDayIndex: 2, theme: "요셉의 순종", book: "Matthew", passageRef: "Matthew 1:18-25", testament: "new" },
  { orderIndex: 1103, season: "christmas", seasonDayIndex: 3, theme: "빛으로 오실 왕", book: "Isaiah", passageRef: "Isaiah 9:2-7", testament: "old" },
  { orderIndex: 1104, season: "christmas", seasonDayIndex: 4, theme: "베들레헴의 예언", book: "Micah", passageRef: "Micah 5:2-5", testament: "old" },
  { orderIndex: 1105, season: "christmas", seasonDayIndex: 5, theme: "예수의 탄생", book: "Luke", passageRef: "Luke 2:1-7", testament: "new" },
  { orderIndex: 1106, season: "christmas", seasonDayIndex: 6, theme: "목자들과 천사들", book: "Luke", passageRef: "Luke 2:8-20", testament: "new" },

  // Thanksgiving — Tue/Wed/Thu of Thanksgiving week, 3 days.
  { orderIndex: 1200, season: "thanksgiving", seasonDayIndex: 0, theme: "감사의 시편", book: "Psalms", passageRef: "Psalm 100", testament: "old" },
  { orderIndex: 1201, season: "thanksgiving", seasonDayIndex: 1, theme: "잊지 말라", book: "Deuteronomy", passageRef: "Deuteronomy 8:7-18", testament: "old" },
  { orderIndex: 1202, season: "thanksgiving", seasonDayIndex: 2, theme: "모든 일에 감사하라", book: "2 Corinthians", passageRef: "2 Corinthians 9:6-15", testament: "new" },
];

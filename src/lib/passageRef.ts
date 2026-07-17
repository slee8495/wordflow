// Parses the human-readable passageRef strings used throughout the curriculum
// ("Genesis 1:1-2:3", "Genesis 3", "Jonah 1-2", "1 Corinthians 13") into a structured
// shape, and formats them back out as short Korean/English citations for display.

export type ParsedPassageRef = {
  book: string;
  startChapter: number;
  startVerse: number | null;
  endChapter: number;
  endVerse: number | null;
};

const REF_PATTERN = /^((?:[1-3]\s)?[A-Za-z]+)\s+(\d+)(?::(\d+))?(?:-(\d+)(?::(\d+))?)?$/;

export function parsePassageRef(ref: string): ParsedPassageRef {
  const match = ref.trim().match(REF_PATTERN);
  if (!match) throw new Error(`Unrecognized passage reference: "${ref}"`);
  const [, book, chapterStr, verseStr, dashNumStr, dashVerseStr] = match;

  const startChapter = Number(chapterStr);
  const startVerse = verseStr ? Number(verseStr) : null;

  if (startVerse === null) {
    // Chapter-only reference, optionally a chapter range ("Genesis 3" / "Jonah 1-2").
    const endChapter = dashNumStr ? Number(dashNumStr) : startChapter;
    return { book, startChapter, startVerse: null, endChapter, endVerse: null };
  }

  if (!dashNumStr) {
    // Single verse, no range.
    return { book, startChapter, startVerse, endChapter: startChapter, endVerse: startVerse };
  }

  if (dashVerseStr) {
    // "1:1-2:3" — range crosses chapters.
    return {
      book,
      startChapter,
      startVerse,
      endChapter: Number(dashNumStr),
      endVerse: Number(dashVerseStr),
    };
  }

  // "17:32-50" — verse range within the same chapter.
  return { book, startChapter, startVerse, endChapter: startChapter, endVerse: Number(dashNumStr) };
}

// Standard 66-book abbreviations. Keyed by every spelling that shows up in passageRef
// strings — includes both "Psalm" and "Psalms" since the curriculum uses "Psalm" in
// passageRef but "Psalms" in the book field.
export const KOREAN_BOOK_ABBREV: Record<string, string> = {
  Genesis: "창", Exodus: "출", Leviticus: "레", Numbers: "민", Deuteronomy: "신",
  Joshua: "수", Judges: "삿", Ruth: "룻", "1 Samuel": "삼상", "2 Samuel": "삼하",
  "1 Kings": "왕상", "2 Kings": "왕하", "1 Chronicles": "대상", "2 Chronicles": "대하",
  Ezra: "스", Nehemiah: "느", Esther: "에", Job: "욥", Psalm: "시", Psalms: "시",
  Proverbs: "잠", Ecclesiastes: "전", "Song of Solomon": "아", Isaiah: "사",
  Jeremiah: "렘", Lamentations: "애", Ezekiel: "겔", Daniel: "단", Hosea: "호",
  Joel: "욜", Amos: "암", Obadiah: "옵", Jonah: "욘", Micah: "미", Nahum: "나",
  Habakkuk: "합", Zephaniah: "습", Haggai: "학", Zechariah: "슥", Malachi: "말",
  Matthew: "마", Mark: "막", Luke: "눅", John: "요", Acts: "행", Romans: "롬",
  "1 Corinthians": "고전", "2 Corinthians": "고후", Galatians: "갈", Ephesians: "엡",
  Philippians: "빌", Colossians: "골", "1 Thessalonians": "살전", "2 Thessalonians": "살후",
  "1 Timothy": "딤전", "2 Timothy": "딤후", Titus: "딛", Philemon: "몬", Hebrews: "히",
  James: "약", "1 Peter": "벧전", "2 Peter": "벧후", "1 John": "요일", "2 John": "요이",
  "3 John": "요삼", Jude: "유", Revelation: "계",
};

export const ENGLISH_BOOK_ABBREV: Record<string, string> = {
  Genesis: "Gen", Exodus: "Exod", Leviticus: "Lev", Numbers: "Num", Deuteronomy: "Deut",
  Joshua: "Josh", Judges: "Judg", Ruth: "Ruth", "1 Samuel": "1 Sam", "2 Samuel": "2 Sam",
  "1 Kings": "1 Kgs", "2 Kings": "2 Kgs", "1 Chronicles": "1 Chr", "2 Chronicles": "2 Chr",
  Ezra: "Ezra", Nehemiah: "Neh", Esther: "Esth", Job: "Job", Psalm: "Ps", Psalms: "Ps",
  Proverbs: "Prov", Ecclesiastes: "Eccl", "Song of Solomon": "Song", Isaiah: "Isa",
  Jeremiah: "Jer", Lamentations: "Lam", Ezekiel: "Ezek", Daniel: "Dan", Hosea: "Hos",
  Joel: "Joel", Amos: "Amos", Obadiah: "Obad", Jonah: "Jonah", Micah: "Mic", Nahum: "Nah",
  Habakkuk: "Hab", Zephaniah: "Zeph", Haggai: "Hag", Zechariah: "Zech", Malachi: "Mal",
  Matthew: "Matt", Mark: "Mark", Luke: "Luke", John: "John", Acts: "Acts", Romans: "Rom",
  "1 Corinthians": "1 Cor", "2 Corinthians": "2 Cor", Galatians: "Gal", Ephesians: "Eph",
  Philippians: "Phil", Colossians: "Col", "1 Thessalonians": "1 Thess",
  "2 Thessalonians": "2 Thess", "1 Timothy": "1 Tim", "2 Timothy": "2 Tim", Titus: "Titus",
  Philemon: "Phlm", Hebrews: "Heb", James: "Jas", "1 Peter": "1 Pet", "2 Peter": "2 Pet",
  "1 John": "1 John", "2 John": "2 John", "3 John": "3 John", Jude: "Jude", Revelation: "Rev",
};

export function formatPassageRefKorean(ref: string): string {
  const p = parsePassageRef(ref);
  const abbr = KOREAN_BOOK_ABBREV[p.book] ?? p.book;

  if (p.startVerse === null) {
    return p.startChapter === p.endChapter
      ? `${abbr} ${p.startChapter}`
      : `${abbr} ${p.startChapter} ~ ${abbr} ${p.endChapter}`;
  }

  const start = `${abbr} ${p.startChapter}:${p.startVerse}`;
  const end = `${abbr} ${p.endChapter}:${p.endVerse}`;
  return start === end ? start : `${start} ~ ${end}`;
}

export function formatPassageRefEnglish(ref: string): string {
  const p = parsePassageRef(ref);
  const abbr = ENGLISH_BOOK_ABBREV[p.book] ?? p.book;

  if (p.startVerse === null) {
    return p.startChapter === p.endChapter
      ? `${abbr} ${p.startChapter}`
      : `${abbr} ${p.startChapter}–${p.endChapter}`;
  }

  if (p.startChapter === p.endChapter) {
    return p.startVerse === p.endVerse
      ? `${abbr} ${p.startChapter}:${p.startVerse}`
      : `${abbr} ${p.startChapter}:${p.startVerse}-${p.endVerse}`;
  }
  return `${abbr} ${p.startChapter}:${p.startVerse}–${p.endChapter}:${p.endVerse}`;
}

// App-chrome translations (nav, buttons, labels, hints). Deliberately separate from the Bible
// content language (the 한글/English toggle on the Today/Reading pages) — that toggle picks which
// language the passage text itself is fetched/generated in and is untouched by this file.
export type Lang = "ko" | "en";

export const UI_LANG_STORAGE_KEY = "wordflow:uiLang";
export const DEFAULT_UI_LANG: Lang = "ko";

const STRINGS = {
  "nav.today": { ko: "오늘", en: "Today" },
  "nav.reading": { ko: "읽기", en: "Reading" },
  "nav.settingsLabel": { ko: "설정", en: "Settings" },

  "login.prompt": {
    ko: "이름을 입력하면 읽기 진도가 저장돼요.",
    en: "Enter your name to save your reading progress.",
  },
  "login.namePlaceholder": { ko: "이름", en: "Name" },
  "login.start": { ko: "시작", en: "Start" },
  "login.submit": { ko: "로그인", en: "Log in" },

  "today.changeName": { ko: "이름 변경", en: "Change name" },
  "today.preparing": { ko: "오늘의 말씀 준비 중…", en: "Preparing today's reading…" },
  "today.previousPassage": { ko: "이전 본문", en: "Previous passage" },
  "today.nextPassage": { ko: "다음 본문", en: "Next passage" },
  "today.passageTitle": { ko: "오늘의 본문", en: "Today's Passage" },
  "today.storyTitle": { ko: "오늘의 이야기", en: "Today's Story" },
  "today.contextTitle": { ko: "배경 설명", en: "Context & Background" },
  "today.messageTitle": { ko: "오늘의 메시지", en: "Today's Message" },
  "today.worshipTitle": { ko: "찬양", en: "Worship" },
  "today.byVerse": { ko: "절별로", en: "By Verse" },
  "today.asStory": { ko: "이야기로", en: "As a Story" },
  "today.doneReadNext": {
    ko: "오늘 완료 — 다음 본문 읽기 →",
    en: "Done for today — read the next passage →",
  },
  "today.generating": { ko: "생성 중…", en: "Generating…" },

  "settings.title": { ko: "설정", en: "Settings" },
  "settings.account": { ko: "계정", en: "Account" },
  "settings.logout": { ko: "로그아웃", en: "Log out" },
  "settings.nameHint": {
    ko: "지금은 이름이 로그인 역할을 해요 — 이 이름으로 읽기 진도가 저장돼요.",
    en: "Your name is your login for now — it's how your reading progress is saved.",
  },
  "settings.fontSize": { ko: "글자 크기", en: "Font Size" },
  "settings.fontSizeHint": { ko: "앱 전체에 바로 적용돼요.", en: "Applies across the whole app instantly." },
  "settings.uiLanguage": { ko: "앱 언어", en: "App Language" },
  "settings.uiLanguageHint": {
    ko: "앱의 메뉴와 버튼 문구 언어예요. 성경 본문 언어는 각 화면에서 따로 선택해요.",
    en: "Changes the app's menus and labels. Bible passage language is chosen separately on each page.",
  },
  "settings.fontScale.small": { ko: "작게", en: "Small" },
  "settings.fontScale.default": { ko: "기본", en: "Default" },
  "settings.fontScale.large": { ko: "크게", en: "Large" },
  "settings.fontScale.xlarge": { ko: "더 크게", en: "X-Large" },
  "settings.fontScale.xxlarge": { ko: "아주 크게", en: "2X-Large" },
  "settings.fontScale.xxxlarge": { ko: "최대로 크게", en: "3X-Large" },

  "progress.cyclesCompleted": { ko: "완료한 사이클", en: "Cycles completed" },
  "progress.projectedCompletion": { ko: "예상 완료일", en: "Projected completion" },
  "progress.notEnoughData": { ko: "아직 데이터가 부족해요", en: "Not enough data yet" },
  "progress.showing": { ko: "보기:", en: "Showing:" },
  "progress.thisCycle": { ko: "이번 사이클", en: "This cycle" },
  "progress.allTime": { ko: "전체 기간", en: "All time" },
  "progress.booksTouched": { ko: "읽은 책", en: "Books touched" },
  "progress.startReadingHint": {
    ko: "읽기를 시작하면 여기에 진행 상황이 표시돼요.",
    en: "Start reading to see your progress here.",
  },
  "progress.oldTestament": { ko: "구약", en: "Old Testament" },
  "progress.newTestament": { ko: "신약", en: "New Testament" },
  "progress.loading": { ko: "진행 상황 불러오는 중…", en: "Loading progress…" },

  "reading.browseTab": { ko: "찾아보기", en: "Browse" },
  "reading.progressTab": { ko: "진행 상황", en: "Progress" },
  "reading.backToBooks": { ko: "← 목록", en: "← Books" },
  "reading.loading": { ko: "불러오는 중…", en: "Loading…" },
  "reading.resume": { ko: "이어 듣기", en: "Resume" },
  "reading.pause": { ko: "일시정지", en: "Pause" },
  "reading.stop": { ko: "정지", en: "Stop" },

  "chat.title": { ko: "🤖 말씀·교회 Q&A", en: "🤖 Bible & Church Q&A" },
  "chat.readAloudToggle": { ko: "답변 읽어주기", en: "Read replies aloud" },
  "chat.emptyHint": {
    ko: '"오늘 본문 다시 설명해줘", "위로가 되는 찬양 추천해줘"처럼 물어보세요.',
    en: 'Try asking things like "Explain today\'s passage," or "Recommend a comforting worship song."',
  },
  "chat.thinking": { ko: "생각 중…", en: "Thinking…" },
  "chat.resume": { ko: "이어 듣기", en: "Resume" },
  "chat.pause": { ko: "일시정지", en: "Pause" },
  "chat.stopListening": { ko: "그만 듣기", en: "Stop" },
  "chat.inputListening": { ko: "듣고 있어요…", en: "Listening…" },
  "chat.inputTranscribing": { ko: "변환 중…", en: "Transcribing…" },
  "chat.inputPlaceholder": { ko: "질문을 입력하세요…", en: "Type your question…" },
  "chat.stopRecording": { ko: "녹음 중지", en: "Stop recording" },
  "chat.askByVoice": { ko: "음성으로 질문하기", en: "Ask by voice" },
  "chat.send": { ko: "전송", en: "Send" },
  "chat.readThisReply": { ko: "이 답변 읽어주기", en: "Read this reply aloud" },
  "chat.listen": { ko: "읽어주기", en: "Listen" },
  "chat.toggle": { ko: "채팅", en: "Chat" },

  "errors.loadToday": { ko: "오늘의 말씀을 불러오지 못했어요.", en: "Failed to load today's reading." },
  "errors.loadNext": { ko: "다음 본문을 생성하지 못했어요.", en: "Failed to generate the next reading." },
  "errors.loadProgress": { ko: "진행 상황을 불러오지 못했어요.", en: "Failed to load progress." },
  "errors.loadPassage": { ko: "본문을 불러오지 못했어요.", en: "Failed to load passage." },
} as const;

export type UiStringKey = keyof typeof STRINGS;

export function translate(lang: Lang, key: UiStringKey): string {
  return STRINGS[key][lang];
}

export function greeting(lang: Lang, name: string): string {
  return lang === "ko" ? `${name}님, 안녕하세요 — 오늘의 말씀` : `Hi ${name} — today's reading`;
}

export function passageOfLabel(lang: Lang, index: number, total: number): string {
  return lang === "ko" ? `오늘 본문 ${index}/${total}` : `Passage ${index} of ${total} today`;
}

export function loggedInAs(lang: Lang, name: string): string {
  return lang === "ko" ? `${name}(으)로 로그인됨` : `Logged in as ${name}`;
}

export function fontScaleLabelKey(value: number): UiStringKey {
  if (value <= 0.875) return "settings.fontScale.small";
  if (value <= 1) return "settings.fontScale.default";
  if (value <= 1.125) return "settings.fontScale.large";
  if (value <= 1.25) return "settings.fontScale.xlarge";
  if (value <= 1.375) return "settings.fontScale.xxlarge";
  return "settings.fontScale.xxxlarge";
}

export function booksTouchedSublabel(lang: Lang, count: number): string {
  return lang === "ko" ? `66권 중 ${count}권` : `${count}/66 books`;
}

export function currentlyIn(lang: Lang, book: string): string {
  return lang === "ko" ? `현재 읽는 중: ${book}` : `Currently in: ${book}`;
}

export function chaptersSublabel(lang: Lang, touched: number, total: number | string): string {
  return lang === "ko" ? `${total}장 중 ${touched}장` : `${touched}/${total} chapters`;
}

export function readingActivityHeading(lang: Lang, count: number, scope: "cycle" | "all"): string {
  if (lang === "ko") {
    return `🔥 ${scope === "cycle" ? "이번 사이클" : "전체 기간"} 읽은 횟수: ${count}회`;
  }
  const plural = count === 1 ? "" : "s";
  return `🔥 ${count} reading${plural} ${scope === "cycle" ? "this cycle" : "all time"}`;
}

export function listenToAria(lang: Lang, book: string, chapter: number): string {
  return lang === "ko" ? `${book} ${chapter}장 듣기` : `Listen to ${book} ${chapter}`;
}

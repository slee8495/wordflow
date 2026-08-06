// App-chrome translations (nav, buttons, labels, hints). Deliberately separate from the Bible
// content language (the 한글/English toggle on the Today/Reading pages) — that toggle picks which
// language the passage text itself is fetched/generated in and is untouched by this file.
export type Lang = "ko" | "en";

export const UI_LANG_STORAGE_KEY = "wordflow:uiLang";
export const DEFAULT_UI_LANG: Lang = "en";

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
  "login.loading": { ko: "불러오는 중…", en: "Loading…" },
  "login.signInWithGoogle": { ko: "Google로 로그인", en: "Sign in with Google" },
  "login.claimTitle": {
    ko: "기존에 쓰던 이름이 있나요?",
    en: "Do you have an existing name you used before?",
  },
  "login.claimHint": {
    ko: "있으면 그 이름을 입력해서 읽기 진도를 이어받으세요. 없으면 새 이름을 입력해서 시작하세요.",
    en: "If so, enter it to carry over your reading progress. Otherwise, enter a new name to start fresh.",
  },
  "login.claimSubmit": { ko: "계속", en: "Continue" },
  "login.claimNameTaken": {
    ko: "이미 다른 계정과 연결된 이름이에요. 다른 이름을 입력해주세요.",
    en: "That name is already linked to a different account. Try another one.",
  },
  "login.claimFailed": {
    ko: "문제가 발생했어요. 다시 시도해주세요.",
    en: "Something went wrong. Please try again.",
  },

  "landing.tagline": {
    ko: "매일 5–10분, 이야기처럼 읽는 성경",
    en: "5–10 minutes a day, the Bible told like a story",
  },
  "landing.subtitle": {
    ko: "매일 한 챕터씩, 배경 설명과 오늘의 메시지, 그리고 듣기 좋은 오디오까지 함께.",
    en: "One chapter a day, with context, a daily reflection, and audio narration to listen along.",
  },
  "landing.cta": { ko: "Google로 시작하기 — 7일 무료체험", en: "Get started with Google — 7-day free trial" },
  "landing.feature.cycle.title": { ko: "끊김 없이 성경 전체를 완주", en: "A gap-free path through the whole Bible" },
  "landing.feature.cycle.body": {
    ko: "창세기부터 요한계시록까지, 매일 이어서 한 챕터씩 — 놓친 날 없이 순서대로 진행돼요.",
    en: "Genesis to Revelation, one chapter at a time, picking back up exactly where you left off.",
  },
  "landing.feature.context.title": { ko: "배경 설명 + 오늘의 메시지", en: "Context & a daily reflection" },
  "landing.feature.context.body": {
    ko: "그날 본문의 역사적 배경과, 삶에 적용할 수 있는 오늘의 메시지를 AI가 함께 준비해드려요.",
    en: "Each day's passage comes with historical background and a short reflection connecting it to daily life.",
  },
  "landing.feature.audio.title": { ko: "듣기 좋은 오디오, 이어듣기까지", en: "Listen along, and pick up where you stopped" },
  "landing.feature.audio.body": {
    ko: "본문을 읽어주는 오디오를 백그라운드에서도 재생하고, 다음에 열면 멈췄던 문장부터 다시 시작해요.",
    en: "Audio narration keeps playing in the background, and resumes from the exact sentence you left off on.",
  },
  "landing.pricing.title": { ko: "$3.99/월, 7일 무료체험", en: "$3.99/month, 7-day free trial" },
  "landing.pricing.body": {
    ko: "매일의 콘텐츠와 오디오를 만드는 데 드는 실제 AI·API 비용을 반영한 가격이에요. 체험 기간 중 언제든 취소할 수 있어요.",
    en: "The price reflects the real AI and API costs behind generating each day's content and audio. Cancel anytime during the trial.",
  },

  "today.preparing": {
    ko: "오늘의 말씀을 준비하고 있어요. 조금만 기다려 주세요…",
    en: "Preparing today's reading. This may take a moment…",
  },
  "today.previousPassage": { ko: "이전 본문", en: "Previous passage" },
  "today.nextPassage": { ko: "다음 본문", en: "Next passage" },
  "today.previousDay": { ko: "이전 날", en: "Previous day" },
  "today.nextDay": { ko: "다음 날", en: "Next day" },
  "today.noReadingThisDay": {
    ko: "이 날은 읽은 기록이 없어요.",
    en: "No reading recorded for this day.",
  },
  "today.passageTitle": { ko: "오늘의 본문", en: "Today's Passage" },
  "today.contextTitle": { ko: "배경 설명", en: "Context & Background" },
  "today.messageTitle": { ko: "오늘의 메시지", en: "Today's Message" },
  "today.worshipTitle": { ko: "찬양", en: "Worship" },
  "today.byVerse": { ko: "절별로", en: "By Verse" },
  "today.asStory": { ko: "이야기로", en: "As a Story" },
  "today.doneReadNext": {
    ko: "오늘 완료 — 다음 본문 읽기",
    en: "Done for today — read the next passage",
  },
  "today.generating": { ko: "생성 중…", en: "Generating…" },

  "plan.title": { ko: "요금제", en: "Plan" },
  "plan.freeFamily": { ko: "무료 (가족)", en: "Free (family)" },
  "plan.trialActive": { ko: "무료 체험 중", en: "Free trial active" },
  "plan.trialEndsOn": { ko: "무료 체험 종료일:", en: "Trial ends" },
  "plan.active": { ko: "구독 중", en: "Subscription active" },
  "plan.renewsOn": { ko: "다음 결제일:", en: "Renews" },
  "plan.manageBilling": { ko: "결제 관리", en: "Manage billing" },
  "plan.expiredHint": {
    ko: "14일 무료 체험 후 월 $3.99가 결제돼요. 체험 종료 전 언제든 취소할 수 있어요.",
    en: "14-day free trial, then $3.99/month. Cancel anytime before the trial ends.",
  },
  "plan.subscribeCta": { ko: "무료 체험 시작하기", en: "Start free trial" },
  "plan.subscribeFamilyCta": {
    ko: "가족 플랜 시작하기 ($9.99/월, 최대 5명)",
    en: "Start family plan ($9.99/mo, up to 5 people)",
  },
  "plan.convertToFamily": { ko: "가족 플랜으로 전환", en: "Switch to family plan" },
  "plan.passphrasePlaceholder": { ko: "가족 패스프레이즈", en: "Family passphrase" },
  "plan.passphraseSubmit": { ko: "확인", en: "Redeem" },
  "plan.passphraseInvalid": { ko: "패스프레이즈가 올바르지 않아요.", en: "That passphrase isn't valid." },
  "plan.paywallTitle": {
    ko: "무료 체험이 끝났거나 구독이 필요해요",
    en: "Your trial has ended or a subscription is needed",
  },
  "plan.paywallHint": {
    ko: "14일 무료 체험 후 월 $3.99예요. 언제든 취소할 수 있어요.",
    en: "14-day free trial, then $3.99/month. Cancel anytime.",
  },
  "plan.startingCheckout": { ko: "이동 중…", en: "Redirecting…" },

  "family.ownerTitle": { ko: "가족 플랜 관리", en: "Manage family plan" },
  "family.inviteLinkLabel": { ko: "초대 링크", en: "Invite link" },
  "family.copyLink": { ko: "링크 복사", en: "Copy link" },
  "family.linkCopied": { ko: "복사됐어요", en: "Copied" },
  "family.regenerateLink": { ko: "링크 재발급", en: "Regenerate link" },
  "family.membersHeading": { ko: "가족 구성원", en: "Family members" },
  "family.noMembersYet": { ko: "아직 초대한 사람이 없어요.", en: "No one has joined yet." },
  "family.removeMember": { ko: "제거", en: "Remove" },
  "family.leaveButton": { ko: "가족 플랜 나가기", en: "Leave family plan" },
  "family.inactiveOwnerHint": {
    ko: "이 가족 플랜은 더 이상 활성화되어 있지 않아요.",
    en: "This family plan is no longer active.",
  },
  "family.join.loading": { ko: "확인 중…", en: "Checking…" },
  "family.join.acceptCta": { ko: "참여하기", en: "Join" },
  "family.join.accepting": { ko: "참여 중…", en: "Joining…" },
  "family.join.acceptedRedirect": { ko: "가족 플랜에 참여했어요! 이동 중…", en: "You've joined the family plan! Redirecting…" },
  "family.join.reason.not_found": { ko: "유효하지 않은 초대 링크예요.", en: "This invite link isn't valid." },
  "family.join.reason.full": { ko: "이 가족 플랜은 이미 꽉 찼어요.", en: "This family plan is already full." },
  "family.join.reason.already_member": {
    ko: "이미 다른 가족 플랜에 속해 있어요. 먼저 나가야 참여할 수 있어요.",
    en: "You're already part of a family plan. Leave it first to join a different one.",
  },
  "family.join.reason.is_owner": { ko: "본인의 가족 플랜에는 참여할 수 없어요.", en: "You can't join your own family plan." },
  "family.join.failed": { ko: "참여에 실패했어요. 다시 시도해주세요.", en: "Failed to join. Please try again." },

  "settings.title": { ko: "설정", en: "Settings" },
  "settings.account": { ko: "계정", en: "Account" },
  "settings.logout": { ko: "로그아웃", en: "Log out" },
  "settings.nameHint": {
    ko: "지금은 이름이 로그인 역할을 해요 — 이 이름으로 읽기 진도가 저장돼요.",
    en: "Your name is your login for now — it's how your reading progress is saved.",
  },
  "settings.deleteAccount": { ko: "계정 삭제", en: "Delete account" },
  "settings.deleteAccountConfirm": {
    ko: "정말 계정을 삭제할까요? 읽기 진도, 저장된 위치, 구독이 모두 영구히 삭제되고 되돌릴 수 없어요.",
    en: "Delete your account? Your reading progress, saved bookmarks, and subscription will be permanently deleted — this can't be undone.",
  },
  "settings.deleteAccountFailed": {
    ko: "계정 삭제에 실패했어요. 다시 시도해주세요.",
    en: "Failed to delete your account. Please try again.",
  },
  "settings.fontSize": { ko: "글자 크기", en: "Font Size" },
  "settings.fontSizeHint": { ko: "앱 전체에 바로 적용돼요.", en: "Applies across the whole app instantly." },
  "settings.uiLanguage": { ko: "앱 언어", en: "App Language" },
  "settings.uiLanguageHint": {
    ko: "앱의 메뉴와 성경 본문 언어를 모두 바꿔요.",
    en: "Changes the app's menus and the Bible passage language together.",
  },
  "settings.timezone": { ko: "시간대", en: "Timezone" },
  "settings.timezoneHint": {
    ko: "오늘의 말씀이 넘어가는 기준 시간과 아침 알림 시각의 기준이 돼요. 보통 자동으로 감지되지만 필요하면 바꿀 수 있어요.",
    en: "Sets the day boundary for today's reading and the reference for your morning reminder time. Usually auto-detected, but you can change it here.",
  },
  "settings.morningReminder": { ko: "아침 알림", en: "Morning Reminder" },
  "settings.morningReminderHint": {
    ko: "고른 시간대 기준으로, 매일 정해진 시각에 오늘 읽을 본문 범위를 알려드려요.",
    en: "Get a notification with today's passage range, at a time you choose, in your own timezone.",
  },
  "settings.notificationHour": { ko: "받을 시각", en: "Notification time" },
  "settings.notificationsUnsupported": {
    ko: "이 브라우저에서는 알림을 지원하지 않아요.",
    en: "Notifications aren't supported in this browser.",
  },
  "settings.notificationsDenied": {
    ko: "알림 권한이 차단돼 있어요. 브라우저 설정에서 허용해주세요.",
    en: "Notification permission is blocked. Please allow it in your browser settings.",
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
  "reading.backToBooks": { ko: "목록", en: "Books" },
  "reading.loading": {
    ko: "본문을 불러오고 있어요. 조금만 기다려 주세요…",
    en: "Loading the passage. This may take a moment…",
  },
  "reading.resume": { ko: "이어 듣기", en: "Resume" },
  "reading.pause": { ko: "일시정지", en: "Pause" },
  "reading.stop": { ko: "정지", en: "Stop" },

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
  return lang === "ko" ? `본문 ${index}/${total}` : `Passage ${index} of ${total}`;
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

export function familySlotsLabel(lang: Lang, used: number, total: number): string {
  return lang === "ko" ? `${used}/${total}명 사용 중` : `${used}/${total} people`;
}

// users.name is nullable (Google OAuth normally sets it, but nothing guarantees it) — falls back
// to a generic term rather than showing "null님의 가족 플랜".
function displayName(lang: Lang, name: string | null): string {
  return name ?? (lang === "ko" ? "가족 플랜 소유자" : "the plan owner");
}

export function familyMemberOfLabel(lang: Lang, ownerName: string | null): string {
  const name = displayName(lang, ownerName);
  return lang === "ko" ? `${name}님의 가족 플랜에 속해 있어요` : `Covered by ${name}'s family plan`;
}

export function familyJoinPrompt(lang: Lang, ownerName: string | null): string {
  const name = displayName(lang, ownerName);
  return lang === "ko" ? `${name}님의 가족 플랜에 참여하시겠어요?` : `Join ${name}'s family plan?`;
}

// What Brownie (the personal-assistant app) needs to know to talk about this app the way its
// owner does.
//
// **This file is the only contact point between this app's vocabulary and Brownie.** When the
// reading plan, the tabs, or the words on screen change, change this too — then Brownie keeps
// up without anyone touching its repo. Skip it and you get the failure that leaves no trace:
// the owner asks with a new word and only the assistant does not understand.

export const GLOSSARY = {
  what: "매일 성경 한 대목을 스토리처럼 읽는 앱. 소유자가 직접 만들었고 가족이 같이 쓴다.",

  terms: [
    {
      term: "통독",
      also: ["reading plan", "계획"],
      what: "성경을 처음부터 끝까지 읽어 나가는 것. 이 앱의 계획은 822일치다",
    },
    {
      term: "커리큘럼",
      what: "그 822일의 순서. 하루치가 한 항목이고, 항목마다 책·본문 범위·테마가 있다",
    },
    {
      term: "커서",
      also: ["position", "진도"],
      what: "계획에서 지금 어디까지 왔는지. 131이면 131일째 자리",
    },
    {
      term: "사이클",
      also: ["cycle"],
      what: "계획을 한 바퀴 다 돈 횟수. 끝까지 가면 다시 처음으로 돌아간다",
    },
    {
      term: "시즌 본문",
      also: ["season"],
      what: "고난주간·성탄·추수감사절에 끼어드는 특별 본문. **진도를 앞으로 밀지 않는다**",
    },
    {
      term: "깊이 읽기",
      also: ["deep reading", "통독 탭"],
      what: "오늘 분량 말고 직접 책·장을 골라 읽는 것. 진도 계산에는 같이 들어간다",
    },
    {
      term: "예상 완독일",
      also: ["projectedCompletionDate"],
      what: "최근 2주 속도로 계속 갔을 때 계획을 다 도는 날. 2주간 읽은 게 없으면 없다(null)",
    },
  ],

  howToTalk: [
    "\"오늘 말씀\" 은 오늘 분량을 뜻한다. 아직 안 열었으면 다음 차례를 말해 준다",
    "안 읽은 날을 꾸짖지 않는다. 며칠 쉬었는지 사실만 말하고, 다시 시작하면 예상일이 당겨진다는 것까지가 도움이다",
    "숫자는 이 창구가 준 것만 쓴다. 여기 없는 것은 없다고 말한다",
  ],
};

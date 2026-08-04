# Wordflow 시판 준비 체크리스트

순서대로 진행. 완료되는 대로 `[ ]`를 `[x]`로 체크.

- [x] **1. Tyndale NLT 상업 라이선스 신청서 제출**
  `tyndale.com/permissions/form` 작성 후 제출. $3.99/월 구독 모델 명시.
  승인까지 2~4주 소요 — 최대한 빨리 제출해서 대기 시간을 벌 것.
  (Stripe를 live mode로 전환하기 전에 승인 필요 — 14번 항목의 선행조건)
  **제출 완료. 회신 대기 중.**

- [x] **2. Stripe 계정 생성 + 테스트 키 연동**
  실제 Stripe 계정 생성 → $3.99/월 정기결제 Price 생성 (7일 무료체험 포함) →
  Secret Key / Price ID 발급, 웹훅 엔드포인트(`/api/billing/webhook`) 등록 후 Webhook Secret 발급 →
  `.env.local`과 Vercel 프로덕션에 `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` 추가.
  (결제 관련 코드는 이미 다 구현되어 있음 — 키만 연결하면 됨)
  Stripe 대시보드에서 결제/체크아웃 영수증 이메일도 같이 켜둘 것 — 별도 이메일 인프라 없이 영수증 문제 해결됨.
  **완료.** Google 계정 `slstudio8495@gmail.com`으로 새 Stripe 계정 생성 (Business name: "SL Studio" —
  앞으로 여러 앱을 이 계정 하나로 운영할 예정이라 앱 이름이 아니라 상위 사업체 이름으로 설정).
  Global sales는 "Pick what you need"로 선택 (Managed Payments의 3.5% 추가 수수료 회피, 나중에 변경 가능).
  Product "Wordflow Subscription" $3.99/월 생성, 웹훅 "Wordflow production" 등록,
  결제 성공/환불 영수증 이메일도 켜둠. 키 3개 모두 `.env.local` + Vercel 프로덕션에 연결하고 재배포 완료.

- [x] **3. Stripe 결제 플로우 전체 테스트**
  테스트 모드로: 신규 가입 → 체크아웃(테스트 카드) → 7일 무료체험 시작 확인 →
  웹훅이 DB의 구독 상태를 정확히 갱신하는지 확인 → 결제 전/후 Today·Reading 탭 접근 제한이 맞는지 확인 →
  빌링 포털(해지/관리) 동작 확인 → 가족 패스프레이즈·관리자 무료 지급 기능이 실제 구독과 같이 잘 동작하는지 확인.
  **완료.** `slee6`(sanlee8495) 계정의 `comp_free_forever`를 잠깐 꺼서 실제 체크아웃 테스트 →
  테스트 카드 4242로 체크아웃 → "Trial ends Aug 11" 확인 → DB에 stripe_customer_id/subscription_id/
  subscription_status="trialing"/current_period_end 정확히 반영됨 → Today/Reading 탭 접근 풀림 확인 →
  Manage billing 포털에서 구독 상세/결제수단/인보이스 확인 → 구독 취소까지 테스트.
  Stripe 웹훅 딜리버리 로그: **Total 3, Failed 0**. 테스트 후 `comp_free_forever`는 다시 true로 복원 완료.

- [x] **4. 개인정보처리방침 + 이용약관 페이지 추가**
  현재 앱에 전혀 없음. 유료 구독 + Google 로그인 + Stripe 결제를 다루는 서비스에는 필수.
  수집하는 정보(이메일, 읽기 진도, 시간대), 사용 목적, 결제 처리(Stripe), 사용하는 AI(Claude/TTS), 연락처 포함.
  **완료.** `/privacy`, `/terms` 공개 페이지 추가 (로그인 없이도 접근 가능, Settings 하단에 링크).
  연락처는 slstudio8495@gmail.com (Stripe 계정과 동일 이메일) — 10번 항목 맨 마지막에
  support@slstudio.com 같은 실제 도메인 이메일로 최종 교체 예정.

- [ ] **5. 계정/데이터 삭제 기능 추가**
  현재 없음. Settings에 계정 삭제 액션 + 백엔드 라우트 추가
  (readings, bookmarks, push subscriptions 등 연관 데이터 함께 삭제).

- [ ] **6. 관찰성: 에러 트래킹 + 업타임 모니터링**
  현재 둘 다 전혀 없음. 에러 트래킹(예: Sentry)과는 별개로, 사이트 자체가 죽었을 때 잡아주는
  업타임/헬스체크 모니터링(예: UptimeRobot, Vercel 자체 모니터링)도 따로 필요 — 에러 트래킹만으로는
  "사이트가 아예 안 뜸" 같은 상황을 못 잡음.

- [ ] **7. 어뷰징 방지 / rate limiting 추가**
  현재 코드 전체에 rate limiting이 전혀 없음. 실제 비용으로 이어지는 두 가지 위험:
  (1) AI 콘텐츠 생성·TTS 엔드포인트(`/api/speak`, `generateReading` 등)에 사용자/IP별 제한이 없어서,
  스크립트로 대량 요청하면 실제 Claude/TTS API 비용이 나감.
  (2) `/api/billing/redeem-passphrase`에 시도 횟수 제한이 없어서, 로그인만 하면 무제한으로 패스프레이즈를
  스크립트로 시도해볼 수 있음. 최소한 이 두 엔드포인트에는 rate limiting 필요 (Upstash/KV 기반 등).

- [ ] **8. 핵심 플로우 최소 자동화 테스트 추가**
  현재 테스트 코드 전무 (jest/vitest/playwright 등 전혀 없음). 이번 세션에 고친 버그들
  (알림 진도 불일치, 하이라이트 멈춤, TTS 문장 누락, 토글 정렬 등) 전부 테스트가 아니라 수동으로 찾은 것.
  결제 붙기 전에 최소한 위험도 높은 부분만이라도: 인증/구독 권한 체크(`requireProfile`/`requireEntitledProfile`),
  Stripe 웹훅 핸들러의 DB 반영, 커리큘럼 커서 전진 로직(`buildReading`/`peekCurrentCurriculumItem` —
  최근 알림 버그 났던 바로 그 부분)에는 테스트를 붙일 것.

- [ ] **9. 백업/장애 대응 계획 확인**
  프로덕션 Postgres(Neon)의 백업/PITR(point-in-time recovery) 설정 확인 — 계정, 읽기 진도, 구독 정보가
  전부 여기 있어서 유료 사용자 생기면 데이터 유실 리스크가 실제 리스크가 됨.
  Vercel Blob(TTS 오디오 캐시)의 보관 정책도 확인 — 이건 재생성 가능해서 우선순위는 낮음.
  문제 생겼을 때 실제 복구 절차가 뭔지 문서화.

- [ ] **10. 커스텀 도메인 구입 + 실제 지원 이메일 마련**
  현재 `wordflow-jade.vercel.app`뿐 (연결된 도메인 0개), 연락처도 `slstudio8495@gmail.com` (Stripe 계정 이메일)뿐.
  정식 도메인 구입 후 Vercel에 연결, Stripe 대시보드/개인정보처리방침/이용약관에 실제 지원 이메일 연결.
  **맨 마지막 단계**: `/privacy`·`/terms`의 연락처 이메일을 `slstudio8495@gmail.com`에서
  `support@slstudio.com` 같은 실제 도메인 이메일로 최종 교체.

- [ ] **11. 공개 랜딩 페이지 제작 (로그인 화면 말고)**
  확인해보니 지금 `/`는 로그인 안 한 사람한테 바로 AuthScreen/PaywallScreen을 보여줌 —
  제품을 설명하는 공개 페이지가 아예 없음. 로그인 요청 전에 제품 소개하는 진짜 랜딩 페이지를 만들고,
  카피도 작성 ("$3.99가 실제 AI/TTS/성경 API 비용을 반영한다"는 비용 투명성 앵글 포함, 사용자 아이디어).

- [ ] **12. 전체 콘텐츠 오디오 미리 생성해서 캐시 채우기**
  현재 TTS 오디오는 처음 요청될 때 생성되고 Vercel Blob에 캐시됨 (긴 챕터는 최초 생성 시 ~13초 대기).
  시판 전에 커리큘럼 전체(66권 사이클 전체 + Today 탭 콘텐츠, 한글/영어, By Verse/As a Story 버전 전부)를
  미리 한 번씩 돌려서 캐시를 다 채워놓을 것 — 실제 사용자가 처음 여는 순간에도 기다림 없이 바로 재생되게.
  (사용자 아이디어 — "사용자가 오디오 재생 기다릴 필요 없게 하기")

- [ ] **13. 전체 유저 여정 QA (실기기)**
  Google 가입 → 페이월 → 7일 체험 결제 → Today/Reading 접근 →
  매일 읽기 재생 + 이어듣기(bookmark resume) → 아침 알림 → 빌링 포털/해지까지
  iOS·Android 실기기에서 처음부터 끝까지 점검.
  (이번 세션에서 고친 것들 회귀 확인: 크롬 자동번역, TTS 언어, 알림-프로필 불일치, 토글 정렬, 하이라이트 추적, TTS 재시도)

- [ ] **14. Tyndale 승인 나오면 Stripe를 live mode로 전환**
  1번 승인 + 위 항목 전부 완료 후, Stripe를 test mode에서 live mode(실제 키)로 전환.
  이 순간이 실질적인 "공식 시판" 시점.

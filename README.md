# Wordflow

매일 5~10분, 성경을 스토리처럼 재미있게 통독하는 개인 프로젝트.

## Concept

- 기존 QT책이 지루하고 성경 이해가 어렵다는 문제에서 출발.
- 하루 분량을 스토리텔링 톤으로 풀어서, 지루하지 않게 성경 전체를 이해할 수 있게 한다.

## Daily content (per day)

- 오늘의 테마 한 줄
- 전체 내용을 이해할 수 있는 요약 (스토리식)
- 전후 흐름 + 역사적 배경 요약
- 오늘 본문에서 하나님이 주시는 메시지
- 관련 찬양 링크 (YouTube 자동 검색 매칭)
- 관련 유명 설교 링크 (YouTube 자동 검색 매칭)

## Reading plan

- 테마별 커리큘럼 (책 순서가 아닌 주제 중심 재구성), `src/db/seed.ts`의 `STARTER_CURRICULUM`에 시작용 48개 항목 시딩
- 고정된 N일 플랜이 아니라, 프로필마다 `cursorPosition`으로 현재 위치를 기억하고 하루 약 5분 분량(반 장~한 장)씩 전진
- 끝까지 가면 처음부터 다시 루프. 같은 본문이 다시 와도 Claude가 매번 새로 생성하므로 내용은 달라질 수 있음
- 번역본: 한글 새번역 + 영어 NLT (본문은 매일 배치에서 fetch해서 Claude 프롬프트에 함께 전달)

## Chatbot

- 성경, 교회, 목사님, 기독교 저서에 대한 질문 응답 + 찬양 추천
- 한국어 / 영어 지원
- 음성 입력(마이크) 지원
- `sl_sports`의 ChatWidget 구조 (Next.js + AI SDK + `@ai-sdk/anthropic` + 음성 녹음/TTS) 그대로 재사용

## Content generation

- `vercel.ts`에 등록된 크론(매일 13:00 UTC ≈ 태평양 새벽 6시)이 `/api/cron/generate-daily`를 호출
- 모든 프로필을 순회하며 그날 커서 위치의 본문으로 Claude(`MODEL`, haiku)에게 테마/요약/배경/메시지를 생성시키고, `readings`에 저장 후 커서를 한 칸 전진
- `(profileId, date)` 유니크 제약으로 하루 한 번만 생성됨 — 크론이 여러 번 불려도 안전
- `/api/today?name=...`가 오늘자 row가 없으면 그 자리에서 즉시 생성 (로컬 개발/크론 미설정 시 폴백)

## Users

- 초기: 로그인 없이 이름 입력만으로 프로필 구분 (진도/기록 저장)
- 추후: 정식 회원가입으로 확장 가능한 구조로 설계

## Platform

- 1차: 웹앱 (PWA, Vercel 배포)
- 추후: 시판 고려 시 iOS 네이티브 전환 검토

## Stack (reference: `sl_sports`)

- Next.js
- `ai` SDK + `@ai-sdk/anthropic` + `@ai-sdk/react`
- Drizzle ORM + Postgres (Neon, Vercel Marketplace)
- Vercel 배포 + Vercel Cron

## 시작하려면 (계정/API 키 체크리스트)

**완료됨** — `vercel link`로 `sl-studio` 팀의 `wordflow` 프로젝트(GitHub 리포 자동 연결됨)에 연결하고,
`vercel integration add neon`으로 전용 Neon DB(`neon-fuchsia-yacht`)를 프로비저닝 + 연결 + `.env.local`로 pull까지
끝냈어요. `vercel link`가 받아오는 `VERCEL_OIDC_TOKEN` 덕분에 AI Gateway(Claude 모델, TTS, 전사)는 별도 키 없이
바로 동작 — `AI_GATEWAY_API_KEY`를 따로 만들 필요가 없었어요. 스키마도 push했고 시작용 커리큘럼 49개도 시딩 완료,
`/api/today`·`/api/chat` 실제 호출까지 로컬에서 검증했어요.

아래는 남은 것 중 본인 인증이 필요해서 직접 만들어야 하는 것들이에요 (순서 상관없음, 없어도 앱은 동작함 —
본문/찬양/설교 링크만 비어있는 채로 진행됨):

1. **NLT API** — https://api.nlt.to 에서 키 발급 (비상업적 무료) → `NLT_API_KEY`
   (한글 본문은 별도 API 없이 Claude가 이 NLT 영어 본문을 근거로 직접 생성해요 — 절별 버전과
   이야기체 버전 둘 다. API.Bible 키는 가입 후에도 계속 "Invalid API key"로 막혀서 포기했어요.)
2. **YouTube Data API v3** — Google Cloud Console에서 프로젝트 만들고 API 키 발급 (검색 quota 확인) → `YOUTUBE_API_KEY`
3. **CRON_SECRET / APP_API_KEY** — 아무 랜덤 문자열이나 만들어서 Vercel 환경변수에 등록 (배포 후 `/api/cron/generate-daily`, `/api/transcribe` 보호용)

키를 하나씩 채워가며 `vercel env add <NAME>` → `vercel env pull`로 로컬에 반영하면 점진적으로 붙일 수 있어요.

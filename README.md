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

아래는 전부 본인 인증이 필요해서 직접 만들어야 하는 것들이에요. 순서는 상관없어요.

1. **Vercel 프로젝트 연결 + Neon Postgres**
   - `vercel link`로 이 리포를 프로젝트에 연결 → Marketplace에서 Neon 추가 → `vercel env pull`로 `DATABASE_URL` 등 받기
   - (`sl_sports`와 같은 패턴이라 Neon 대시보드에서 새 프로젝트 하나 더 만들면 됨)
2. **AI Gateway** — Vercel 대시보드에서 AI Gateway 활성화하고 `AI_GATEWAY_API_KEY` 발급 (Claude/OpenAI 모델 라우팅 + TTS/전사에 사용)
3. **NLT API** — https://api.nlt.to 에서 키 발급 (비상업적 무료)
4. **API.Bible** — https://api.bible 가입 → Starter 플랜(무료) → `/bibles` 목록에서 **새번역(RNKSV)이 있는지 확인**. 없으면 개역개정으로 대체하고 `src/lib/bible.ts` 주석대로 passage ID 포맷 확인 필요
5. **YouTube Data API v3** — Google Cloud Console에서 프로젝트 만들고 API 키 발급 (검색 quota 확인)
6. **CRON_SECRET / APP_API_KEY** — 아무 랜덤 문자열이나 만들어서 Vercel 환경변수에 등록

**최소로 필요한 건 `DATABASE_URL`(+ seed 실행)과 `AI_GATEWAY_API_KEY`** — 이 둘만 있으면 오늘의 말씀 생성이 동작해요. NLT/API.Bible/YouTube 키는 없어도 각 fetch가 실패를 catch해서 본문/링크 없이 진행되도록 되어 있으니, 나머지는 하나씩 채워가며 점진적으로 붙이면 됩니다.

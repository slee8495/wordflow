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

- 테마별 / 절기별 커리큘럼 (책 순서가 아닌 주제 중심 재구성)
- 번역본: 한글 새번역 + 영어 NLT

## Chatbot

- 성경, 교회, 목사님, 기독교 저서에 대한 질문 응답 + 찬양 추천
- 한국어 / 영어 지원
- 음성 입력(마이크) 지원
- `sl_sports`의 ChatWidget 구조 (Next.js + AI SDK + `@ai-sdk/anthropic` + 음성 녹음/TTS) 재사용 예정

## Content generation

- 매일 새벽 배치로 그날 분량을 Claude API로 생성해 DB에 저장 (실시간 생성 아님)
- 필요 시 재생성/보완 가능

## Users

- 초기: 로그인 없이 이름 입력만으로 프로필 구분 (진도/기록 저장)
- 추후: 정식 회원가입으로 확장 가능한 구조로 설계

## Platform

- 1차: 웹앱 (PWA, Vercel 배포)
- 추후: 시판 고려 시 iOS 네이티브 전환 검토

## Stack (reference: `sl_sports`)

- Next.js
- `ai` SDK + `@ai-sdk/anthropic` + `@ai-sdk/react`
- Drizzle ORM + Postgres
- Vercel 배포

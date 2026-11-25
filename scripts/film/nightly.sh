#!/bin/bash
# Nightly "영상으로 보기" films (2026-11-24 user: "새벽 두시에 루프, 진도보다 3회분 앞서, 지나간 건
# 영상만 지우고 대본은 남기고"). launchd com.slstudio.wordflow-film runs ~/.slstudio/wordflow-film/
# launch.sh at 02:00, which updates the loop's own clone of this repo and execs this file.
# scripts/film/nightly.ts decides what to make; Claude is only asked for scene scripts of passages
# that have never had one — re-renders, narration (/api/speak) and images (local mflux) are free.
cd "$(dirname "$0")/../.." || exit 1
export PATH="/Users/stanlee/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
HOME_DIR="$HOME/.slstudio/wordflow-film"
LOG="$HOME_DIR/logs/nightly.log"
LOCK="$HOME_DIR/.lock"
mkdir -p "$HOME_DIR/logs"
log() { echo "$(date '+%m-%d %H:%M') $*" >> "$LOG"; }

if ! mkdir "$LOCK" 2>/dev/null; then
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +300 2>/dev/null)" ]; then rmdir "$LOCK"; mkdir "$LOCK" || exit 0
  else log "already running"; exit 0; fi
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

# Nothing new to make → finish without touching Claude at all.
PENDING=$(npx tsx --env-file=.env.local scripts/film/nightly.ts --dry 2>>"$LOG")
echo "$PENDING" >> "$LOG"
if ! echo "$PENDING" | grep -q "todo "; then
  npx tsx --env-file=.env.local scripts/film/nightly.ts >> "$LOG" 2>&1  # still archives passed films
  log "nothing new"; exit 0
fi

# Claude 로그인 토큰 — 키체인 로그인이 끊겨도 루프가 돈다. 파일이 없으면 그대로.
if [ -f "$HOME/.slstudio/claude_env" ]; then . "$HOME/.slstudio/claude_env"; fi
export FILM_ALLOW_CLAUDE=1
# 컨트롤 타워 예산 게이트 — 넘기라고 하면 이번 차례는 모델을 부르지 않는다(대본이 이미 있는 회분은 그대로 만든다). 타워가 없거나 고장이면 그냥 진행.
TOWER_GATE="$HOME/.slstudio/tower/gate"; if [ -x "$TOWER_GATE" ] && ! "$TOWER_GATE" wordflow-film; then log "control tower: no Claude this run"; export FILM_ALLOW_CLAUDE=0; fi

perl -e 'alarm shift; exec @ARGV' 21600 npx tsx --env-file=.env.local scripts/film/nightly.ts >> "$LOG" 2>&1
log "nightly exited $?"

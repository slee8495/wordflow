#!/bin/bash
# Installed copy lives at ~/.slstudio/wordflow-film/launch.sh (launchd com.slstudio.wordflow-film,
# 02:00). Keeps the loop's own clone of the repo at origin/main (or the film branch until it's
# merged) so the loop never depends on — or disturbs — the working copy someone is editing.
export PATH="/Users/stanlee/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
BASE="$HOME/.slstudio/wordflow-film"
REPO="$BASE/repo"
mkdir -p "$BASE/logs"
if [ ! -d "$REPO/.git" ]; then git clone -q https://github.com/slee8495/wordflow.git "$REPO" || exit 1; fi
cd "$REPO" || exit 1
git fetch -q origin
REF=origin/main
git cat-file -e origin/main:scripts/film/nightly.ts 2>/dev/null || REF=origin/worktree-bible-film
OLD_LOCK=$(git rev-parse -q HEAD:package-lock.json 2>/dev/null)
git checkout -q --detach "$REF" || exit 1
[ -d node_modules ] && [ "$OLD_LOCK" = "$(git rev-parse -q HEAD:package-lock.json)" ] || npm ci --silent >> "$BASE/logs/nightly.log" 2>&1
cp /Users/stanlee/SLStudio/wordflow/.env.local .env.local
exec /bin/bash scripts/film/nightly.sh

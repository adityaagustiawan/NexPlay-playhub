#!/usr/bin/env bash
# Ship the working tree: typecheck + build, then commit and push to main.
#
# Vercel is git-connected to this repo (project "nexconsole", branch "main"),
# so a push to main automatically triggers a production build + deploy at
# https://nexconsole.vercel.app — no manual "Redeploy" needed.
#
# Usage:
#   npm run ship                     # auto message with UTC timestamp
#   npm run ship "feat: my change"   # custom message
#
# A broken typecheck or build aborts the ship BEFORE anything is committed,
# so a failing build can never reach main. Skip checks with:
#   SHIP_SKIP_CHECKS=1 npm run ship "wip"
#
# To skip the automatic post-commit push hook, also see .githooks/post-commit.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

if [ "${SHIP_SKIP_CHECKS:-0}" = "1" ]; then
  echo "⚠ Skipping checks (SHIP_SKIP_CHECKS=1)."
else
  echo "▶ Typechecking (tsc --noEmit)…"
  npm run --silent typecheck
  echo "▶ Building (vite build)…"
  npm run build
  echo "✔ Checks passed."
fi

msg="${1:-}"
if [ -z "$msg" ]; then
  msg="chore: site update $(date -u +'%Y-%m-%d %H:%M UTC')"
fi

git add -A
if git diff --cached --quiet; then
  echo "✔ Nothing new to commit."
else
  git commit -m "$msg"
fi

# Auto-deploy: push the current HEAD to main.
if git push origin HEAD:main; then
  echo "✔ Pushed to main — Vercel is building the production deploy."
else
  echo "↻ Push rejected; syncing with origin/main and retrying…"
  git fetch origin main
  git rebase origin/main
  git push origin HEAD:main
  echo "✔ Pushed to main after sync — Vercel is building."
fi

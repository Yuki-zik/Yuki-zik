#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -eq 0 ]; then echo "Pass generated asset paths" >&2; exit 1; fi
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
# Stage first: git diff alone misses brand-new (untracked) generated assets.
git add -- "$@"
if git diff --cached --quiet; then echo 'No generated changes.'; exit 0; fi
git commit -m 'chore: refresh profile assets'
for attempt in 1 2 3; do
  if git push origin HEAD:main; then exit 0; fi
  if [ "$attempt" -eq 3 ]; then echo 'Asset push failed after retries.' >&2; exit 1; fi
  git fetch origin main
  git rebase origin/main
  sleep "$attempt"
done

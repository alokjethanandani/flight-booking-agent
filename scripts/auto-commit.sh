#!/bin/bash
# Hourly version-history snapshot: commits the working tree locally if it's
# dirty and has been stable (no changes) for at least DEBOUNCE_MINUTES, so it
# never snapshots a file mid-edit, then pushes to origin. If the push is
# rejected (e.g. remote has commits this doesn't), it logs and leaves the
# local commit in place for manual resolution rather than force-pushing or
# auto-merging.
set -euo pipefail

REPO_DIR="/Users/alok/Documents/Claude/Projects/flight-booking-agent"
LOG_FILE="$REPO_DIR/.auto-commit.log"
DEBOUNCE_MINUTES=5
BRANCH="main"

# Never interactively prompt for credentials/host-key confirmation -- fail
# fast instead of hanging an unattended job.
export GIT_TERMINAL_PROMPT=0
export GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=10"

cd "$REPO_DIR"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"
}

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  log "ERROR: not a git repo, skipping"
  exit 1
fi

STATUS=$(git status --porcelain)
if [ -z "$STATUS" ]; then
  exit 0
fi

# Debounce: skip if any changed file was modified more recently than
# DEBOUNCE_MINUTES ago (likely still being edited).
NOW=$(date +%s)
CUTOFF=$((NOW - DEBOUNCE_MINUTES * 60))
NEWEST=0
while IFS= read -r line; do
  file="${line:3}"
  [ -e "$file" ] || continue
  mtime=$(stat -f %m "$file" 2>/dev/null || echo 0)
  if [ "$mtime" -gt "$NEWEST" ]; then
    NEWEST=$mtime
  fi
done <<< "$STATUS"

if [ "$NEWEST" -gt "$CUTOFF" ]; then
  log "SKIP: changes younger than ${DEBOUNCE_MINUTES}m, waiting for stability"
  exit 0
fi

ADDED=$(echo "$STATUS" | grep -c '^??' || true)
MODIFIED=$(echo "$STATUS" | grep -c '^ M\|^M ' || true)
DELETED=$(echo "$STATUS" | grep -c '^ D\|^D ' || true)
RENAMED=$(echo "$STATUS" | grep -c '^R ' || true)

SUMMARY="Auto-snapshot ($(date '+%Y-%m-%d %H:%M'))"
PARTS=()
[ "$ADDED" -gt 0 ] && PARTS+=("$ADDED added")
[ "$MODIFIED" -gt 0 ] && PARTS+=("$MODIFIED modified")
[ "$DELETED" -gt 0 ] && PARTS+=("$DELETED deleted")
[ "$RENAMED" -gt 0 ] && PARTS+=("$RENAMED renamed")
if [ ${#PARTS[@]} -gt 0 ]; then
  SUMMARY="$SUMMARY: $(IFS=, ; echo "${PARTS[*]}")"
fi

FILELIST=$(echo "$STATUS" | awk '{print $2}' | head -10)
BODY="Files:
$FILELIST"
if [ "$(echo "$STATUS" | wc -l)" -gt 10 ]; then
  BODY="$BODY
... and more"
fi

git add -A
git commit -m "$SUMMARY" -m "$BODY" >> "$LOG_FILE" 2>&1
log "COMMITTED: $SUMMARY"

if git push origin "$BRANCH" >> "$LOG_FILE" 2>&1; then
  log "PUSHED to origin/$BRANCH"
else
  log "PUSH FAILED -- local commit kept, needs manual resolution (diverged history? auth?)"
fi

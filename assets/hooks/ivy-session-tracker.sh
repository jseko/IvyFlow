#!/bin/bash
# IvyFlow Session Tracker — v2 (post-commit hook)
# Records L1 raw events (git_commit + file_save) to .ivy/sessions/raw/events.jsonl
#
# IMPORTANT: This hook is BEST-EFFORT. It may fail, be skipped, or lose events.
# The system is designed to tolerate data loss. Do not rely on 100% coverage.
#
# Environment variables:
#   IVY_GIT_WATCH=1 — enable experimental file-level event emission

set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
IVY_DIR="$REPO_ROOT/.ivy"
RAW_DIR="$IVY_DIR/sessions/raw"

# If .ivy doesn't exist, skip silently (IvyFlow not initialized)
[ -d "$IVY_DIR" ] || exit 0

# Check if analytics is enabled
if [ -f "$IVY_DIR/project.yaml" ]; then
  if ! grep -q "analytics_enabled: true" "$IVY_DIR/project.yaml" 2>/dev/null; then
    exit 0
  fi
else
  exit 0
fi

mkdir -p "$RAW_DIR"

# Infer current change name from the most recently modified .ivy.yaml
CHANGE_NAME=$(find "$REPO_ROOT/openspec/changes" -name ".ivy.yaml" -type f 2>/dev/null | head -1 | xargs dirname 2>/dev/null | xargs basename 2>/dev/null || true)
[ -z "$CHANGE_NAME" ] && CHANGE_NAME="default"

# Generate unique eventId: evt_<timestamp>_<random>
EVENT_ID="evt_$(date -u +%s)_$(openssl rand -hex 4 2>/dev/null || echo "$(date +%N | cut -c1-8)")"
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Gather commit stats
STATS=$(git diff --shortstat HEAD~1 HEAD 2>/dev/null || echo "")
FILES=$(echo "$STATS" | grep -oE '[0-9]+(?= file)' || echo "0")
INSERTIONS=$(echo "$STATS" | grep -oE '[0-9]+(?= insertion)' || echo "0")
DELETIONS=$(echo "$STATS" | grep -oE '[0-9]+(?= deletion)' || echo "0")
HASH=$(git rev-parse HEAD)

# Write L1 raw event (single line, no line breaks inside JSON)
printf '%s\n' "{\"ts\":\"$TS\",\"eventId\":\"$EVENT_ID\",\"change\":\"$CHANGE_NAME\",\"event\":\"git_commit\",\"source\":\"git-hook\",\"meta\":{\"files\":$FILES,\"insertions\":$INSERTIONS,\"deletions\":$DELETIONS,\"hash\":\"$HASH\"}}" >> "$RAW_DIR/events.jsonl"

# Record pending event for L2 inferrer
printf '%s %s\n' "$TS" "$EVENT_ID" >> "$RAW_DIR/.pending_events"

# Experimental: Git Watch file-level events (opt-in via IVY_GIT_WATCH)
if [ "${IVY_GIT_WATCH:-}" = "1" ] || [ "${IVY_GIT_WATCH:-}" = "true" ]; then
  # Generate file_save events from git diff-tree output
  if command -v node >/dev/null 2>&1; then
    node -e "
    const { execSync } = require('child_process');
    const { writeFileSync, mkdirSync, existsSync } = require('fs');
    const path = require('path');

    const rawDir = '$RAW_DIR';
    if (!existsSync(rawDir)) mkdirSync(rawDir, { recursive: true });

    const commitHash = '$HASH';
    const insertions = $INSERTIONS;
    const deletions = $DELETIONS;
    const changeName = '$CHANGE_NAME';

    let output;
    try {
      output = execSync('git diff-tree --no-commit-id --name-status -r HEAD~1 HEAD 2>/dev/null || git diff-tree --no-commit-id --name-status -r HEAD 2>/dev/null', { encoding: 'utf-8' }).trim();
    } catch { process.exit(0); }

    if (!output) process.exit(0);

    for (const line of output.split('\n')) {
      if (!line.trim()) continue;
      const parts = line.split('\t');
      if (parts.length < 2) continue;

      const statusChar = parts[0];
      const filePath = parts.slice(1).join('\t');

      let status;
      switch (statusChar) {
        case 'A': status = 'added'; break;
        case 'D': status = 'deleted'; break;
        case 'M': status = 'modified'; break;
        case 'R': status = 'renamed'; break;
        default: status = 'modified';
      }

      let fileSize = 0;
      try {
        fileSize = require('fs').statSync(path.join(process.cwd(), filePath)).size;
      } catch {}

      const eventId = 'evt_' + Date.now().toString(16) + '_' + Math.random().toString(16).slice(2, 10);
      const ts = new Date().toISOString();
      const eventJson = JSON.stringify({
        ts, eventId, change: changeName, event: 'file_save', source: 'git-hook',
        meta: { path: filePath, status, commitHash, fileSize, insertions, deletions }
      });
      writeFileSync(path.join(rawDir, 'events.jsonl'), eventJson + '\n', { flag: 'a' });
    }
    " 2>/dev/null || true
  fi
fi

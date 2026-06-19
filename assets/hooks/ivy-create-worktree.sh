#!/bin/bash
#
# ivy-create-worktree.sh — v0.13 Git worktree creation hook.
#
# Creates an isolated git worktree for safe parallel agent execution.
# Designed to be called by IvyFlow or invoked directly.
#
# Usage:
#   ivy-create-worktree.sh <repo-root> <change-name>
#
# Returns:
#   0 on success — prints worktree directory path
#   1 on failure — prints error message to stderr

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <repo-root> <change-name>" >&2
  exit 1
fi

REPO_ROOT="$1"
CHANGE_NAME="$2"

# Sanitize change name for branch/directory use
SANITIZED="$(echo "$CHANGE_NAME" | sed 's/[^a-zA-Z0-9-]/-/g')"
WORKTREE_DIR="${REPO_ROOT}/.worktrees/${SANITIZED}"
BRANCH_NAME="workflow/${SANITIZED}"

# Check if worktree already exists
if [ -d "$WORKTREE_DIR" ]; then
  echo "$WORKTREE_DIR"
  exit 0
fi

# Create the worktree
if ! git -C "$REPO_ROOT" worktree add "$WORKTREE_DIR" -b "$BRANCH_NAME" 2>/dev/null; then
  # Fallback: if branch already exists, create without -b
  git -C "$REPO_ROOT" worktree add "$WORKTREE_DIR" "$BRANCH_NAME" 2>/dev/null || {
    echo "Error: Failed to create worktree for ${CHANGE_NAME}" >&2
    exit 1
  }
fi

# Create symlinks for excluded directories (node_modules, dist, target)
for EXCLUDE_DIR in "node_modules" "dist" "target"; do
  SRC_PATH="${REPO_ROOT}/${EXCLUDE_DIR}"
  DEST_PATH="${WORKTREE_DIR}/${EXCLUDE_DIR}"
  if [ -e "$SRC_PATH" ] && [ ! -e "$DEST_PATH" ]; then
    rm -rf "$DEST_PATH" 2>/dev/null || true
    ln -s "$SRC_PATH" "$DEST_PATH" 2>/dev/null || true
  fi
done

echo "$WORKTREE_DIR"
exit 0

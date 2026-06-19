#!/bin/bash
# IvyFlow State Guard — standalone checkpoint transition guard script.
# Usage: state-guard.sh <change-name> <from-checkpoint> <to-checkpoint>
#
# Checks that required artifacts exist for the requested transition.
# Returns 0 if all checks pass, 1 if any check fails.

set -e

CHANGE_NAME="${1:?Usage: state-guard.sh <change-name> <from> <to>}"
FROM="${2:?}"
TO="${3:?}"

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")
CHANGE_DIR="$REPO_ROOT/openspec/changes/$CHANGE_NAME"

# Color helpers
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

ALL_PASSED=true

check_file() {
  local label="$1"
  local path="$2"
  if [ -f "$path" ] || [ -d "$path" ]; then
    echo -e "  ${GREEN}✓${NC} $label"
  else
    echo -e "  ${RED}✗${NC} $label"
    ALL_PASSED=false
  fi
}

# Check change directory exists
check_file "Change directory" "$CHANGE_DIR"

if [ "$FROM" = "open" ] && [ "$TO" = "design" ]; then
  check_file "proposal.md" "$CHANGE_DIR/proposal.md"
fi

if [ "$FROM" = "design" ] && [ "$TO" = "build" ]; then
  check_file "proposal.md" "$CHANGE_DIR/proposal.md"
  check_file "design.md" "$CHANGE_DIR/design.md"
  check_file "specs/" "$CHANGE_DIR/specs"
  check_file "tasks.md" "$CHANGE_DIR/tasks.md"
fi

if [ "$FROM" = "build" ] && [ "$TO" = "verify" ]; then
  check_file "proposal.md" "$CHANGE_DIR/proposal.md"
  check_file "design.md" "$CHANGE_DIR/design.md"
  check_file "tasks.md" "$CHANGE_DIR/tasks.md"
fi

if [ "$FROM" = "verify" ] && [ "$TO" = "archive" ]; then
  check_file "proposal.md" "$CHANGE_DIR/proposal.md"
  check_file "design.md" "$CHANGE_DIR/design.md"
  check_file "tasks.md" "$CHANGE_DIR/tasks.md"
  check_file "specs/" "$CHANGE_DIR/specs"
fi

if [ "$ALL_PASSED" = true ]; then
  echo -e "\n  ${GREEN}ALL CHECKS PASSED${NC}"
  echo "  Transition: $FROM → $TO ALLOWED"
  exit 0
else
  echo -e "\n  ${RED}SOME CHECKS FAILED${NC}"
  echo "  Transition: $FROM → $TO BLOCKED"
  exit 1
fi

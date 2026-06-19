#!/bin/bash
# IvyFlow State Recovery — standalone checkpoint recovery script.
# Usage: state-recover.sh
#
# Reads .ivy/state.yaml and displays the current checkpoint and history.
# Returns 0 if state file exists, 1 if not found.

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")
STATE_FILE="$REPO_ROOT/.ivy/state.yaml"

if [ ! -f "$STATE_FILE" ]; then
  echo "No lifecycle state to recover."
  echo "Run 'ivy state set <checkpoint>' to initialise."
  exit 1
fi

echo "IvyFlow State Recovery"
echo "══════════════════════"

CHANGE=$(grep "^changeName:" "$STATE_FILE" | cut -d' ' -f2-)
CHECKPOINT=$(grep "^checkpoint:" "$STATE_FILE" | cut -d' ' -f2-)
COUNT=$(grep -c "^  - from:" "$STATE_FILE" || echo 0)

echo "  Recovered:"
echo "    Checkpoint: $CHECKPOINT"
echo "    Change:     $CHANGE"
echo ""
echo "  Transition History Available: $COUNT transitions"
echo "  Action: Continue from last checkpoint."

exit 0

#!/bin/bash
# IvyFlow Cursor preToolUse guard — blocks code edits in non-build phases.
#
# Called by Cursor's hooks.json preToolUse hook on Edit/Write tools.
# Uses `ivy validate` to check the current phase. If ivy is not installed,
# the hook silently allows the operation (defense-in-depth: rule file is primary).
#
# Cursor hook JSON protocol (stdout):
#   {"permission":"deny","user_message":"...","agent_message":"..."}
#   {"permission":"allow"}

set -u

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo '')"
if [ -z "${REPO_ROOT}" ]; then
  echo '{"permission":"allow","agent_message":"not a git repo"}'
  exit 0
fi

if ! command -v ivy >/dev/null 2>&1; then
  # ivy CLI not available — silently allow (rule file is primary defense)
  echo '{"permission":"allow","agent_message":"ivy CLI not found"}'
  exit 0
fi

ivy_validate_output="$(ivy validate 2>&1)"
ivy_exit=$?

if [ ${ivy_exit} -ne 0 ]; then
  summary="$(echo "${ivy_validate_output}" | tail -1)"
  cat >&2 <<SCRIPTEOF
❌ IvyFlow phase guard blocked this action.

${summary}

This change needs to be in the 'build' phase for code edits.
Run \`ivy status\` to check the current phase.
SCRIPTEOF

  echo '{"permission":"deny","user_message":"IvyFlow blocked this action - the current change is not in the build phase. Run `ivy status` to check.","agent_message":"Phase guard blocked: current change is not in a build phase. Only code edits during the build phase are allowed."}'
  exit 1
fi

echo '{"permission":"allow"}'
exit 0

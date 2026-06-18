#!/usr/bin/env bash
# IvyFlow Git pre-push guard — secondary defense (the rule file is primary).
#
# Behavior:
#   - Triggers only on branches whose name matches `ivy/<change-name>`.
#   - Reads `openspec/changes/<change-name>/.ivy.yaml`, extracts the top-level
#     `phase:` value with grep/awk (no yq / yaml lib required).
#   - Blocks the push when phase != "archive".
#   - When blocked, also runs `ivy suggest --stuck` for workflow suggestions.
#   - All other branches / missing yaml / unparseable yaml → exit 0 (no-op).
#
# Bypass: `git push --no-verify`. This is an enforcer, not a sandbox.

set -u

current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"

# Branches not under `ivy/` prefix → not our concern.
case "${current_branch}" in
  ivy/*) ;;
  *) exit 0 ;;
esac

change_name="${current_branch#ivy/}"
if [ -z "${change_name}" ]; then
  exit 0
fi

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || echo '')"
if [ -z "${repo_root}" ]; then
  exit 0
fi

yaml_path="${repo_root}/openspec/changes/${change_name}/.ivy.yaml"
if [ ! -f "${yaml_path}" ]; then
  # Missing yaml → silent no-op per spec.
  exit 0
fi

# Extract first top-level `phase:` line. Match only lines starting in column 0
# (not nested under another key). Strip optional quotes.
phase_value="$(grep -E '^phase:[[:space:]]*' "${yaml_path}" | head -n 1 | awk -F':' '{print $2}' | sed -E "s/^[[:space:]]+|[[:space:]]+$//g; s/^['\"]//; s/['\"]$//")"

if [ -z "${phase_value}" ]; then
  # No parseable phase → silent no-op (defensive; rule file is primary defense).
  exit 0
fi

# Non-blocking: run ivy check to show critical suggestions (advisory only)
if command -v ivy >/dev/null 2>&1; then
  check_output="$(ivy check --change "${change_name}" --exit-code --fail-on any_critical 2>&1)" && {
    echo "" >&2
    echo "${check_output}" >&2
  }
fi

if [ "${phase_value}" = "archive" ]; then
  exit 0
fi

cat >&2 <<EOF
❌ Ivy: change '${change_name}' is in '${phase_value}' phase, push blocked.

   Workflow phases must reach 'archive' before pushing.
   - Run \`ivy status --change ${change_name}\` to inspect current state.
   - Bypass (escape hatch): \`git push --no-verify\`
EOF

# Also run suggest engine (best-effort) to show workflow suggestions
if command -v ivy >/dev/null 2>&1; then
  suggest_output="$(ivy suggest --change "${change_name}" --stuck 2>/dev/null)" && {
    echo "${suggest_output}" >&2
  }
fi

exit 1

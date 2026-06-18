/**
 * Cursor PreToolUse hook config — renders .cursor/hooks.json.
 *
 * Cursor supports a hooks.json file with preToolUse, postToolUse, etc.
 * The hook calls `.cursor/hooks/ivy-phase-guard.sh` and blocks edits
 * when `ivy validate` exits non-zero.
 *
 * See https://cursor.com/docs/hooks for full reference.
 */

export function renderHookForCursor(): string {
  const hook = {
    version: 1,
    hooks: {
      preToolUse: [
        {
          command: '.cursor/hooks/ivy-phase-guard.sh',
          matcher: 'Edit|Write',
        },
      ],
    },
  };
  return JSON.stringify(hook, null, 2) + '\n';
}

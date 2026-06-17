/**
 * Windsurf PreToolUse hook config — single static JSON string. ≤ 30 lines.
 * Triggered when the agent attempts Edit/Write while the change phase is
 * `open`/`design`/`archive`. Delegates the actual decision to `ivy validate`.
 */

export function renderHookForWindsurf(): string {
  const hook = {
    name: 'ivy-phase-guard',
    event: 'PreToolUse',
    match: {
      tools: ['Edit', 'Write', 'NotebookEdit'],
    },
    command: 'ivy validate',
    blockOnNonZeroExit: true,
    description: 'IvyFlow phase guard — blocks code edits in non-build phases',
  };
  return JSON.stringify(hook, null, 2) + '\n';
}

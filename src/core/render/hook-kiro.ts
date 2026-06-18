/**
 * Kiro PreToolUse hook config — rendered JSON string.
 * Experimental — no stability guarantee.
 * Uses Kiro's hook file format with type/command/label.
 */

export function renderHookForKiro(): string {
  const hook = {
    hook: {
      type: 'preToolUse',
      command: 'bash .ivy/hooks/ivy-phase-guard.sh',
      label: 'IvyFlow Phase Guard (Experimental)',
    },
  };
  return JSON.stringify(hook, null, 2) + '\n';
}
/**
 * Qwen Code PreToolUse hook config — rendered JSON string.
 * Experimental — no stability guarantee.
 * Uses Qwen Code's preToolUse settings format with enabled flag.
 */

export function renderHookForQwen(): string {
  const hook = {
    preToolUse: {
      enabled: true,
      script: '.ivy/hooks/ivy-phase-guard.sh',
      description: 'IvyFlow Phase Guard (Experimental)',
    },
  };
  return JSON.stringify(hook, null, 2) + '\n';
}
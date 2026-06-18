/**
 * Gemini CLI PreToolUse hook config — rendered JSON string.
 * Experimental — no stability guarantee.
 * Uses Gemini's beforeTool hook format in settings.json.
 */

export function renderHookForGemini(): string {
  const hook = {
    beforeTool: {
      command: 'cat .ivy/hooks/ivy-phase-guard.sh',
      description: 'IvyFlow Phase Guard (Experimental)',
    },
  };
  return JSON.stringify(hook, null, 2) + '\n';
}
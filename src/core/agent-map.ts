/**
 * Agent Name Mapping -- v0.18 Layer 3 read-only data.
 * Maps platform IDs to their CLI agent names. null means no agent CLI.
 */
export const SKILLS_AGENT_MAP: Record<string, string | null> = {
  claude: 'claude-code', cursor: 'cursor', codex: 'codex',
  opencode: 'opencode', windsurf: 'windsurf', cline: 'cline',
  roocode: 'roo', continue: 'continue', 'github-copilot': 'github-copilot',
  'gemini-cli': 'gemini-cli', 'amazon-q': 'universal', qwen: 'qwen-code',
  kilocode: 'kilo', auggie: 'augment', kiro: 'kiro-cli',
  'kimi-code': 'kimi-code-cli', lingma: null, junie: 'junie',
  codebuddy: 'codebuddy', costrict: 'universal', crush: 'crush',
  factory: 'droid', iflow: 'iflow-cli', pi: 'pi', qoder: 'qoder',
  antigravity: 'antigravity', bob: 'bob', forgecode: 'forgecode', trae: 'trae',
};

export function getAgentName(platformId: string): string | null {
  return SKILLS_AGENT_MAP[platformId] ?? null;
}

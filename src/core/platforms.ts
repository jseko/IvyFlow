/**
 * Platform Definitions — v0.2 ships 7 platforms (Claude Code / CodeBuddy /
 * Cursor / GitHub Copilot / Windsurf / Trae / Qoder).
 *
 * Pure data: no `Platform` interface registry, no factory, no `register()`.
 * New platforms = append one row to PLATFORMS (D1, design.md §9.1 red line).
 */

import type { InstallScope } from './types.js';

export type RuleFormat = 'md' | 'mdc' | 'copilot';
export type HookFormat = 'claude-code' | 'windsurf-json' | 'cursor-json' | 'gemini' | 'qwen' | 'kiro';
export type PlatformCertification = 'certified' | 'experimental' | 'planned' | 'deprecated' | 'unsupported';

export interface Platform {
  id: string;
  name: string;
  /** Project-scope skills root (relative to project root). */
  skillsDir: string;
  /** Optional global-scope skills root (relative to homedir). Falls back to skillsDir. */
  globalSkillsDir?: string;
  /** Tool id passed to `openspec init --tools <id>`. Empty string = skip openspec for this platform. */
  openspecToolId: string;
  /** Rules subdirectory under skillsDir. */
  rulesDir?: string;
  /** Rule file format: md (direct copy) / mdc (Cursor frontmatter) / copilot (DO/DO-NOT). */
  rulesFormat?: RuleFormat;
  /** Whether the platform supports PreToolUse hooks. */
  supportsHooks?: boolean;
  /** Hook configuration format. */
  hookFormat?: HookFormat;
  /** Where to write hook config relative to skillsDir (only when hookFormat is set). */
  hookPath?: string;
  /**
   * Detection probe paths in priority order (first match wins).
   * When set, detectPlatforms uses these instead of the deprecated CONFIDENCE_BY_PATH.
   * @since v0.7
   */
  detectionPaths?: Array<{ rel: string; confidence: 1.0 | 0.8 | 0.6 }>;
  /**
   * Certification level for platform maturity tracking.
   * @since v0.8
   */
  certification: PlatformCertification;
  /**
   * Optional rules base directory. When set, rules are installed here instead of skillsDir.
   * @since v0.8
   */
  rulesBaseDir?: string;
}

export function getPlatformSkillsDir(platform: Platform, scope: InstallScope): string {
  if (scope === 'global' && platform.globalSkillsDir) {
    return platform.globalSkillsDir;
  }
  return platform.skillsDir;
}

/**
 * v0.8 supports 16 platforms (11 Certified + 5 Experimental).
 * Order matters: 4 unique-format platforms first, then md-only platforms,
 * then new Certified platforms, then Experimental platforms.
 */
export const PLATFORMS: Platform[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    skillsDir: '.claude',
    globalSkillsDir: '.claude',
    openspecToolId: 'claude',
    rulesDir: 'rules',
    rulesFormat: 'md',
    supportsHooks: true,
    hookFormat: 'claude-code',
    certification: 'certified',
    detectionPaths: [
      { rel: '.claude/settings.json', confidence: 1.0 },
      { rel: '.claude/settings.local.json', confidence: 1.0 },
      { rel: '.claude/skills', confidence: 0.8 },
      { rel: '.claude', confidence: 0.6 },
    ],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    skillsDir: '.cursor',
    openspecToolId: '',
    rulesDir: 'rules',
    rulesFormat: 'mdc',
    supportsHooks: true,
    hookFormat: 'cursor-json',
    hookPath: 'hooks.json',
    certification: 'certified',
    detectionPaths: [
      { rel: '.cursor/settings.json', confidence: 1.0 },
      { rel: '.cursor/rules', confidence: 0.8 },
      { rel: '.cursor', confidence: 0.6 },
    ],
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    skillsDir: '.github',
    openspecToolId: '',
    // Copilot reads `.github/copilot-instructions.md` directly — rulesDir empty,
    // file written at the skillsDir root via custom path in render.
    rulesDir: '',
    rulesFormat: 'copilot',
    certification: 'certified',
    detectionPaths: [
      { rel: '.github/copilot-instructions.md', confidence: 1.0 },
      { rel: '.github', confidence: 0.6 },
    ],
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    skillsDir: '.windsurf',
    openspecToolId: '',
    rulesDir: 'rules',
    rulesFormat: 'md',
    supportsHooks: true,
    hookFormat: 'windsurf-json',
    hookPath: 'hooks/ivy-phase-guard.json',
    certification: 'certified',
    detectionPaths: [
      { rel: '.windsurf/settings.json', confidence: 1.0 },
      { rel: '.windsurf/rules', confidence: 0.8 },
      { rel: '.windsurf', confidence: 0.6 },
    ],
  },
  {
    id: 'codebuddy',
    name: 'CodeBuddy',
    skillsDir: '.codebuddy',
    openspecToolId: '',
    rulesDir: 'rules',
    rulesFormat: 'md',
    certification: 'certified',
    detectionPaths: [
      { rel: '.codebuddy/rules', confidence: 0.8 },
      { rel: '.codebuddy', confidence: 0.6 },
    ],
  },
  {
    id: 'trae',
    name: 'Trae',
    skillsDir: '.trae',
    openspecToolId: '',
    rulesDir: 'rules',
    rulesFormat: 'md',
    certification: 'certified',
    detectionPaths: [
      { rel: '.trae/rules/project_rules.md', confidence: 1.0 },
      { rel: '.trae/rules', confidence: 0.8 },
      { rel: '.trae', confidence: 0.6 },
    ],
  },
  {
    id: 'qoder',
    name: 'Qoder',
    skillsDir: '.qoder',
    openspecToolId: '',
    rulesDir: 'rules',
    rulesFormat: 'md',
    certification: 'certified',
    detectionPaths: [
      { rel: '.qoder/rules', confidence: 0.8 },
      { rel: '.qoder', confidence: 0.6 },
    ],
  },
  {
    id: 'cline',
    name: 'Cline',
    skillsDir: '.cline',
    openspecToolId: '',
    rulesDir: 'rules',
    rulesFormat: 'md',
    certification: 'certified',
    detectionPaths: [
      { rel: '.cline/settings.json', confidence: 1.0 },
      { rel: '.cline/rules', confidence: 0.8 },
      { rel: '.cline', confidence: 0.6 },
    ],
  },
  {
    id: 'amazon-q',
    name: 'Amazon Q',
    skillsDir: '.amazonq',
    openspecToolId: '',
    rulesDir: 'rules',
    rulesFormat: 'md',
    certification: 'certified',
    detectionPaths: [
      { rel: '.amazonq/rules', confidence: 0.8 },
      { rel: '.amazonq', confidence: 0.6 },
    ],
  },
  // ── v0.8 New Certified Platforms ──
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    skillsDir: '.gemini',
    openspecToolId: '',
    rulesDir: 'rules',
    rulesFormat: 'md',
    supportsHooks: true,
    hookFormat: 'gemini',
    hookPath: 'hooks/ivy-phase-guard.json',
    certification: 'certified',
    detectionPaths: [
      { rel: '.gemini/settings.json', confidence: 1.0 },
      { rel: '.gemini', confidence: 0.8 },
    ],
  },
  {
    id: 'roocode',
    name: 'RooCode',
    skillsDir: '.roo',
    openspecToolId: '',
    rulesDir: 'rules',
    rulesFormat: 'md',
    certification: 'certified',
    detectionPaths: [
      { rel: '.roo/rules', confidence: 0.8 },
      { rel: '.roo', confidence: 0.6 },
    ],
  },
  // ── v0.8 Experimental Platforms ──
  {
    id: 'continue',
    name: 'Continue',
    skillsDir: '.continue',
    openspecToolId: '',
    rulesDir: 'rules',
    rulesFormat: 'md',
    certification: 'experimental',
    detectionPaths: [
      { rel: '.continue/config.json', confidence: 0.8 },
      { rel: '.continue', confidence: 0.6 },
    ],
  },
  {
    id: 'kilocode',
    name: 'Kilo Code',
    skillsDir: '.kilocode',
    openspecToolId: '',
    rulesDir: 'rules',
    rulesFormat: 'md',
    certification: 'experimental',
    detectionPaths: [
      { rel: '.kilocode/rules', confidence: 0.8 },
      { rel: '.kilocode', confidence: 0.6 },
    ],
  },
  {
    id: 'auggie',
    name: 'Auggie (Augment)',
    skillsDir: '.augment',
    openspecToolId: '',
    rulesDir: 'rules',
    rulesFormat: 'md',
    certification: 'experimental',
    detectionPaths: [
      { rel: '.augment/rules', confidence: 0.8 },
      { rel: '.augment', confidence: 0.6 },
    ],
  },
  {
    id: 'kimi-code',
    name: 'Kimi Code',
    skillsDir: '.kimi-code',
    openspecToolId: '',
    rulesDir: 'rules',
    rulesFormat: 'md',
    certification: 'experimental',
    detectionPaths: [
      { rel: '.kimi-code/rules', confidence: 0.8 },
      { rel: '.kimi-code', confidence: 0.6 },
    ],
  },
  {
    id: 'lingma',
    name: 'Lingma',
    skillsDir: '.lingma',
    openspecToolId: '',
    rulesDir: 'rules',
    rulesFormat: 'md',
    certification: 'experimental',
    detectionPaths: [
      { rel: '.lingma/rules', confidence: 0.8 },
      { rel: '.lingma', confidence: 0.6 },
    ],
  },
  // ── v0.18 New Experimental Platforms ──
  { id: 'codex', name: 'Codex CLI', skillsDir: '.codex', openspecToolId: '', rulesDir: 'rules', rulesFormat: 'md', certification: 'experimental', detectionPaths: [{ rel: '.codex/rules', confidence: 0.8 }, { rel: '.codex', confidence: 0.6 }] },
  { id: 'opencode', name: 'OpenCode', skillsDir: '.opencode', openspecToolId: '', rulesDir: 'rules', rulesFormat: 'md', certification: 'experimental', detectionPaths: [{ rel: '.opencode/rules', confidence: 0.8 }, { rel: '.opencode', confidence: 0.6 }] },
  { id: 'qwen', name: 'Qwen Code', skillsDir: '.qwen', openspecToolId: '', rulesDir: 'rules', rulesFormat: 'md', certification: 'experimental', detectionPaths: [{ rel: '.qwen/settings.json', confidence: 1.0 }, { rel: '.qwen/rules', confidence: 0.8 }, { rel: '.qwen', confidence: 0.6 }] },
  { id: 'kiro', name: 'Kiro', skillsDir: '.kiro', openspecToolId: '', rulesDir: 'rules', rulesFormat: 'md', supportsHooks: true, hookFormat: 'kiro', hookPath: 'hooks/ivy-phase-guard.json', certification: 'experimental', detectionPaths: [{ rel: '.kiro/settings.json', confidence: 1.0 }, { rel: '.kiro/rules', confidence: 0.8 }, { rel: '.kiro', confidence: 0.6 }] },
  { id: 'junie', name: 'Junie', skillsDir: '.junie', openspecToolId: '', rulesDir: 'rules', rulesFormat: 'md', certification: 'experimental', detectionPaths: [{ rel: '.junie/rules', confidence: 0.8 }, { rel: '.junie', confidence: 0.6 }] },
  { id: 'costrict', name: 'CoStrict', skillsDir: '.costrict', openspecToolId: '', rulesDir: 'rules', rulesFormat: 'md', certification: 'experimental', detectionPaths: [{ rel: '.costrict/rules', confidence: 0.8 }, { rel: '.costrict', confidence: 0.6 }] },
  { id: 'crush', name: 'Crush', skillsDir: '.crush', openspecToolId: '', rulesDir: 'rules', rulesFormat: 'md', certification: 'experimental', detectionPaths: [{ rel: '.crush/rules', confidence: 0.8 }, { rel: '.crush', confidence: 0.6 }] },
  { id: 'factory', name: 'Factory (Droid)', skillsDir: '.factory', openspecToolId: '', rulesDir: 'rules', rulesFormat: 'md', certification: 'experimental', detectionPaths: [{ rel: '.factory/rules', confidence: 0.8 }, { rel: '.factory', confidence: 0.6 }] },
  { id: 'iflow', name: 'IFlow CLI', skillsDir: '.iflow', openspecToolId: '', rulesDir: 'rules', rulesFormat: 'md', certification: 'experimental', detectionPaths: [{ rel: '.iflow/rules', confidence: 0.8 }, { rel: '.iflow', confidence: 0.6 }] },
  { id: 'pi', name: 'Pi', skillsDir: '.pi', openspecToolId: '', rulesDir: 'rules', rulesFormat: 'md', certification: 'experimental', detectionPaths: [{ rel: '.pi/rules', confidence: 0.8 }, { rel: '.pi', confidence: 0.6 }] },
  { id: 'antigravity', name: 'AntiGravity', skillsDir: '.antigravity', openspecToolId: '', rulesDir: 'rules', rulesFormat: 'md', certification: 'experimental', detectionPaths: [{ rel: '.antigravity/rules', confidence: 0.8 }, { rel: '.antigravity', confidence: 0.6 }] },
  { id: 'bob', name: 'Bob', skillsDir: '.bob', openspecToolId: '', rulesDir: 'rules', rulesFormat: 'md', certification: 'experimental', detectionPaths: [{ rel: '.bob/rules', confidence: 0.8 }, { rel: '.bob', confidence: 0.6 }] },
  { id: 'forgecode', name: 'Forge Code', skillsDir: '.forgecode', openspecToolId: '', rulesDir: 'rules', rulesFormat: 'md', certification: 'experimental', detectionPaths: [{ rel: '.forgecode/rules', confidence: 0.8 }, { rel: '.forgecode', confidence: 0.6 }] },
];

export function getPlatformById(id: string): Platform | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

export type PlatformLifecycle = 'certified' | 'experimental' | 'planned' | 'deprecated' | 'unsupported';

export const PLATFORM_LIFECYCLE: Record<string, PlatformLifecycle> = {
  claude: 'certified', cursor: 'certified', 'github-copilot': 'certified',
  windsurf: 'certified', codebuddy: 'certified', trae: 'certified',
  qoder: 'certified', cline: 'certified', 'amazon-q': 'certified',
  'gemini-cli': 'certified', roocode: 'certified',
  continue: 'experimental', kilocode: 'experimental', auggie: 'experimental',
  'kimi-code': 'experimental', lingma: 'experimental',
  codex: 'experimental', opencode: 'experimental', qwen: 'experimental',
  kiro: 'experimental', junie: 'experimental', costrict: 'experimental',
  crush: 'experimental', factory: 'experimental', iflow: 'experimental',
  pi: 'experimental', antigravity: 'experimental', bob: 'experimental',
  forgecode: 'experimental',
};

export function getPlatformLifecycle(platformId: string): PlatformLifecycle {
  return PLATFORM_LIFECYCLE[platformId] ?? 'experimental';
}

export function getPlatformsByLifecycle(): Record<PlatformLifecycle, string[]> {
  const groups: Record<PlatformLifecycle, string[]> = {
    certified: [], experimental: [], planned: [], deprecated: [], unsupported: [],
  };
  for (const p of PLATFORMS) {
    const lifecycle = getPlatformLifecycle(p.id);
    groups[lifecycle].push(p.id);
  }
  return groups;
}

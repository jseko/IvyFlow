/**
 * Platform Definitions — v0.2 ships 7 platforms (Claude Code / CodeBuddy /
 * Cursor / GitHub Copilot / Windsurf / Trae / Qoder).
 *
 * Pure data: no `Platform` interface registry, no factory, no `register()`.
 * New platforms = append one row to PLATFORMS (D1, design.md §9.1 red line).
 */

import type { InstallScope } from './types.js';

export type RuleFormat = 'md' | 'mdc' | 'copilot';
export type HookFormat = 'claude-code' | 'windsurf-json';

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
}

export function getPlatformSkillsDir(platform: Platform, scope: InstallScope): string {
  if (scope === 'global' && platform.globalSkillsDir) {
    return platform.globalSkillsDir;
  }
  return platform.skillsDir;
}

/**
 * v0.2 supports 7 platforms. Order matters: 4 unique-format platforms first,
 * 3 md-only same-shape platforms last (Trae / Qoder / CodeBuddy validate D1).
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
  },
  {
    id: 'cursor',
    name: 'Cursor',
    skillsDir: '.cursor',
    openspecToolId: '',
    rulesDir: 'rules',
    rulesFormat: 'mdc',
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
  },
  {
    id: 'codebuddy',
    name: 'CodeBuddy',
    skillsDir: '.codebuddy',
    openspecToolId: '',
    rulesDir: 'rules',
    rulesFormat: 'md',
  },
  {
    id: 'trae',
    name: 'Trae',
    skillsDir: '.trae',
    openspecToolId: '',
    rulesDir: 'rules',
    rulesFormat: 'md',
  },
  {
    id: 'qoder',
    name: 'Qoder',
    skillsDir: '.qoder',
    openspecToolId: '',
    rulesDir: 'rules',
    rulesFormat: 'md',
  },
];

export function getPlatformById(id: string): Platform | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

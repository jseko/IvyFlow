/**
 * Platform Definitions — v0.1 ships only Claude Code.
 * The shape mirrors Comet so v0.2 can add platforms by appending to PLATFORMS
 * without changing call sites.
 */

import type { InstallScope } from './types.js';

export interface Platform {
  id: string;
  name: string;
  /** Project-scope skills root (relative to project root). */
  skillsDir: string;
  /** Optional global-scope skills root (relative to homedir). Falls back to skillsDir. */
  globalSkillsDir?: string;
  /** Tool id passed to `openspec init --tools <id>`. */
  openspecToolId: string;
  /** Rules subdirectory under skillsDir. */
  rulesDir?: string;
  /** Rule file format. v0.1 only emits 'md'. */
  rulesFormat?: 'md';
  /** Whether the platform supports PreToolUse hooks (deferred to v0.2). */
  supportsHooks?: boolean;
  /** Hook configuration format (deferred to v0.2). */
  hookFormat?: 'claude-code';
}

export function getPlatformSkillsDir(platform: Platform, scope: InstallScope): string {
  if (scope === 'global' && platform.globalSkillsDir) {
    return platform.globalSkillsDir;
  }
  return platform.skillsDir;
}

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
];

export function getPlatformById(id: string): Platform | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

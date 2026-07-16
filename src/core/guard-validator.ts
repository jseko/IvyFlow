/**
 * Guard Validator — file-system-based three-layer guard detection.
 *
 * Layer 1 (Hook): Checks platform hook files exist and contain an Ivy marker.
 * Layer 2 (Rule): Checks rule files exist in platform rules directories.
 * Layer 3 (Git Hook): Checks .git/hooks/pre-push has IvyFlow marker.
 *
 * @since v0.15
 */

import { promises as fs } from 'fs';
import path from 'path';

import { getPlatformSkillsDir } from './platforms.js';
import type { Platform } from './platforms.js';
import { fileExists, readDir } from '../utils/fs.js';

/** Result of a single guard-layer check. */
export interface LayerResult {
  installed: boolean;
  path?: string;
  detail?: string;
}

/** Full three-layer guard-validation result. */
export interface GuardValidationResult {
  hook: LayerResult;
  rule: LayerResult & { count: number; phases: string[] };
  gitHook: LayerResult;
}

const IVY_MARKER = 'IvyFlow';
const IVY_PREPUSH_MARKER = 'ivy-git-prepush';

/**
 * Check Layer 1 — Platform Hook file.
 *
 * Verifies the platform's hook file exists and contains an Ivy marker string.
 */
async function checkHook(platform: Platform, cwd: string): Promise<LayerResult> {
  if (!platform.supportsHooks || !platform.hookFormat) {
    return { installed: false, detail: 'Platform does not support hooks' };
  }

  const skillsDir = getPlatformSkillsDir(platform, 'project');
  const hookRelPath = platform.hookPath ?? `${skillsDir}/hooks/ivy-phase-guard.json`;
  const hookPath = path.resolve(cwd, skillsDir, platform.hookPath ?? '');

  if (!(await fileExists(hookPath))) {
    return { installed: false, path: hookPath, detail: 'Hook file not found' };
  }

  try {
    const content = await fs.readFile(hookPath, 'utf-8');
    if (content.includes(IVY_MARKER)) {
      return { installed: true, path: hookPath, detail: `Hook file contains Ivy marker` };
    }
    return { installed: false, path: hookPath, detail: 'Hook file missing Ivy marker' };
  } catch {
    return { installed: false, path: hookPath, detail: 'Could not read hook file' };
  }
}

/**
 * Check Layer 2 — Rule files.
 *
 * Scans the platform's rules directory for Ivy rule files and counts them.
 */
async function checkRules(platform: Platform, cwd: string): Promise<GuardValidationResult['rule']> {
  const rulesDir = platform.rulesBaseDir
    ? path.resolve(cwd, platform.rulesBaseDir)
    : path.resolve(cwd, getPlatformSkillsDir(platform, 'project'), platform.rulesDir ?? 'rules');

  const entries = await readDir(rulesDir);
  const ivyRuleFiles = entries.filter(
    (f) => f.startsWith('ivy-') && (f.endsWith('.md') || f.endsWith('.mdc')),
  );

  if (ivyRuleFiles.length === 0) {
    return { installed: false, count: 0, phases: [], path: rulesDir, detail: 'No Ivy rule files found' };
  }

  // Extract phase keywords from rule file names
  const phases: string[] = [];
  for (const f of ivyRuleFiles) {
    const match = f.match(/ivy-(phase-guard|security)/);
    if (match) phases.push(match[1]);
  }

  return {
    installed: true,
    count: ivyRuleFiles.length,
    phases: [...new Set(phases)],
    path: rulesDir,
    detail: `${ivyRuleFiles.length} Ivy rule file(s) found`,
  };
}

/**
 * Check Layer 3 — Git pre-push hook.
 *
 * Verifies .git/hooks/pre-push exists and contains the IvyFlow pre-push marker.
 */
async function checkGitHook(cwd: string): Promise<LayerResult> {
  const prepushPath = path.resolve(cwd, '.git', 'hooks', 'pre-push');

  if (!(await fileExists(prepushPath))) {
    return { installed: false, path: prepushPath, detail: 'pre-push hook not found' };
  }

  try {
    const content = await fs.readFile(prepushPath, 'utf-8');
    if (content.includes(IVY_PREPUSH_MARKER)) {
      return { installed: true, path: prepushPath, detail: 'pre-push hook contains IvyFlow marker' };
    }
    return { installed: false, path: prepushPath, detail: 'pre-push hook missing IvyFlow marker' };
  } catch {
    return { installed: false, path: prepushPath, detail: 'Could not read pre-push hook' };
  }
}

/**
 * Run full three-layer guard validation for a single platform.
 *
 * @param platform - The platform to validate guards for.
 * @param cwd      - Project root directory.
 */
export async function runGuardValidation(
  platform: Platform,
  cwd: string = process.cwd(),
): Promise<GuardValidationResult> {
  const [hookResult, ruleResult, gitHookResult] = await Promise.all([
    checkHook(platform, cwd),
    checkRules(platform, cwd),
    checkGitHook(cwd),
  ]);

  return {
    hook: hookResult,
    rule: ruleResult,
    gitHook: gitHookResult,
  };
}

/**
 * Run guard validation for the first Tier-1 platform in the project,
 * or fall back to checking generic paths.
 *
 * Convenience wrapper for `ivy status` integration.
 */
export async function runDefaultGuardValidation(cwd: string = process.cwd()): Promise<GuardValidationResult> {
  // Dynamic import to avoid circular dependency
  const { PLATFORMS } = await import('./platforms.js');
  const t1Platform = PLATFORMS.find((p) => p.tier === 1);
  if (t1Platform) {
    return runGuardValidation(t1Platform, cwd);
  }

  // Fallback: check generic paths
  const gitHookResult = await checkGitHook(cwd);
  return {
    hook: { installed: false, detail: 'No Tier-1 platform found' },
    rule: { installed: false, count: 0, phases: [], detail: 'No Tier-1 platform found' },
    gitHook: gitHookResult,
  };
}

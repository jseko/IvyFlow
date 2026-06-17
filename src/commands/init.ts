/**
 * `ivy init` — bootstraps a project for the IvyFlow workflow.
 *
 * v0.2: detects all 7 platforms with confidence scores; prompts user to
 * multi-select platforms (or auto-selects in quick mode); installs Skills /
 * Rules / Hooks per-platform in parallel.
 */

import path from 'path';
import os from 'os';
import { confirm, select, checkbox } from '@inquirer/prompts';

import { detectPlatforms, type PlatformDetectResult } from '../core/detect.js';
import {
  copyIvySkillsForPlatform,
  copyIvyRulesForPlatform,
  installIvyHookForPlatform,
} from '../core/skills.js';
import { installGitPrePushHook } from '../core/git-hook.js';
import { defaultSpecAdapter } from '../core/spec-adapter.js';
import { writeYaml } from '../utils/yaml.js';
import { logger } from '../utils/logger.js';
import { PLATFORMS, type Platform } from '../core/platforms.js';
import type { InstallScope } from '../core/types.js';

export type InitMode = 'quick' | 'standard' | 'enterprise';

export interface InitOptions {
  mode?: InitMode;
  cwd?: string;
  skipOpenSpec?: boolean;
  overwrite?: boolean;
  /** Override platform selection (used by tests / non-interactive callers). */
  platforms?: string[];
}

interface InitDecisions {
  scope: InstallScope;
  overwrite: boolean;
  platforms: Platform[];
}

interface PlatformInstallReport {
  id: string;
  ok: boolean;
  error?: string;
}

function annotateChoice(r: PlatformDetectResult): { name: string; value: string; checked: boolean } {
  let suffix = '';
  let checked = false;
  if (r.detected) {
    if (r.confidence === 1.0) {
      suffix = ' (detected)';
      checked = true;
    } else if (r.confidence === 0.8) {
      suffix = ' (rules dir)';
      checked = true;
    } else {
      suffix = ' (low confidence — please confirm)';
      checked = false;
    }
  }
  return { name: `${r.platform.name}${suffix}`, value: r.platform.id, checked };
}

/** Pick platforms to install. quick = auto (>=0.8 detected); standard = checkbox. */
export async function selectPlatforms(
  detected: PlatformDetectResult[],
  mode: InitMode,
  override?: string[],
): Promise<Platform[]> {
  if (override && override.length > 0) {
    return PLATFORMS.filter((p) => override.includes(p.id));
  }
  if (mode === 'quick') {
    const picks = detected.filter((r) => r.detected && r.confidence >= 0.8).map((r) => r.platform);
    // Default to claude if nothing detected so quick mode still works on a clean repo.
    if (picks.length === 0) {
      const claude = PLATFORMS.find((p) => p.id === 'claude');
      return claude ? [claude] : [];
    }
    return picks;
  }
  const choices = detected.map(annotateChoice);
  const picked = (await checkbox({
    message: 'Select platforms to install IvyFlow into',
    choices,
    required: true,
  })) as string[];
  return PLATFORMS.filter((p) => picked.includes(p.id));
}

async function runStandardWizard(
  detected: PlatformDetectResult[],
  defaultOverwrite: boolean,
  override?: string[],
): Promise<InitDecisions> {
  const scope = (await select({
    message: 'Install scope?',
    choices: [
      { name: 'Project (recommended)', value: 'project' },
      { name: 'Global (~)', value: 'global' },
    ],
    default: 'project',
  })) as InstallScope;

  const overwrite = await confirm({
    message: 'Overwrite existing IvyFlow files if present?',
    default: defaultOverwrite,
  });

  const platforms = await selectPlatforms(detected, 'standard', override);
  return { scope, overwrite, platforms };
}

async function installForOnePlatform(
  cwd: string,
  platform: Platform,
  overwrite: boolean,
  scope: InstallScope,
): Promise<PlatformInstallReport> {
  try {
    const skills = await copyIvySkillsForPlatform(cwd, platform, overwrite, scope);
    const rules = await copyIvyRulesForPlatform(cwd, platform, overwrite, scope);
    const hook = await installIvyHookForPlatform(cwd, platform, overwrite, scope);
    logger.success(
      `${platform.name}: skills ${skills.copied}/${skills.skipped} skipped, rules ${rules.copied}/${rules.skipped} skipped, hook ${hook.installed ? 'installed' : 'n/a'}`,
    );
    return { id: platform.id, ok: true };
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    logger.error(`${platform.name}: ${msg}`);
    return { id: platform.id, ok: false, error: msg };
  }
}

export async function runInit(opts: InitOptions = {}): Promise<number> {
  const mode: InitMode = opts.mode ?? 'quick';
  const cwd = opts.cwd ?? process.cwd();

  logger.step(`ivy init (${mode} mode) → ${cwd}`);

  const detected = await detectPlatforms(cwd);
  const detectedHits = detected.filter((r) => r.detected);
  if (detectedHits.length > 0) {
    logger.info(
      `Detected platforms: ${detectedHits.map((r) => `${r.platform.id}@${r.confidence}`).join(', ')}`,
    );
  } else {
    logger.warn('No platforms detected — defaulting to Claude Code in quick mode.');
  }

  let decisions: InitDecisions;
  if (mode === 'quick') {
    decisions = {
      scope: 'project',
      overwrite: opts.overwrite ?? false,
      platforms: await selectPlatforms(detected, 'quick', opts.platforms),
    };
  } else {
    decisions = await runStandardWizard(detected, opts.overwrite ?? false, opts.platforms);
    if (mode === 'enterprise') {
      logger.info('Plugin selection: no plugins available yet (v0.1).');
    }
  }

  if (decisions.platforms.length === 0) {
    logger.error('No platforms selected; aborting.');
    return 1;
  }

  // 1) OpenSpec — driven by the first platform that exposes an openspecToolId.
  const toolIds = decisions.platforms.map((p) => p.openspecToolId).filter((id) => id.length > 0);
  if (!opts.skipOpenSpec && toolIds.length > 0) {
    logger.step('Setting up OpenSpec...');
    const cliReady = await defaultSpecAdapter.ensureCli(decisions.scope, cwd);
    if (!cliReady) {
      logger.error('OpenSpec CLI not available; aborting. Run `ivy init` again after installing it.');
      return 1;
    }
    const specResult = await defaultSpecAdapter.init(cwd, toolIds, decisions.scope);
    if (specResult === 'failed') {
      logger.error('OpenSpec init failed; see logs above.');
      return 1;
    }
    logger.success(`OpenSpec ${specResult}.`);
  } else {
    logger.dim(`(OpenSpec setup skipped${toolIds.length === 0 ? ' — no tool ids' : ''})`);
  }

  // 2) Per-platform install in parallel; failures don't block other platforms (R6).
  logger.step(`Installing IvyFlow into ${decisions.platforms.length} platform(s)...`);
  const reports = await Promise.all(
    decisions.platforms.map((p) => installForOnePlatform(cwd, p, decisions.overwrite, decisions.scope)),
  );
  const failed = reports.filter((r) => !r.ok);

  // 3) Git pre-push hook (project scope only).
  if (decisions.scope === 'project') {
    logger.step('Installing git pre-push hook...');
    const hookResult = await installGitPrePushHook(cwd, decisions.overwrite);
    if (hookResult.installed) {
      logger.success(`Hook installed at ${path.relative(cwd, hookResult.path)}`);
    } else if (hookResult.reason === 'no-git') {
      logger.warn('Not a git repo — skipping pre-push hook (you can re-run `ivy init` later).');
    } else {
      logger.dim(`Hook already exists at ${hookResult.path} (use --overwrite to replace).`);
    }
  }

  // 4) `.ivy/project.yaml` — extends v0.1 schema with version + last_migration + detected_platforms[].
  const ivyDir = decisions.scope === 'global' ? path.join(os.homedir(), '.ivy') : path.join(cwd, '.ivy');
  const projectYamlPath = path.join(ivyDir, 'project.yaml');
  await writeYaml(projectYamlPath, {
    version: '0.3.0',
    last_migration: new Date().toISOString(),
    platforms: decisions.platforms.map((p) => p.id),
    scope: decisions.scope,
    spec_adapter: defaultSpecAdapter.name,
    initialized_at: new Date().toISOString(),
    analytics_enabled: false,
    detected_platforms: detected
      .filter((r) => r.detected)
      .map((r) => ({ id: r.platform.id, confidence: r.confidence, matched: r.matchedPath })),
  });
  logger.success(`Wrote ${path.relative(cwd, projectYamlPath)}`);

  if (failed.length > 0) {
    logger.warn(
      `${failed.length} platform(s) failed: ${failed.map((f) => f.id).join(', ')}. Re-run \`ivy init\` or \`ivy doctor --fix\`.`,
    );
    return 2;
  }

  logger.info('');
  logger.info('  Done. Use `/ivy` in your AI coding tool to start the workflow.');
  return 0;
}

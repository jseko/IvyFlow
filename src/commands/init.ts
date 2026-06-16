/**
 * `ivy init` — bootstraps a project for the IvyFlow workflow.
 *
 * Quick mode (default): zero prompts, runs end-to-end.
 * Standard mode: interactive wizard for platform/scope/overwrite.
 * Enterprise mode: standard + plugin prompt placeholder (v0.1: empty list).
 */

import path from 'path';
import os from 'os';
import { confirm, select } from '@inquirer/prompts';

import { detectPlatform } from '../core/detect.js';
import { copyIvySkillsForPlatform, copyIvyRulesForPlatform } from '../core/skills.js';
import { installGitPrePushHook } from '../core/git-hook.js';
import { defaultSpecAdapter } from '../core/spec-adapter.js';
import { writeYaml } from '../utils/yaml.js';
import { logger } from '../utils/logger.js';
import type { InstallScope } from '../core/types.js';

export type InitMode = 'quick' | 'standard' | 'enterprise';

export interface InitOptions {
  mode?: InitMode;
  cwd?: string;
  /** Skip OpenSpec init — used by tests and offline environments. */
  skipOpenSpec?: boolean;
  /** Override `overwrite` (defaults to false). */
  overwrite?: boolean;
}

interface InitDecisions {
  scope: InstallScope;
  overwrite: boolean;
  toolIds: string[];
}

async function runStandardWizard(defaultOverwrite: boolean): Promise<InitDecisions> {
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

  // v0.1: only Claude Code; toolIds always = ['claude']
  return { scope, overwrite, toolIds: ['claude'] };
}

export async function runInit(opts: InitOptions = {}): Promise<number> {
  const mode: InitMode = opts.mode ?? 'quick';
  const cwd = opts.cwd ?? process.cwd();

  logger.step(`ivy init (${mode} mode) → ${cwd}`);

  const { platform, detected } = await detectPlatform(cwd);
  if (!detected) {
    logger.warn(`No .claude/ directory found — assuming Claude Code platform anyway (v0.1).`);
  } else {
    logger.info(`Platform: ${platform.name}`);
  }

  let decisions: InitDecisions;
  if (mode === 'quick') {
    decisions = { scope: 'project', overwrite: opts.overwrite ?? false, toolIds: ['claude'] };
  } else {
    decisions = await runStandardWizard(opts.overwrite ?? false);
    if (mode === 'enterprise') {
      logger.info('Plugin selection: no plugins available yet (v0.1).');
    }
  }

  // 1) OpenSpec (skippable for tests/offline)
  if (!opts.skipOpenSpec) {
    logger.step('Setting up OpenSpec...');
    const cliReady = await defaultSpecAdapter.ensureCli(decisions.scope, cwd);
    if (!cliReady) {
      logger.error('OpenSpec CLI not available; aborting. Run `ivy init` again after installing it.');
      return 1;
    }
    const specResult = await defaultSpecAdapter.init(cwd, decisions.toolIds, decisions.scope);
    if (specResult === 'failed') {
      logger.error('OpenSpec init failed; see logs above.');
      return 1;
    }
    logger.success(`OpenSpec ${specResult}.`);
  } else {
    logger.dim('(OpenSpec setup skipped)');
  }

  // 2) Skills
  logger.step('Copying ivy Skill files...');
  const skillResult = await copyIvySkillsForPlatform(
    cwd,
    platform,
    decisions.overwrite,
    decisions.scope,
  );
  logger.success(`Skills: ${skillResult.copied} copied, ${skillResult.skipped} skipped.`);

  // 3) Rules
  logger.step('Copying phase-guard rule...');
  const ruleResult = await copyIvyRulesForPlatform(
    cwd,
    platform,
    decisions.overwrite,
    decisions.scope,
  );
  logger.success(`Rules: ${ruleResult.copied} copied, ${ruleResult.skipped} skipped.`);

  // 4) Git pre-push hook (project scope only; global has no .git/)
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

  // 5) `.ivy/project.yaml`
  const ivyDir = decisions.scope === 'global' ? path.join(os.homedir(), '.ivy') : path.join(cwd, '.ivy');
  const projectYamlPath = path.join(ivyDir, 'project.yaml');
  await writeYaml(projectYamlPath, {
    version: '0.1.0',
    platform: platform.id,
    scope: decisions.scope,
    spec_adapter: defaultSpecAdapter.name,
    initialized_at: new Date().toISOString(),
  });
  logger.success(`Wrote ${path.relative(cwd, projectYamlPath)}`);

  logger.info('');
  logger.info('  Done. Use `/ivy` in Claude Code to start the workflow.');
  return 0;
}

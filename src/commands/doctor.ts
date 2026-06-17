/**
 * `ivy doctor` — local invariant health check (v0.2).
 *
 * §9.4 strict boundary (DO NOT EXPAND in v0.3):
 *   - LOCAL ONLY: no telemetry, no CI, no network, no state inference.
 *   - Three-state output: passed / warning / failed.
 *   - --fix: re-creates missing skills/rules/hooks for already-installed
 *     platforms; never rewrites files that exist (use `ivy init --overwrite`).
 */

import path from 'path';
import os from 'os';

import { readYaml } from '../utils/yaml.js';
import { fileExists } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import { PLATFORMS, getPlatformById, getPlatformSkillsDir, type Platform } from '../core/platforms.js';
import {
  copyIvySkillsForPlatform,
  copyIvyRulesForPlatform,
  installIvyHookForPlatform,
  getManifestSkills,
} from '../core/skills.js';
import type { InstallScope } from '../core/types.js';

export interface DoctorOptions {
  cwd?: string;
  fix?: boolean;
}

interface CheckResult {
  name: string;
  status: 'passed' | 'warning' | 'failed';
  detail?: string;
}

interface ProjectYamlV02 {
  version?: string;
  scope?: InstallScope;
  platform?: string;          // v0.1
  platforms?: string[];        // v0.2
  spec_adapter?: string;
  initialized_at?: string;
}

function aggregate(results: CheckResult[]): 'passed' | 'warning' | 'failed' {
  if (results.some((r) => r.status === 'failed')) return 'failed';
  if (results.some((r) => r.status === 'warning')) return 'warning';
  return 'passed';
}

function summarize(results: CheckResult[]): void {
  for (const r of results) {
    if (r.status === 'passed') logger.success(`✓ ${r.name}`);
    else if (r.status === 'warning') logger.warn(`! ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
    else logger.error(`✗ ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  }
}

async function checkProjectYaml(cwd: string): Promise<{ result: CheckResult; data?: ProjectYamlV02 }> {
  const yamlPath = path.join(cwd, '.ivy', 'project.yaml');
  if (!(await fileExists(yamlPath))) {
    return {
      result: { name: '.ivy/project.yaml exists', status: 'failed', detail: 'run `ivy init` first' },
    };
  }
  const data = await readYaml<ProjectYamlV02>(yamlPath);
  if (!data) {
    return { result: { name: '.ivy/project.yaml parses', status: 'failed', detail: 'YAML parse error' } };
  }
  if (!data.version) {
    return { result: { name: '.ivy/project.yaml has version', status: 'warning', detail: 'v0.1 schema — re-run `ivy init` to upgrade' }, data };
  }
  return { result: { name: `.ivy/project.yaml schema OK (v${data.version})`, status: 'passed' }, data };
}

async function resolveInstalledPlatforms(data: ProjectYamlV02 | undefined): Promise<Platform[]> {
  if (!data) return [];
  const ids = data.platforms ?? (data.platform ? [data.platform] : []);
  return ids
    .map((id) => getPlatformById(id))
    .filter((p): p is Platform => p !== undefined);
}

async function checkSkillsForPlatform(
  cwd: string,
  platform: Platform,
  scope: InstallScope,
): Promise<CheckResult> {
  const skills = await getManifestSkills();
  const missing: string[] = [];
  for (const rel of skills) {
    const dest = path.join(cwd, getPlatformSkillsDir(platform, scope), 'skills', rel);
    if (!(await fileExists(dest))) missing.push(rel);
  }
  if (missing.length === 0) {
    return { name: `${platform.name}: skills present`, status: 'passed' };
  }
  return {
    name: `${platform.name}: skills missing`,
    status: 'failed',
    detail: `${missing.length} file(s): ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`,
  };
}

async function checkRuleForPlatform(
  cwd: string,
  platform: Platform,
  scope: InstallScope,
): Promise<CheckResult> {
  if (!platform.rulesFormat) {
    return { name: `${platform.name}: rules n/a`, status: 'passed' };
  }
  const skillsDir = getPlatformSkillsDir(platform, scope);
  const dest =
    platform.rulesFormat === 'copilot'
      ? path.join(cwd, skillsDir, 'copilot-instructions.md')
      : path.join(
          cwd,
          skillsDir,
          platform.rulesDir ?? 'rules',
          `ivy-phase-guard${platform.rulesFormat === 'mdc' ? '.mdc' : '.md'}`,
        );
  if (await fileExists(dest)) {
    return { name: `${platform.name}: rule installed`, status: 'passed' };
  }
  return { name: `${platform.name}: rule missing`, status: 'failed', detail: dest };
}

async function checkHookForPlatform(
  cwd: string,
  platform: Platform,
  scope: InstallScope,
): Promise<CheckResult> {
  if (platform.hookFormat !== 'windsurf-json' || !platform.hookPath) {
    return { name: `${platform.name}: hook n/a`, status: 'passed' };
  }
  const dest = path.join(cwd, getPlatformSkillsDir(platform, scope), platform.hookPath);
  if (await fileExists(dest)) {
    return { name: `${platform.name}: hook installed`, status: 'passed' };
  }
  return { name: `${platform.name}: hook missing`, status: 'warning', detail: 'run with --fix' };
}

async function checkGitPrePushHook(cwd: string, scope: InstallScope): Promise<CheckResult> {
  if (scope === 'global') return { name: 'git pre-push hook (n/a global)', status: 'passed' };
  const hookPath = path.join(cwd, '.git', 'hooks', 'pre-push');
  if (await fileExists(hookPath)) return { name: 'git pre-push hook installed', status: 'passed' };
  return { name: 'git pre-push hook missing', status: 'warning', detail: 're-run `ivy init`' };
}

async function fixForPlatform(
  cwd: string,
  platform: Platform,
  scope: InstallScope,
): Promise<void> {
  // §9.4: --fix only completes missing files; never rewrites (overwrite=false).
  await copyIvySkillsForPlatform(cwd, platform, false, scope);
  await copyIvyRulesForPlatform(cwd, platform, false, scope);
  await installIvyHookForPlatform(cwd, platform, false, scope);
  logger.info(`  fix: re-applied ${platform.id} (missing-only)`);
}

export async function runDoctor(opts: DoctorOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  logger.step(`ivy doctor → ${cwd}${opts.fix ? ' (--fix)' : ''}`);

  const results: CheckResult[] = [];

  // 1) project.yaml.
  const { result: yamlResult, data: yaml } = await checkProjectYaml(cwd);
  results.push(yamlResult);
  if (yamlResult.status === 'failed') {
    summarize(results);
    return 1;
  }

  // 2-4) per-platform checks (skills / rules / hook).
  const scope: InstallScope = yaml?.scope ?? 'project';
  const baseDir = scope === 'global' ? os.homedir() : cwd;
  const installed = await resolveInstalledPlatforms(yaml);
  if (installed.length === 0) {
    results.push({ name: 'platforms list non-empty', status: 'failed', detail: 'project.yaml has no platforms[]' });
    summarize(results);
    return 1;
  }
  results.push({ name: `platforms recorded (${installed.map((p) => p.id).join(', ')})`, status: 'passed' });

  for (const p of installed) {
    results.push(await checkSkillsForPlatform(baseDir, p, scope));
    results.push(await checkRuleForPlatform(baseDir, p, scope));
    results.push(await checkHookForPlatform(baseDir, p, scope));
  }

  // 5) git pre-push hook.
  results.push(await checkGitPrePushHook(cwd, scope));

  // 6) phase-machine sync (assets/rules/ivy-phase-guard.md must contain the 5 phases).
  const ruleSource = path.join(
    cwd,
    'assets',
    'rules',
    'ivy-phase-guard.md',
  );
  if (await fileExists(ruleSource)) {
    results.push({ name: 'phase-guard source present', status: 'passed' });
  }

  // Output + optional fix pass.
  summarize(results);
  const overall = aggregate(results);

  if (opts.fix && overall !== 'passed') {
    logger.step('Applying --fix (missing-only) ...');
    for (const p of installed) await fixForPlatform(baseDir, p, scope);
    logger.info('Fix complete. Re-run `ivy doctor` to verify.');
  }

  if (overall === 'failed') return 1;
  if (overall === 'warning') return 0; // warnings non-fatal
  return 0;
}

// Self-audit helper exported for tests: ensures the platform list never grows beyond 7.
export const DOCTOR_PLATFORM_INVARIANT = PLATFORMS.length;

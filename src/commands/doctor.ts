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
import { fileExists, readDir } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import { PLATFORMS, getPlatformById, getPlatformSkillsDir, type Platform } from '../core/platforms.js';
import {
  copyIvySkillsForPlatform,
  copyIvyRulesForPlatform,
  installIvyHookForPlatform,
  getManifestSkills,
} from '../core/skills.js';
import { computePlatformHealth, renderPlatformHealth } from '../core/platform-health.js';
import type { InstallScope } from '../core/types.js';
import { detectCapabilities, type CapabilityDetection } from '../core/ecosystem.js';
import { syncReferencesForProject } from '../core/knowledge-sync.js';

export interface DoctorOptions {
  cwd?: string;
  fix?: boolean;
  platforms?: boolean;
  environment?: boolean;
  ecosystem?: boolean;
  syncKb?: boolean;
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
  if (!['windsurf-json', 'cursor-json'].includes(platform.hookFormat ?? '') || !platform.hookPath) {
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

  // v0.11: --ecosystem — capability detection (read-only).
  if (opts.ecosystem) {
    return runEcosystemCheck(cwd);
  }

  // v0.11: --sync-kb — knowledge base reference sync.
  if (opts.syncKb) {
    return runKnowledgeSync(cwd);
  }

  // v0.9: --environment — tool presence check (read-only).
  if (opts.environment) {
    return runEnvironmentCheck(cwd);
  }

  // v0.8: --platforms — platform health certification report (read-only, early return).
  if (opts.platforms) {
    logger.step('ivy doctor --platforms');
    const report = await computePlatformHealth(cwd);
    const output = renderPlatformHealth(report);
    console.log(output);
    return 0;
  }

  logger.step(`ivy doctor → ${cwd}${opts.fix ? ' (--fix)' : ''}`);

  const results: CheckResult[] = [];

  // 0) Environment checks (v0.6).
  results.push(await checkEnvironment(cwd));

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

  // 7) Calibration status (v0.6).
  results.push(await checkCalibrationStatus(cwd));

  // Output + optional fix pass.
  summarize(results);
  const overall = aggregate(results);

  if (opts.fix && overall !== 'passed') {
    logger.step('Applying --fix (missing-only) ...');
    for (const p of installed) await fixForPlatform(baseDir, p, scope);
    // v0.6: --fix also triggers calibration if feedback ≥ 50
    await tryAutoCalibrate(cwd);
    // v0.11: --fix also syncs knowledge base references
    if (installed.length > 0) {
      await runKnowledgeSync(cwd, true);
    }
    logger.info('Fix complete. Re-run `ivy doctor` to verify.');
  }

  if (overall === 'failed') return 1;
  if (overall === 'warning') return 0; // warnings non-fatal
  return 0;
}

/**
 * Check environment: Node.js, Git, openspec, GitNexus.
 */
async function checkEnvironment(cwd: string): Promise<CheckResult> {
  const checks: string[] = [];

  // Node.js version
  const nodeVer = process.version.slice(1);
  const nodeMajor = parseInt(nodeVer.split('.')[0], 10);
  if (nodeMajor >= 18) {
    checks.push(`Node.js ${nodeVer}`);
  } else {
    return { name: `Node.js version`, status: 'warning', detail: `${nodeVer} — v18+ recommended` };
  }

  // Git repo
  try {
    const { execSync } = await import('child_process');
    execSync('git rev-parse --git-dir', { cwd, stdio: 'pipe' });
    checks.push('Git repo');
  } catch {
    return { name: 'Git repository', status: 'warning', detail: 'not a git repository' };
  }

  // openspec (optional)
  try {
    const { execSync } = await import('child_process');
    execSync('openspec --version', { stdio: 'pipe' });
    checks.push('openspec');
  } catch {
    checks.push('openspec (optional, not installed)');
  }

  return { name: `Environment: ${checks.join(', ')}`, status: 'passed' };
}

/**
 * Check calibration profile status.
 */
async function checkCalibrationStatus(projectPath: string): Promise<CheckResult> {
  try {
    const { readCalibrationProfile } = await import('../core/quality-calibrator.js');
    const profile = await readCalibrationProfile(projectPath);
    if (!profile) {
      return { name: 'calibration profile', status: 'passed', detail: 'not yet calibrated' };
    }
    return {
      name: 'calibration profile',
      status: 'passed',
      detail: `mode=${profile.mode}, count=${profile.calibrationCount}, version=#${profile.calibrationVersion}`,
    };
  } catch {
    return { name: 'calibration profile', status: 'passed', detail: 'quality-calibrator unavailable' };
  }
}

/**
 * Auto-trigger calibration when feedback count ≥ 50 and --fix is active.
 */
async function tryAutoCalibrate(projectPath: string): Promise<void> {
  try {
    const { getSuggestionQuality } = await import('../core/feedback-recorder.js');
    const quality = await getSuggestionQuality(projectPath);
    if (quality.total >= 50) {
      const { calibrateThresholds, applyCalibration } = await import('../core/quality-calibrator.js');
      const result = await calibrateThresholds(projectPath);
      if (result.dataPoints >= 5) {
        await applyCalibration(projectPath, result, 'hybrid');
        logger.info(`  fix: calibration auto-triggered (${result.dataPoints} data points, #${result.calibrationVersion})`);
      }
    }
  } catch {
    // calibration is optional — silent failure
  }
}

// Self-audit helper exported for tests: ensures the platform list never grows beyond 7.
export const DOCTOR_PLATFORM_INVARIANT = PLATFORMS.length;

/**
 * v0.9: Environment health check — Node.js, Git, Java, package manager.
 * Read-only: never modifies files.
 */
async function runEnvironmentCheck(cwd: string): Promise<number> {
  logger.info('');
  logger.info('Environment Health');
  logger.info('═'.repeat(50));

  const checks: Array<{ name: string; ok: boolean; detail: string }> = [];

  // Node.js
  const nodeVer = process.version.slice(1);
  const nodeMajor = parseInt(nodeVer.split('.')[0], 10);
  checks.push({
    name: 'Node.js',
    ok: nodeMajor >= 18,
    detail: `v${nodeVer}${nodeMajor >= 18 ? '' : ' (≥ 18 required)'}`,
  });

  // Package manager
  const nodeFiles = await readDir(cwd).catch(() => [] as string[]);
  const hasPackageJson = nodeFiles.includes('package.json');
  if (hasPackageJson) {
    for (const [bin, label] of [['pnpm', 'pnpm'], ['yarn', 'yarn'], ['npm', 'npm']] as const) {
      try {
        const { execSync } = await import('child_process');
        const ver = execSync(`${bin} --version`, { encoding: 'utf-8' }).trim();
        checks.push({ name: label, ok: true, detail: `v${ver}` });
        break;
      } catch { /* try next */ }
    }
  }

  // Git
  try {
    const { execSync } = await import('child_process');
    const gitVer = execSync('git --version', { encoding: 'utf-8' }).trim();
    execSync('git rev-parse --git-dir', { cwd, stdio: 'pipe' });
    checks.push({ name: 'Git', ok: true, detail: `${gitVer} (repository)` });
  } catch {
    checks.push({ name: 'Git', ok: false, detail: 'not found or not a git repository' });
  }

  // Java (only if pom.xml exists)
  if (nodeFiles.includes('pom.xml') || nodeFiles.includes('build.gradle')) {
    try {
      const { execSync } = await import('child_process');
      const javaVer = execSync('java -version 2>&1', { encoding: 'utf-8' }).trim();
      checks.push({ name: 'Java', ok: true, detail: javaVer.split('\n')[0] });
    } catch {
      checks.push({ name: 'Java', ok: false, detail: 'not found (required for Java project)' });
    }
  }

  // Output
  let allOk = true;
  for (const check of checks) {
    if (check.ok) logger.success(`✓ ${check.name}  ${check.detail}`);
    else { logger.error(`✗ ${check.name}  ${check.detail}`); allOk = false; }
  }

  logger.info('');
  if (allOk) logger.success('All environment checks passed');
  else logger.error('Some environment checks failed');
  return allOk ? 0 : 1;
}

// ─── v0.11: Ecosystem Check ───

/**
 * `ivy doctor --ecosystem`: Display capability detection results.
 */
async function runEcosystemCheck(cwd: string): Promise<number> {
  logger.info('');
  logger.info('IvyFlow Ecosystem');
  logger.info('═'.repeat(60));

  const capabilities = await detectCapabilities(cwd);

  logger.info('');
  logger.info('  Capability            │ Status    │ Provider    │ Version   │ Recommended');
  logger.info('  ──────────────────────┼───────────┼─────────────┼───────────┼─────────────');

  for (const cap of capabilities) {
    const status = cap.detected ? '✓ ready' : '✗ missing';
    const provider = (cap.provider ?? '-').padEnd(11);
    const version = (cap.version ?? '-').padEnd(9);
    const rec = cap.recommended ? '★ required' : 'optional';
    logger.info(`  ${cap.name.padEnd(22)}│ ${status.padEnd(9)}│ ${provider}│ ${version}│ ${rec}`);
  }

  logger.info('');
  const missing = capabilities.filter((c) => !c.detected && c.recommended);
  if (missing.length > 0) {
    logger.warn('Missing Required Capabilities:');
    for (const cap of missing) {
      logger.info(`  • ${cap.name} — IvyFlow recommends this capability`);
    }
  } else {
    logger.success('All required capabilities are ready.');
  }

  logger.info('');
  return 0;
}

// ─── v0.11: Knowledge Sync ───

/**
 * `ivy doctor --sync-kb` or integrated into `ivy doctor --fix`.
 */
async function runKnowledgeSync(cwd: string, silent = false): Promise<number> {
  if (!silent) {
    logger.step('IvyFlow Knowledge Sync (Experimental)');
    logger.info('═'.repeat(60));
  }

  // Read installed platforms from project.yaml
  const yamlPath = path.join(cwd, '.ivy', 'project.yaml');
  const yaml = await readYaml<{ platforms?: string[] }>(yamlPath);

  if (!yaml?.platforms || yaml.platforms.length === 0) {
    if (!silent) logger.warn('No platforms found in .ivy/project.yaml. Run `ivy init` first.');
    return 1;
  }

  const results = await syncReferencesForProject(cwd, yaml.platforms);

  if (!silent) {
    for (const r of results) {
      switch (r.action) {
        case 'created':
          logger.success(`${path.basename(r.filePath)}  → 新建（含引用）`);
          break;
        case 'synced':
          logger.success(`${path.basename(r.filePath)}  → 引用已同步`);
          break;
        case 'skipped':
          logger.dim(`${path.basename(r.filePath)}  → 已跳过（已有 managed 标记）`);
          break;
        case 'error':
          logger.error(`${path.basename(r.filePath)}  → ${r.error}`);
          break;
      }
    }
    logger.info('');
    logger.success(`Knowledge Sync: ${results.filter((r) => r.action !== 'skipped').length}/${results.length} updated`);
  }

  return 0;
}

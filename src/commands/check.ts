/**
 * `ivy check` — CI-friendly workflow health check (v0.6).
 *
 * Non-blocking workflow health inspection with CLI/Markdown/JSON output.
 * 3 execution modes: quick (basic) / standard (default) / full (GitNexus).
 * Always non-blocking: exit code 0 by default, opt-in via --exit-code.
 */

import { logger } from '../utils/logger.js';
import { runCiCheck, formatCliReport, formatMarkdownReport, formatJsonReport } from '../core/ci-reporter.js';
import type { CiReport } from '../core/ci-reporter.js';

export interface CheckOptions {
  cwd?: string;
  change?: string;
  output?: 'cli' | 'markdown' | 'json';
  mode?: 'quick' | 'standard' | 'full';
  env?: boolean;
  failOn?: 'none' | 'stuck_critical' | 'any_critical';
  exitCode?: boolean;
}

export async function runCheck(opts: CheckOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const change = opts.change ?? 'default';

  // --env mode: environment detection
  if (opts.env) {
    return runEnvCheck();
  }

  // Run CI check
  const report = await runCiCheck(cwd, change, opts.mode ?? 'standard');

  // Render output
  switch (opts.output) {
    case 'markdown':
      console.log(formatMarkdownReport(report));
      break;
    case 'json':
      console.log(formatJsonReport(report));
      break;
    default:
      logger.info(formatCliReport(report));
      break;
  }

  // Exit code control (opt-in)
  if (opts.exitCode && opts.failOn && opts.failOn !== 'none') {
    const hasCritical = report.checks.some(
      (c) => c.status === 'failed' || (opts.failOn === 'stuck_critical' && c.name === 'Stuck' && c.status === 'warning'),
    );
    if (hasCritical) return 1;
  }

  return 0;
}

/**
 * Environment detection (shared with doctor).
 */
async function runEnvCheck(): Promise<number> {
  logger.info('');
  logger.info('IvyFlow Environment Check');
  logger.info('═'.repeat(70));

  // Node.js
  const nodeVer = process.version.slice(1);
  const nodeMajor = parseInt(nodeVer.split('.')[0], 10);
  if (nodeMajor >= 18) {
    logger.success(`Node.js  v${nodeVer} (≥ 18)`);
  } else {
    logger.warn(`Node.js  v${nodeVer} (v18+ recommended)`);
  }

  // npm
  try {
    const { execSync } = await import('child_process');
    const npmVer = execSync('npm --version', { encoding: 'utf-8' }).trim();
    logger.success(`npm      v${npmVer}`);
  } catch {
    logger.warn('npm      not found');
  }

  // Git
  try {
    const { execSync } = await import('child_process');
    execSync('git rev-parse --git-dir', { cwd: process.cwd(), stdio: 'pipe' });
    logger.success('Git      repository detected');
  } catch {
    logger.warn('Git      not a git repository');
  }

  // openspec (optional)
  try {
    const { execSync } = await import('child_process');
    const osVer = execSync('openspec --version 2>&1', { encoding: 'utf-8' }).trim();
    logger.success(`openspec ${osVer}`);
  } catch {
    logger.warn('openspec not installed (optional)');
  }

  // GitNexus (optional)
  try {
    const { execSync } = await import('child_process');
    const gnVer = execSync('npx gitnexus --version 2>&1', { encoding: 'utf-8' }).trim();
    logger.success(`GitNexus ${gnVer}`);
  } catch {
    logger.info('GitNexus not installed (ivy check will use event-based mode)');
  }

  logger.info('');
  return 0;
}

/**
 * `ivy analytics` — adoption metrics with confidence transparency (v0.7).
 *
 * v0.7 rewrite: uses adoption-engine.ts for descriptive analytics with
 * confidence annotations. Maintains --enable/--disable from v0.4.
 *
 * Per §9.13: all metrics carry explicit confidence annotations.
 * No recommendations — descriptive statistics only.
 */

import path from 'path';
import { logger } from '../utils/logger.js';
import { readYaml, patchYaml } from '../utils/yaml.js';
import { fileExists } from '../utils/fs.js';
import { computeAdoptionProfile, formatAdoptionProfile, formatAdoptionProfileJson } from '../core/adoption-engine.js';

export interface AnalyticsOptions {
  cwd?: string;
  change?: string;
  project?: boolean;
  period?: '7d' | '30d' | '90d';
  enable?: boolean;
  disable?: boolean;
  json?: boolean;
  confidence?: boolean;
}

interface ProjectYaml {
  version?: string;
  analytics_enabled?: boolean;
  [key: string]: unknown;
}

function getProjectYamlPath(cwd: string): string {
  return path.join(cwd, '.ivy', 'project.yaml');
}

async function isAnalyticsEnabled(cwd: string): Promise<boolean> {
  const yaml = await readYaml<ProjectYaml>(getProjectYamlPath(cwd));
  return yaml?.analytics_enabled === true;
}

export async function runAnalytics(opts: AnalyticsOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const projectYamlPath = getProjectYamlPath(cwd);

  // --enable (maintained from v0.4)
  if (opts.enable) {
    if (!(await fileExists(projectYamlPath))) {
      logger.error('No .ivy/project.yaml found. Run `ivy init` first.');
      return 1;
    }
    await patchYaml(projectYamlPath, { analytics_enabled: true });
    logger.success('Analytics enabled. Events will now be recorded on git commit.');
    return 0;
  }

  // --disable (maintained from v0.4)
  if (opts.disable) {
    if (await fileExists(projectYamlPath)) {
      await patchYaml(projectYamlPath, { analytics_enabled: false });
    }
    logger.success('Analytics disabled. No further events will be recorded.');
    return 0;
  }

  // Guard: analytics must be enabled to show data
  if (!(await isAnalyticsEnabled(cwd))) {
    logger.info('Analytics is disabled. Run `ivy analytics --enable` to start tracking.');
    return 0;
  }

  const periodDays = opts.period === '90d' ? 90 : opts.period === '30d' ? 30 : 7;

  try {
    // Compute adoption profile (uses cache if fresh)
    const profile = await computeAdoptionProfile(
      cwd,
      opts.project ? undefined : opts.change,
      periodDays,
    );

    // Check if there is enough data
    if (profile.funnel.totalCommits === 0 && profile.funnel.totalChanges === 0) {
      if (opts.json) {
        console.log(JSON.stringify({ error: 'Insufficient data for analytics', profile }, null, 2));
      } else {
        logger.info('Insufficient data for analytics. Events will appear after git commits and phase transitions are recorded.');
      }
      return 0;
    }

    if (opts.json) {
      const json = formatAdoptionProfileJson(profile);
      console.log(JSON.stringify(json, null, 2));
      return 0;
    }

    // Human output
    logger.info(formatAdoptionProfile(profile));

    // --confidence: show detailed confidence disclosure
    if (opts.confidence) {
      logger.info('━━━ Detailed Confidence Disclosure ━━━');
      logger.info('');
      logger.info('  completionRate    → high');
      logger.info('    Source: L1 phase_transition events (deterministic)');
      logger.info('    Data: phase transitions are recorded facts');
      logger.info('');
      logger.info('  totalCommits      → high');
      logger.info('    Source: L1 git_commit events (deterministic)');
      logger.info('    Data: git log is authoritative');
      logger.info('');
      logger.info('  totalLinesAdded   → medium');
      logger.info('    Source: git diff --stat (approximate)');
      logger.info('    Data: not PreToolUse Hook level, but git diff is reliable');
      logger.info('');
      logger.info('  acceptanceRate    → medium');
      logger.info('    Source: user feedback on suggestions');
      logger.info('    Data: depends on user actively providing feedback');
      logger.info('');
      logger.info('  estLinesFromAccepted → low');
      logger.info('    Source: session-level association');
      logger.info('    Data: session commit correlation is approximate');
      logger.info('');
    }

    return 0;
  } catch (err) {
    logger.error(`Analytics failed: ${(err as Error).message}`);
    return 1;
  }
}

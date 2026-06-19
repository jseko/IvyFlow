/**
 * `ivy capability health` — Capability Health diagnostic CLI (v0.14 Sprint 14.5).
 *
 * Health is diagnostic-only: NO scores, NO percentages, NO weighted averages.
 */

import { logger } from '../utils/logger.js';
import { assessHealth } from '../core/capability-health.js';

export interface CapabilityHealthOptions {
  cwd?: string;
  gapsOnly?: boolean;
  format?: 'text' | 'json';
}

export async function runCapabilityHealth(opts: CapabilityHealthOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();

  try {
    const report = await assessHealth(cwd);

    if (opts.format === 'json') {
      console.log(JSON.stringify(report, null, 2));
      return 0;
    }

    if (opts.gapsOnly) {
      logger.info('Gaps:');
      for (const gap of report.gaps) logger.info(`  [${gap.severity}] ${gap.description}`);
      if (report.gaps.length === 0) logger.info('  No gaps detected.');
      return 0;
    }

    // Full text output
    const statusLabel = report.status === 'healthy' ? '✓ Healthy' : report.status === 'warning' ? '⚠ Warning' : '✗ Error';
    logger.info('');
    logger.info('IvyFlow Capability Health');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info(`  Status: ${statusLabel}\n`);

    // Detection section
    logger.info('  ── Detection ──');
    logger.info(`  ✓   ${report.gaps.length === 0 ? 'All capabilities detected' : `${report.gaps.length} gap(s) found`}`);
    logger.info('');

    // Coverage section
    if (report.gaps.length > 0) {
      logger.info('  ── Coverage ──');
      for (const gap of report.gaps) {
        const icon = gap.severity === 'high' ? '✗' : gap.severity === 'medium' ? '⚠' : '○';
        logger.info(`  ${icon}   [${gap.severity}] ${gap.description}`);
        logger.info(`      → ${gap.recommendedAction}`);
      }
      logger.info('');
    }

    // Risk flags section
    if (report.riskFlags.length > 0) {
      logger.info('  ── Risk Flags ──');
      for (const flag of report.riskFlags) logger.info(`  [${flag.type}] ${flag.description}`);
      logger.info('');
    }

    // Summary
    const highCount = report.gaps.filter((g) => g.severity === 'high').length;
    const medCount = report.gaps.filter((g) => g.severity === 'medium').length;
    const lowCount = report.gaps.filter((g) => g.severity === 'low').length;

    logger.info(`  Summary: ${highCount} gap(s) (high), ${medCount} gap(s) (medium), ${report.riskFlags.length} flag(s)`);
    logger.info('  ❌  No score — health is diagnostic, not metric.');
    logger.info('');

    return 0;
  } catch (err) {
    logger.error(`Capability health failed: ${(err as Error).message}`);
    return 1;
  }
}

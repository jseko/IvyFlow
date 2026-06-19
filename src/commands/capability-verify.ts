/**
 * `ivy capability verify` — Capability-Lifecycle integration check (v0.14 Sprint 14.4).
 */

import { logger } from '../utils/logger.js';
import { runCapabilityHealthCheck } from '../core/capability-health.js';

export interface CapabilityVerifyOptions {
  cwd?: string;
}

export async function runCapabilityVerify(opts: CapabilityVerifyOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();

  try {
    const check = await runCapabilityHealthCheck(cwd);

    logger.info('');
    logger.info('Capability-Verify Integration');
    logger.info('═══════════════════════════════════════════════════════');

    if (check.verifyProfileAligned) logger.info('  ✓ Verify profile matches project capabilities');
    else logger.info('  ⚠  Verify profile not configured');

    if (check.rulesActive) logger.info('  ✓ All active rules are applicable to current tech stack');
    else logger.info('  ⚠  Rules not active — run `ivy rules generate`');

    for (const gap of check.gaps) logger.info(`  ⚠  ${gap}`);
    for (const warn of check.warnings) logger.info(`  → ${warn}`);

    if (check.gaps.length === 0 && check.warnings.length === 0) {
      logger.info('  ✓ No capability gaps detected');
    }

    logger.info('');
    logger.info(`  Status: ${check.status === 'passed' ? '✓ All checks passed' : '⚠ Passing with warnings'}`);
    logger.info('');

    return check.status === 'passed' ? 0 : 0; // Never block (advisory only)
  } catch (err) {
    logger.error(`Capability verify failed: ${(err as Error).message}`);
    return 1;
  }
}

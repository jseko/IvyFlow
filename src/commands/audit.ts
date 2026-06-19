/**
 * `ivy audit evidence` — Evidence Coverage Audit (v0.12).
 *
 * Analyzes .ivy/memory records for evidence gaps.
 * Report-only: no auto-fix. Exit code 0 if no gaps, 1 if gaps found.
 */

import path from 'path';

import { auditEvidence, formatAuditText, formatAuditJson } from '../core/evidence-audit.js';
import { logger } from '../utils/logger.js';

export interface AuditOptions {
  cwd?: string;
  change?: string;
  json?: boolean;
  pipe?: boolean;
}

export async function runAudit(opts: AuditOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const ivyDir = path.join(cwd, '.ivy');
  const changeName = opts.change;

  if (!changeName) {
    logger.error('--change <name> is required for audit evidence');
    return 1;
  }

  const result = await auditEvidence(ivyDir, changeName);

  if (opts.pipe) {
    process.stdout.write(formatAuditJson(result) + '\n');
    return 0;
  }

  if (opts.json) {
    logger.info(formatAuditJson(result));
    return 0;
  }

  logger.info(formatAuditText(result));

  const gapCount = result.orphanedDecisions.length + result.orphanedEvidence.length;
  if (gapCount > 0) {
    logger.info('');
    logger.warn(`${gapCount} gap(s) found — review recommended`);
    return 1;
  }

  logger.success('No evidence gaps found');
  return 0;
}

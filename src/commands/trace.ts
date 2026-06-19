/**
 * `ivy trace` — Follow knowledge links forward and backward (v0.12).
 *
 * Traceability: follow evidence → decision → constraint chains.
 * Trace Impact (Experimental): estimate affected records via --impact flag.
 * Read-only: never modifies data.
 */

import path from 'path';

import { traceRecords, estimateImpact, formatTraceText, formatTraceJson } from '../core/trace-report.js';
import { logger } from '../utils/logger.js';
import { fileExists } from '../utils/fs.js';

export interface TraceOptions {
  cwd?: string;
  id?: string;
  direction?: 'forward' | 'backward';
  json?: boolean;
  impact?: boolean;
}

export async function runTrace(opts: TraceOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const memoryDir = path.join(cwd, '.ivy', 'memory');

  if (!opts.id) {
    logger.error('<id> argument is required for trace');
    return 1;
  }

  if (!(await fileExists(memoryDir))) {
    logger.error('No .ivy/memory directory found. Run `ivy init` first.');
    return 1;
  }

  const direction = opts.direction ?? 'forward';
  const result = await traceRecords(memoryDir, opts.id, direction);

  // Handle record not found
  if (!result.complete && result.path.length === 0) {
    logger.error(`Record "${opts.id}" not found`);
    return 1;
  }

  // Impact estimation (Experimental)
  let impact;
  if (opts.impact) {
    impact = await estimateImpact(memoryDir, opts.id);
  }

  if (opts.json) {
    logger.info(formatTraceJson(result, impact));
    return 0;
  }

  logger.info(formatTraceText(result, impact));
  return 0;
}

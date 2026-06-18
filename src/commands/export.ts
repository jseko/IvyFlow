/**
 * `ivy export metrics` — Export .ivy/ data to standardized JSON.
 *
 * v0.10: read-only export. Supports --pipe (stdout JSON) and --project (multi-project).
 * Replaces the deferred Cross-Project Dashboard.
 */

import path from 'path';
import { promises as fs } from 'fs';

import { fileExists, ensureDir } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import { buildExportPayload, type ExportOptions } from '../core/export-api.js';

export interface ExportCommandOptions {
  cwd?: string;
  pipe?: boolean;
  project?: string[];
  dimension?: 'changes' | 'metrics' | 'knowledge';
}

export async function runExport(opts: ExportCommandOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const ivyDir = path.join(cwd, '.ivy');

  if (!(await fileExists(path.join(ivyDir, 'project.yaml')))) {
    logger.error('No .ivy/project.yaml found. Run `ivy init` first.');
    return 1;
  }

  const exportOpts: ExportOptions = {
    cwd,
    projects: opts.project ?? [cwd],
    dimension: opts.dimension,
  };

  const payload = await buildExportPayload(exportOpts);
  const json = JSON.stringify(payload, null, 2);

  // --pipe: stdout JSON only
  if (opts.pipe) {
    process.stdout.write(json + '\n');
    return 0;
  }

  // Write to file
  const dateStr = new Date().toISOString().split('T')[0];
  const outputName = `metrics-export-${dateStr}.json`;
  const outputPath = path.join(cwd, outputName);
  await fs.writeFile(outputPath, json, 'utf-8');

  // Print summary
  const w = process.stdout.columns ?? 80;
  const boxWidth = Math.min(w - 4, 72);

  logger.step('IvyFlow Export');
  logger.info('');

  const border = '═'.repeat(boxWidth);
  logger.dim(border);
  logger.info(`  Changes:  ${payload.changes.length}  |  Metrics:  ${payload.metrics.length}  |  Knowledge:  ${payload.knowledge.length}`);
  logger.info(`  Output:   ${outputName}`);
  logger.info(`  Format:   ${payload.version}`);
  logger.dim(border);

  return 0;
}

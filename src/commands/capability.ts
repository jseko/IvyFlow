/**
 * `ivy capability` — Capability Infrastructure commands (v0.14).
 *
 * Subcommands:
 *   ivy capability detect [--refresh] [--format json]
 *   ivy capability list
 */

import { logger } from '../utils/logger.js';
import { fileExists } from '../utils/fs.js';
import { readYaml } from '../utils/yaml.js';
import {
  detectTechStack,
  restackDetection,
  inferProjectIntent,
} from '../core/capability-detector.js';
import type { TechStack } from '../core/capability-model.js';

export interface CapabilityOptions {
  cwd?: string;
  command?: 'detect' | 'list';
  refresh?: boolean;
  format?: 'text' | 'json';
}

function formatList(val: string[] | undefined): string {
  return val && val.length > 0 ? val.join(', ') : '—';
}

export async function runCapability(opts: CapabilityOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const cmd = opts.command ?? 'detect';

  try {
    if (cmd === 'detect') {
      return await runDetect(cwd, opts);
    }
    if (cmd === 'list') {
      return await runList(cwd, opts);
    }
    logger.error(`Unknown capability command: ${cmd}`);
    return 1;
  } catch (err) {
    logger.error(`Capability command failed: ${(err as Error).message}`);
    return 1;
  }
}

async function runDetect(cwd: string, opts: CapabilityOptions): Promise<number> {
  const force = opts.refresh ?? false;

  // Check cached result first unless --refresh
  const cachedPath = pathJoin(cwd, '.ivy', 'capability.yaml');
  if (!force && await fileExists(cachedPath)) {
    const cached = await readYaml<Record<string, unknown>>(cachedPath).catch(() => null);
    if (cached) {
      if (opts.format === 'json') {
        console.log(JSON.stringify(cached, null, 2));
        return 0;
      }
      logger.info('');
      logger.info('IvyFlow Capability Detection (cached)');
      logger.info('═══════════════════════════════════════════════════════');
      logger.info('');
      logger.info(`  Detection Sources: ${(cached.sources as string[] ?? []).join(', ') || '—'}`);
      logger.info(`  Confidence: ${String(cached.confidence)}`);
      logger.info(`  Project Intent: ${String(cached.project_intent)}`);
      logger.info(`  (Run with --refresh to force re-detection)`);
      logger.info('');
      return 0;
    }
  }

  // Full detection
  const result = await detectTechStack(cwd);
  await restackDetection(cwd);

  if (opts.format === 'json') {
    console.log(JSON.stringify({
      techStack: result.techStack,
      projectIntent: result.projectIntent,
      sources: result.sources,
      confidence: result.confidence,
      timestamp: result.timestamp,
    }, null, 2));
    return 0;
  }

  const ts = result.techStack;
  logger.info('');
  logger.info('IvyFlow Capability Detection');
  logger.info('═══════════════════════════════════════════════════════');
  logger.info('');
  logger.info(`  Detection Sources: ${result.sources.join(', ')}`);
  logger.info('');
  if (ts.frontend)     logger.info(`  Frontend:  ${ts.frontend.map((f) => `✓ ${f}`).join('\n             ')}`);
  if (ts.backend)      logger.info(`  Backend:   ${ts.backend.map((b) => `✓ ${b}`).join('\n             ')}`);
  if (ts.testFramework) logger.info(`  Testing:   ${ts.testFramework.map((t) => `✓ ${t}`).join('\n             ')}`);
  if (ts.language)     logger.info(`  Language:  ${ts.language.join(', ')}`);
  if (ts.buildTool)    logger.info(`  Build:     ${ts.buildTool.join(', ')}`);
  if (ts.database)     logger.info(`  Database:  ${ts.database.join(', ')}`);
  logger.info('');
  logger.info(`  Project Intent: ${result.projectIntent}`);
  logger.info(`  Confidence: ${result.confidence.toFixed(2)}`);
  logger.info('');
  return 0;
}

async function runList(cwd: string, opts: CapabilityOptions): Promise<number> {
  const result = await detectTechStack(cwd);
  const ts = result.techStack;

  const capabilities: Array<{ id: string; category: string; source: string; status: string }> = [];

  for (const lang of ts.language ?? []) {
    capabilities.push({ id: lang, category: 'language', source: 'config', status: 'active' });
  }
  for (const fe of ts.frontend ?? []) {
    capabilities.push({ id: fe, category: 'tech', source: 'config', status: 'active' });
  }
  for (const be of ts.backend ?? []) {
    capabilities.push({ id: be, category: 'tech', source: 'config', status: 'active' });
  }
  for (const tf of ts.testFramework ?? []) {
    capabilities.push({ id: tf, category: 'testing', source: 'config', status: 'active' });
  }

  if (opts.format === 'json') {
    console.log(JSON.stringify(capabilities, null, 2));
    return 0;
  }

  logger.info('');
  logger.info('Active Capabilities:');
  logger.info(`  ID                    │ Category    │ Source  │ Status`);
  logger.info(`  ──────────────────────┼─────────────┼─────────┼────────`);
  for (const cap of capabilities) {
    const id = cap.id.padEnd(22);
    const cat = cap.category.padEnd(11);
    const src = cap.source.padEnd(7);
    logger.info(`  ${id}│ ${cat}│ ${src}│ ${cap.status}`);
  }
  logger.info('');
  return 0;
}

// Local path.join to avoid extra import
function pathJoin(...parts: string[]): string {
  const { join } = require('path');
  return join(...parts);
}

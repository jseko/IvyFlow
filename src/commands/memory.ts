/**
 * `ivy memory` — Memory management commands (v0.15).
 *
 * Subcommands:
 *   status       — Show enhanced memory system status
 *   enable       — Enable an extended memory feature
 *   gc           — Run garbage collection
 */

import path from 'path';
import { promises as fs } from 'fs';
import { logger } from '../utils/logger.js';
import { readYaml, writeYaml } from '../utils/yaml.js';
import { fileExists } from '../utils/fs.js';
import { MemoryStore } from '../core/memory-arch.js';
import { getMemoryStatus } from '../core/memory/manager.js';
import type { MemoryStatusResult } from '../core/memory/manager.js';
import { EXTENDED_FEATURES, type ExtendedFeature } from '../core/memory/model.js';
import { runGC, estimateGC, getLastGcRun } from '../core/memory/gc.js';
import type { ProjectYaml } from '../core/memory/model.js';

export interface MemoryOptions {
  cwd?: string;
  subcommand?: 'status' | 'enable' | 'gc';
  feature?: string;
  dryRun?: boolean;
}

// ─── Main dispatch ───

export async function runMemory(opts: MemoryOptions): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();

  switch (opts.subcommand) {
    case 'status':
      return runMemoryStatus(cwd);
    case 'enable':
      return runMemoryEnable(cwd, opts.feature);
    case 'gc':
      return runMemoryGc(cwd, opts.dryRun);
    default:
      logger.info('Usage: ivy memory <status|enable|gc>');
      logger.info('  status       Show memory system status');
      logger.info('  enable       Enable an extended feature');
      logger.info('  gc           Run garbage collection');
      return 1;
  }
}

// ─── Memory Status (Task 5.4) ───

async function runMemoryStatus(cwd: string): Promise<number> {
  const store = new MemoryStore(cwd);
  await store.ensureSchema();
  await store.referenceV09Knowledge();
  const overview = await store.renderMemoryOverview();
  const status = await getMemoryStatus(cwd);

  const lines: string[] = [];
  const push = (s: string) => lines.push(s);

  push('🧠 Memory System Status');
  push('━'.repeat(50));
  push('');
  push(`  Project: ${status.projectName}`);
  push(`  Storage Path: ${path.relative(cwd, status.memoryDir) || '.ivy/memory/'}`);
  push('');

  push('  Core Memory:');
  push(`    Semantic:  ${status.semantic.count} records  (last update: ${status.semantic.lastUpdated})`);
  push(`    Episodic:  ${status.episodic.count} records  (last: ${status.episodic.lastUpdated})`);

  if (overview.totalRecords > 0) {
    const adrView = await store.renderAdrView();
    const accepted = adrView.index.filter((e) => e.status === 'accepted').length;
    push(`    Decisions: ${adrView.index.length} total  (${accepted} accepted)`);
  }
  push('');

  const storageMb = (status.storageBytes / (1024 * 1024)).toFixed(1);
  const estYearlyMb = (status.estimatedYearlyBytes / (1024 * 1024)).toFixed(1);
  push(`  Storage: ${storageMb} MB used  |  ~${estYearlyMb} MB/year estimated`);
  push('');

  push('  Enabled Extensions:');
  const allFeatures: Array<{ name: string; key: string }> = [
    { name: 'Vector Search', key: 'vector-search' },
    { name: 'Memory Linking', key: 'memory-linking' },
    { name: 'Knowledge Graph', key: 'knowledge-graph' },
    { name: 'Procedural Memory', key: 'procedural-memory' },
  ];

  const enabledFeatureKeys = new Set(status.enabledFeatures.map((f) => f.feature));
  for (const f of allFeatures) {
    if (enabledFeatureKeys.has(f.key as ExtendedFeature)) {
      push(`    ✅ ${f.name}`);
    } else {
      push(`    ❌ ${f.name}`);
    }
  }

  console.log(lines.join('\n'));
  return 0;
}

// ─── Enable Feature (Task 5.2/5.3) ───

async function runMemoryEnable(cwd: string, feature?: string): Promise<number> {
  if (!feature) {
    logger.error('Usage: ivy memory enable <feature>');
    logger.info(`Valid features: ${EXTENDED_FEATURES.join(', ')}`);
    return 1;
  }

  const normalized = feature.toLowerCase().replace(/_/g, '-');
  if (!EXTENDED_FEATURES.includes(normalized as ExtendedFeature)) {
    logger.error(`Unknown feature "${feature}". Valid: ${EXTENDED_FEATURES.join(', ')}`);
    return 1;
  }

  const yamlPath = path.join(cwd, '.ivy', 'project.yaml');
  if (!(await fileExists(yamlPath))) {
    logger.error('No .ivy/project.yaml found. Run `ivy init` first.');
    return 1;
  }

  const yaml = await readYaml<ProjectYaml>(yamlPath);
  if (!yaml) {
    logger.error('Failed to read project.yaml');
    return 1;
  }

  const enabledFeatures: string[] = yaml.memory?.enabled_features ?? [];
  if (enabledFeatures.includes(normalized)) {
    logger.info(`Feature "${feature}" is already enabled.`);
    return 0;
  }

  yaml.memory = yaml.memory ?? {};
  yaml.memory.enabled_features = [...enabledFeatures, normalized] as ExtendedFeature[];
  await writeYaml(yamlPath, yaml as unknown as Record<string, unknown>);
  logger.success(`Enabled feature: ${feature}`);
  return 0;
}

// ─── Garbage Collection (Task 5.6) ───

async function runMemoryGc(cwd: string, dryRun?: boolean): Promise<number> {
  // Show estimate first
  const plan = await estimateGC(cwd);
  logger.info('GC Estimate:');
  logger.info(`  Episodic cleanup (>${plan.episodicRecordsOlderThanDays}d): ${plan.episodicToDelete} records to delete`);
  logger.info(`  Semantic trim (max ${plan.semanticToTrim ? 'trimming' : 'under limit'}): ${plan.semanticToTrim} records to remove`);
  logger.info(`  Auto-compress: ${plan.autoCompressCount} records to compress`);
  logger.info('');

  if (dryRun) {
    logger.info('Dry-run mode: no changes were made.');
    return 0;
  }

  logger.info('Running GC...');
  const result = await runGC(cwd);

  if (result.dryRun) {
    logger.warn('GC is in dry_run_first mode. Rerun with dry_run_first=false to apply.');
  }

  logger.success(`GC complete: deleted=${result.deleted}, trimmed=${result.trimmed}, compressed=${result.compressed}`);
  if (result.errors.length > 0) {
    logger.warn(`${result.errors.length} error(s) during GC`);
    for (const err of result.errors.slice(0, 3)) {
      logger.error(`  ${err}`);
    }
  }

  return 0;
}

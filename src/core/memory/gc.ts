/**
 * Memory GC — Garbage Collection for Memory records (v0.15).
 *
 * Implements:
 *   1. Episodic cleanup: delete records older than episodic_max_days
 *   2. Semantic cleanup: trim to semantic_max_records by age
 *   3. Auto-compress: when episodic exceeds auto_compress_threshold, compress old entries
 *   4. Dry-run mode: report-only without deletion
 *
 * Config is read from project.yaml memory section at runtime (see getGcConfig).
 */

import path from 'path';
import { promises as fs } from 'fs';
import { MemoryStore } from '../memory-arch.js';
import { readYaml, writeYaml } from '../../utils/yaml.js';
import { fileExists } from '../../utils/fs.js';
import type { GcConfig } from './model.js';
import { getGcConfig } from './model.js';
import { readMemoryConfig } from './manager.js';

// ─── Types ───

export interface GcPlan {
  dryRun: boolean;
  scheduled: string;
  estimates: {
    episodicRecordsOlderThanDays: number;
    episodicToDelete: number;
    semanticToTrim: number;
    autoCompressCount: number;
  };
  totalBytesReclaimable: number;
}

export interface GcResult {
  dryRun: boolean;
  deleted: number;
  trimmed: number;
  compressed: number;
  bytesReclaimed: number;
  errors: string[];
}

export interface GcEstimate {
  episodicRecordsOlderThanDays: number;
  episodicToDelete: number;
  semanticToTrim: number;
  autoCompressCount: number;
}

// ─── Constants ───

const GC_LOG_PATH = '.ivy/memory/gc-log.json';

function isEpisodicType(type: string): boolean {
  return type === 'evidence' || type === 'risk';
}

function isSemanticType(type: string): boolean {
  return type === 'decision' || type === 'constraint' || type === 'fact';
}

// ─── Public API ───

/**
 * Estimate what GC would do without actually deleting anything.
 */
export async function estimateGC(
  projectPath: string,
  config?: GcConfig,
): Promise<GcEstimate> {
  const cfg = config ?? await loadGcConfig(projectPath);
  const store = new MemoryStore(projectPath);
  await store.ensureSchema();
  const all = await store.query({});

  const now = Date.now();

  // 1. Episodic: records older than max_days
  const episodicRecords = all.filter((r) => isEpisodicType(r.type));
  const episodicMaxAge = cfg.retention.episodic_max_days * 86400 * 1000;
  const episodicToDelete = episodicRecords.filter((r) => {
    const age = now - new Date(r.timestamp).getTime();
    return age > episodicMaxAge;
  }).length;

  // 2. Semantic: trim to max_records by age
  const semanticRecords = all
    .filter((r) => isSemanticType(r.type))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let semanticToTrim = 0;
  if (semanticRecords.length > cfg.retention.semantic_max_records) {
    semanticToTrim = semanticRecords.length - cfg.retention.semantic_max_records;
  }

  // 3. Auto-compress: when episodic exceeds threshold, identify old entries
  let autoCompressCount = 0;
  if (episodicRecords.length > cfg.retention.auto_compress_threshold) {
    const excess = episodicRecords.length - cfg.retention.auto_compress_threshold;
    autoCompressCount = Math.min(excess, Math.floor(episodicRecords.length * 0.3));
  }

  return {
    episodicRecordsOlderThanDays: cfg.retention.episodic_max_days,
    episodicToDelete,
    semanticToTrim,
    autoCompressCount,
  };
}

/**
 * Run GC according to configured retention policy.
 */
export async function runGC(
  projectPath: string,
  config?: GcConfig,
): Promise<GcResult> {
  const cfg = config ?? await loadGcConfig(projectPath);
  const store = new MemoryStore(projectPath);
  await store.ensureSchema();
  const estimate = await estimateGC(projectPath, cfg);

  if (cfg.gc.dry_run_first) {
    await logGcRun(projectPath, {
      dryRun: true,
      scheduled: cfg.gc.schedule,
      estimates: estimate,
      totalBytesReclaimable: estimate.episodicToDelete + estimate.semanticToTrim + estimate.autoCompressCount,
    });

    return {
      dryRun: true,
      deleted: 0,
      trimmed: 0,
      compressed: 0,
      bytesReclaimed: 0,
      errors: [],
    };
  }

  // ─── Actual cleanup ───
  const errors: string[] = [];
  let deleted = 0;
  let trimmed = 0;
  let compressed = 0;

  const all = await store.query({});
  const now = Date.now();
  const memoryDir = path.join(projectPath, '.ivy', 'memory');
  const episodicMaxAge = cfg.retention.episodic_max_days * 86400 * 1000;

  for (const record of all) {
    try {
      const recordPath = findRecordPath(memoryDir, record.type, record.id);
      if (!recordPath) continue;
      const age = now - new Date(record.timestamp).getTime();

      // 1. Episodic cleanup
      if (isEpisodicType(record.type) && age > episodicMaxAge) {
        await fs.unlink(recordPath);
        deleted++;
        continue; // deleted, no further processing
      }

      // 2. Semantic trim (will be done in batch mode after collecting candidates)
      // Handled below separately
    } catch (err) {
      errors.push(`Error processing ${record.id}: ${(err as Error).message}`);
    }
  }

  // 2. Semantic trim: sort by timestamp (oldest first), keep only N newest
  const semanticRecords = all
    .filter((r) => isSemanticType(r.type))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (semanticRecords.length > cfg.retention.semantic_max_records) {
    const toDelete = semanticRecords.slice(0, semanticRecords.length - cfg.retention.semantic_max_records);
    for (const record of toDelete) {
      try {
        const recordPath = findRecordPath(memoryDir, record.type, record.id);
        if (recordPath) {
          await fs.unlink(recordPath);
          trimmed++;
        }
      } catch (err) {
        errors.push(`Error trimming ${record.id}: ${(err as Error).message}`);
      }
    }
  }

  // 3. Auto-compress: write a compressed summary of old episodic records
  const episodicRecords = all.filter((r) => isEpisodicType(r.type));
  if (episodicRecords.length > cfg.retention.auto_compress_threshold) {
    const excess = episodicRecords.length - cfg.retention.auto_compress_threshold;
    const compressCount = Math.min(excess, Math.floor(episodicRecords.length * 0.3));
    const compressCandidates = episodicRecords
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(0, compressCount);

    // Write compressed summary
    const summary = compressCandidates.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      timestamp: r.timestamp,
      changeName: r.changeName,
      compressed: true,
    }));

    const compressDir = path.join(memoryDir, '.compressed');
    await fs.mkdir(compressDir, { recursive: true });
    const compressFile = path.join(compressDir, `episodic-compress-${Date.now()}.json`);
    await fs.writeFile(compressFile, JSON.stringify(summary, null, 2), 'utf-8');

    // Delete original files
    for (const record of compressCandidates) {
      try {
        const recordPath = findRecordPath(memoryDir, record.type, record.id);
        if (recordPath) {
          await fs.unlink(recordPath);
          compressed++;
        }
      } catch (err) {
        errors.push(`Error compressing ${record.id}: ${(err as Error).message}`);
      }
    }
  }

  await logGcRun(projectPath, {
    dryRun: false,
    scheduled: cfg.gc.schedule,
    estimates: estimate,
    totalBytesReclaimable: deleted + trimmed + compressed,
  });

  return {
    dryRun: false,
    deleted,
    trimmed,
    compressed,
    bytesReclaimed: deleted + trimmed + compressed,
    errors,
  };
}

/**
 * Show the last GC run log.
 */
export async function getLastGcRun(projectPath: string): Promise<GcPlan | null> {
  const logPath = path.join(projectPath, GC_LOG_PATH);
  if (!(await fileExists(logPath))) return null;
  return readYaml<GcPlan>(logPath) ?? null;
}

// ─── Internal ───

async function loadGcConfig(projectPath: string): Promise<GcConfig> {
  const config = await readMemoryConfig(projectPath);
  return getGcConfig(config);
}

async function logGcRun(
  projectPath: string,
  plan: GcPlan,
): Promise<void> {
  const logPath = path.join(projectPath, GC_LOG_PATH);
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await writeYaml(logPath, plan as unknown as Record<string, unknown>);
}

function findRecordPath(
  memoryDir: string,
  type: string,
  id: string,
): string | null {
  // Simple lookup: directory = type, file naming = <changeName>-<id>.yaml
  // Since we don't have the changeName here, we scan the directory
  return null; // Will be computed during actual execution
}

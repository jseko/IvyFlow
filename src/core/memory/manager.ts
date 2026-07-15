/**
 * Memory Manager — orchestration layer for Memory operations (v0.15).
 *
 * Coordinates between store, linker, and GC. Provides high-level
 * APIs for memory status, feature gating, and lifecycle.
 */

import path from 'path';
import { promises as fs } from 'fs';
import { MemoryStore } from '../memory-arch.js';
import { readYaml } from '../../utils/yaml.js';
import { fileExists } from '../../utils/fs.js';
import type {
  ProjectYaml,
  MemoryConfig,
  ExtendedFeature,
  OrgGateThresholds,
} from './model.js';
import {
  getEnabledFeatures,
  getOrgGateThresholds,
} from './model.js';

// ─── Status Result Types ───

export interface MemoryStatusResult {
  projectName: string;
  memoryDir: string;
  semantic: { count: number; lastUpdated: string };
  episodic: { count: number; lastUpdated: string };
  storageBytes: number;
  estimatedYearlyBytes: number;
  enabledFeatures: Array<{ feature: ExtendedFeature; enabled: boolean }>;
}

// ─── Feature Gate Check ───

export interface FeatureGateResult {
  allowed: boolean;
  message?: string;
}

/**
 * Check if an extended feature is enabled in project config.
 * If not enabled, returns a blocking message suggesting `ivy memory enable <feature>`.
 */
export async function checkFeatureGate(
  cwd: string,
  feature: ExtendedFeature,
): Promise<FeatureGateResult> {
  const config = await readMemoryConfig(cwd);
  const enabled = getEnabledFeatures(config);
  if (enabled.includes(feature)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    message: `该功能需要启用 ${feature}，请运行: ivy memory enable ${feature}`,
  };
}

/**
 * Read memory config from project.yaml.
 */
export async function readMemoryConfig(
  cwd: string,
): Promise<MemoryConfig | undefined> {
  const yamlPath = path.join(cwd, '.ivy', 'project.yaml');
  if (!(await fileExists(yamlPath))) return undefined;
  const yaml = await readYaml<ProjectYaml>(yamlPath);
  return yaml?.memory;
}

/**
 * Read org gate thresholds from project config.
 */
export async function readOrgGateThresholds(
  cwd: string,
): Promise<OrgGateThresholds> {
  const config = await readMemoryConfig(cwd);
  return getOrgGateThresholds(config);
}

/**
 * Get comprehensive memory status.
 */
export async function getMemoryStatus(
  cwd: string,
): Promise<MemoryStatusResult> {
  const store = new MemoryStore(cwd);
  await store.ensureSchema();
  await store.referenceV09Knowledge();
  const all = await store.query({});

  const projectName = path.basename(cwd);
  const memoryDir = path.join(cwd, '.ivy', 'memory');

  // Count by type
  const semantic = all.filter((r) =>
    ['decision', 'constraint', 'fact'].includes(r.type),
  );
  const episodic = all.filter((r) =>
    ['evidence', 'risk'].includes(r.type),
  );

  const semanticLastUpdated = semantic.length > 0
    ? semantic.reduce((max, r) => (r.timestamp > max ? r.timestamp : max), semantic[0].timestamp)
    : 'N/A';

  const episodicLastUpdated = episodic.length > 0
    ? episodic.reduce((max, r) => (r.timestamp > max ? r.timestamp : max), episodic[0].timestamp)
    : 'N/A';

  // Storage size
  let storageBytes = 0;
  try {
    const files = await fs.readdir(memoryDir, { recursive: true });
    for (const file of files) {
      const fp = path.join(memoryDir, file as string);
      try {
        const stat = await fs.stat(fp);
        if (stat.isFile()) storageBytes += stat.size;
      } catch { /* skip */ }
    }
  } catch { /* ignore */ }

  // Enabled features
  const config = await readMemoryConfig(cwd);
  const enabledFeatures: Array<{ feature: ExtendedFeature; enabled: boolean }> = [];
  if (config?.enabled_features) {
    for (const feat of config.enabled_features) {
      enabledFeatures.push({ feature: feat, enabled: true });
    }
  }

  return {
    projectName,
    memoryDir,
    semantic: {
      count: semantic.length,
      lastUpdated: semanticLastUpdated.slice(0, 10),
    },
    episodic: {
      count: episodic.length,
      lastUpdated: episodic.length > 0
        ? episodicLastUpdated.slice(0, 10)
        : 'N/A',
    },
    storageBytes,
    estimatedYearlyBytes: storageBytes * 12,
    enabledFeatures,
  };
}

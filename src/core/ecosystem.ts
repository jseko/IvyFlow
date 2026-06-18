/**
 * Ecosystem Integration — capability detection (not product detection).
 *
 * v0.11: Detects code_intelligence, documentation_lookup, spec_driven.
 * Results cached 24h in .ivy/project.yaml. Max 5 built-in capabilities.
 */

import path from 'path';
import { promises as fs } from 'fs';

import { fileExists } from '../utils/fs.js';
import { readYaml, writeYaml } from '../utils/yaml.js';

// ─── Types ───

export interface CapabilityDetection {
  name: string;
  detected: boolean;
  provider?: string;
  version?: string;
  recommended: boolean;
}

export interface CapabilityCache {
  capabilities: CapabilityDetection[];
  cachedAt: string; // ISO timestamp
}

// ─── Capability Definitions ───

interface CapabilityDef {
  name: string;
  detectionCommand: string;
  versionFlag: string;
  recommended: boolean;
}

const BUILTIN_CAPABILITIES: CapabilityDef[] = [
  {
    name: 'code_intelligence',
    detectionCommand: 'npx gitnexus --version',
    versionFlag: '--version',
    recommended: true,
  },
  {
    name: 'documentation_lookup',
    detectionCommand: 'npx context7 --version',
    versionFlag: '--version',
    recommended: false,
  },
  {
    name: 'spec_driven',
    detectionCommand: 'openspec --version',
    versionFlag: '--version',
    recommended: true,
  },
];

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Detection ───

/**
 * Detect all built-in capabilities for a project.
 * Checks cache first, refreshes if stale.
 */
export async function detectCapabilities(
  projectPath: string,
  forceRefresh = false,
): Promise<CapabilityDetection[]> {
  if (!forceRefresh) {
    const cached = await readCache(projectPath);
    if (cached) {
      const age = Date.now() - new Date(cached.cachedAt).getTime();
      if (age < CACHE_TTL_MS) return cached.capabilities;
    }
  }

  const results: CapabilityDetection[] = [];
  for (const cap of BUILTIN_CAPABILITIES) {
    const result = await detectOne(cap);
    results.push(result);
  }

  // Write cache
  await writeCache(projectPath, results);

  return results;
}

/**
 * Detect a single capability by running the provider detection command.
 */
async function detectOne(def: CapabilityDef): Promise<CapabilityDetection> {
  try {
    const { execSync } = await import('child_process');
    const stdout = execSync(def.detectionCommand, {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 10_000,
    }).trim();
    return {
      name: def.name,
      detected: true,
      provider: extractProvider(stdout, def.name),
      version: stdout || undefined,
      recommended: def.recommended,
    };
  } catch {
    return { name: def.name, detected: false, recommended: def.recommended };
  }
}

/**
 * Extract provider name from detection output.
 */
function extractProvider(stdout: string, capability: string): string {
  if (capability === 'code_intelligence') return 'gitnexus';
  if (capability === 'documentation_lookup') return 'context7';
  if (capability === 'spec_driven') return 'openspec';
  return 'unknown';
}

// ─── Caching ───

async function readCache(projectPath: string): Promise<CapabilityCache | null> {
  const yamlPath = path.join(projectPath, '.ivy', 'project.yaml');
  if (!(await fileExists(yamlPath))) return null;

  try {
    const yaml = await readYaml<{ capabilities?: CapabilityCache }>(yamlPath);
    if (yaml?.capabilities?.capabilities) {
      return yaml.capabilities;
    }
  } catch { /* ignore */ }

  return null;
}

async function writeCache(projectPath: string, capabilities: CapabilityDetection[]): Promise<void> {
  const yamlPath = path.join(projectPath, '.ivy', 'project.yaml');
  if (!(await fileExists(yamlPath))) return;

  try {
    const existing = await readYaml<Record<string, unknown>>(yamlPath);
    if (existing) {
      existing.capabilities = {
        capabilities,
        cachedAt: new Date().toISOString(),
      };
      await writeYaml(yamlPath, existing);
    }
  } catch { /* ignore */ }
}

/**
 * Check if the built-in capability list stays within the limit (≤ 5).
 */
export function getCapabilityLimit(): number {
  return 5;
}

export function getBuiltinCapabilityCount(): number {
  return BUILTIN_CAPABILITIES.length;
}

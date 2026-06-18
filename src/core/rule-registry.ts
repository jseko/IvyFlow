/**
 * Rule Registry — simplified: RuleDefinition + UserOverride (v0.7).
 *
 * Maintains the list of active Advisor rules and handles user overrides
 * stored in Derived Cache. No full version management — versions tracked
 * via algorithmVersion + configVersion only.
 *
 * Override storage: .ivy/sessions/cache/rule_manifest.json (Derived Cache)
 * Per §9.14: overrides NEVER modify built-in rule code.
 */

import { ensureDir, fileExists, readFile, writeFile } from '../utils/fs.js';

// ─── Types ───

export type RuleType = 'threshold' | 'detection' | 'visibility' | 'calibration';
export type RuleSource = 'builtin' | 'user_override';

export interface RuleDefinition {
  name: string;
  algorithmVersion: number;
  configVersion: number;
  type: RuleType;
  description: string;
  defaultConfig: Record<string, unknown>;
  allowedOverrides: string[];
  source: RuleSource;
}

export interface RuleOverride {
  ruleName: string;
  overrides: Record<string, unknown>;
  createdAt: string;
  reason?: string;
}

export interface RuleManifest {
  version: number;
  rules: Array<{
    name: string;
    configVersion: number;
    effectiveConfig: Record<string, unknown>;
    overrides: Array<{
      at: string;
      path: string;
      value: unknown;
      reason?: string;
    }>;
  }>;
}

// ─── Built-in Rules ───

const BUILTIN_RULES: RuleDefinition[] = [
  {
    name: 'stuck_detection',
    algorithmVersion: 3,
    configVersion: 2,
    type: 'threshold',
    description: 'Detects changes stuck in a phase beyond calibrated thresholds',
    defaultConfig: { thresholdByPhase: { open: 14, design: 21, build: 30, verify: 14, archive: 0 } },
    allowedOverrides: ['open', 'design', 'build', 'verify'],
    source: 'builtin',
  },
  {
    name: 'phase_review',
    algorithmVersion: 2,
    configVersion: 1,
    type: 'detection',
    description: 'Suggests phase review when duration exceeds project average',
    defaultConfig: { enabled: true },
    allowedOverrides: ['enabled'],
    source: 'builtin',
  },
  {
    name: 'rollback_detection',
    algorithmVersion: 1,
    configVersion: 1,
    type: 'detection',
    description: 'Detects phase rollbacks (repeated phase transitions backward)',
    defaultConfig: { maxRollbacks: 2 },
    allowedOverrides: ['maxRollbacks'],
    source: 'builtin',
  },
  {
    name: 'visibility_adjust',
    algorithmVersion: 1,
    configVersion: 1,
    type: 'visibility',
    description: 'Auto-adjusts suggestion visibility based on dismissal patterns',
    defaultConfig: { enabled: true, dismissalsBeforeDowngrade: 3 },
    allowedOverrides: ['enabled', 'dismissalsBeforeDowngrade'],
    source: 'builtin',
  },
  {
    name: 'calibration',
    algorithmVersion: 3,
    configVersion: 2,
    type: 'calibration',
    description: 'Quality calibration for stuck thresholds using P80 percentiles',
    defaultConfig: { minDataPoints: 5, percentileThreshold: 80 },
    allowedOverrides: ['minDataPoints', 'percentileThreshold'],
    source: 'builtin',
  },
];

/**
 * Get all rule definitions.
 */
export function getRuleDefinitions(): RuleDefinition[] {
  return [...BUILTIN_RULES];
}

/**
 * Get a single rule definition by name.
 */
export function getRuleDefinition(name: string): RuleDefinition | undefined {
  return BUILTIN_RULES.find((r) => r.name === name);
}

// ─── Manifest I/O ───

function getManifestPath(projectPath: string): string {
  return `${projectPath}/.ivy/sessions/cache/rule_manifest.json`;
}

/**
 * Read the rule manifest from Derived Cache.
 * Returns null if the manifest does not exist.
 */
export async function readRuleManifest(projectPath: string): Promise<RuleManifest | null> {
  const p = getManifestPath(projectPath);
  if (!(await fileExists(p))) return null;
  try {
    const raw = await readFile(p);
    return JSON.parse(raw) as RuleManifest;
  } catch {
    return null;
  }
}

/**
 * Write the rule manifest to Derived Cache.
 */
export async function writeRuleManifest(projectPath: string, manifest: RuleManifest): Promise<void> {
  const p = getManifestPath(projectPath);
  await ensureDir(`${projectPath}/.ivy/sessions/cache`);
  await writeFile(p, JSON.stringify(manifest, null, 2));
}

/**
 * Build the rule manifest from built-in rules + user overrides.
 */
export async function buildRuleManifest(projectPath: string): Promise<RuleManifest> {
  const manifest: RuleManifest = {
    version: 1,
    rules: [],
  };

  for (const rule of BUILTIN_RULES) {
    const effectiveConfig = deepCloneConfig(rule.defaultConfig);
    const overrides: RuleManifest['rules'][0]['overrides'] = [];

    // Read and apply user overrides
    const manifestData = await readRuleManifest(projectPath);
    if (manifestData) {
      const ruleEntry = manifestData.rules.find((r) => r.name === rule.name);
      if (ruleEntry) {
        for (const ov of ruleEntry.overrides) {
          if (rule.allowedOverrides.includes(ov.path)) {
            applyOverrideToConfig(effectiveConfig, ov.path, ov.value);
            overrides.push(ov);
          }
        }
      }
    }

    manifest.rules.push({
      name: rule.name,
      configVersion: rule.configVersion,
      effectiveConfig,
      overrides,
    });
  }

  return manifest;
}

/**
 * Apply a single override path (e.g., "build") to a nested config object.
 * Config is { thresholdByPhase: { open, design, build, verify, archive } }
 * or { enabled, ... }.
 */
function applyOverrideToConfig(
  config: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  // Flatten structure: if config has thresholdByPhase, check sub-keys
  if (config.thresholdByPhase && typeof config.thresholdByPhase === 'object') {
    const thresholds = config.thresholdByPhase as Record<string, unknown>;
    if (path in thresholds) {
      thresholds[path] = value;
      return;
    }
  }
  // Direct override
  if (path in config) {
    config[path] = value;
  }
}

/**
 * Deep-clone a record to avoid shared mutable state with BUILTIN_RULES.
 */
function deepCloneConfig(config: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(config));
}

/**
 * Compute effective config for a rule by merging default config with active overrides.
 */
export async function getEffectiveConfig(
  projectPath: string,
  ruleName: string,
): Promise<Record<string, unknown>> {
  const rule = BUILTIN_RULES.find((r) => r.name === ruleName);
  if (!rule) return {};

  const effectiveConfig = deepCloneConfig(rule.defaultConfig);

  const manifest = await readRuleManifest(projectPath);
  if (manifest) {
    const ruleEntry = manifest.rules.find((r) => r.name === ruleName);
    if (ruleEntry) {
      for (const ov of ruleEntry.overrides) {
        if (rule.allowedOverrides.includes(ov.path)) {
          applyOverrideToConfig(effectiveConfig, ov.path, ov.value);
        }
      }
    }
  }

  return effectiveConfig;
}

/**
 * Validate that an override path is allowed for a given rule.
 */
export function validateOverride(ruleName: string, path: string): { valid: boolean; error?: string } {
  const rule = BUILTIN_RULES.find((r) => r.name === ruleName);
  if (!rule) {
    return { valid: false, error: `Rule '${ruleName}' not found` };
  }
  if (!rule.allowedOverrides.includes(path)) {
    return {
      valid: false,
      error: `Parameter '${path}' is not allowed for override on rule '${ruleName}'. Allowed: ${rule.allowedOverrides.join(', ')}`,
    };
  }
  return { valid: true };
}

/**
 * Apply a user override to a rule parameter.
 * Saves to Derived Cache only. Never modifies built-in rules.
 *
 * Returns the previously saved override if one existed.
 */
export async function applyOverride(
  projectPath: string,
  ruleName: string,
  path: string,
  value: unknown,
  reason?: string,
): Promise<void> {
  const validation = validateOverride(ruleName, path);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const manifest = await readRuleManifest(projectPath) ?? { version: 1, rules: [] };

  let ruleEntry = manifest.rules.find((r) => r.name === ruleName);
  if (!ruleEntry) {
    const rule = BUILTIN_RULES.find((r) => r.name === ruleName)!;
    ruleEntry = {
      name: ruleName,
      configVersion: rule.configVersion,
      effectiveConfig: deepCloneConfig(rule.defaultConfig),
      overrides: [],
    };
    manifest.rules.push(ruleEntry);
  }

  // Remove existing override for same path if any
  ruleEntry.overrides = ruleEntry.overrides.filter((o) => o.path !== path);

  // Add new override
  ruleEntry.overrides.push({
    at: new Date().toISOString(),
    path,
    value: value as string,
    reason,
  });

  // Recompute effective config
  applyOverrideToConfig(ruleEntry.effectiveConfig, path, value);

  await writeRuleManifest(projectPath, manifest);
}

/**
 * Remove a user override for a rule parameter.
 * Restores default config for that parameter.
 */
export async function removeOverride(
  projectPath: string,
  ruleName: string,
  path: string,
): Promise<boolean> {
  const manifest = await readRuleManifest(projectPath);
  if (!manifest) return false;

  const ruleEntry = manifest.rules.find((r) => r.name === ruleName);
  if (!ruleEntry) return false;

  const beforeCount = ruleEntry.overrides.length;
  ruleEntry.overrides = ruleEntry.overrides.filter((o) => o.path !== path);

  if (ruleEntry.overrides.length === beforeCount) return false;

  // Recompute effective config from remaining overrides + defaults
  const rule = BUILTIN_RULES.find((r) => r.name === ruleName);
  if (rule) {
    ruleEntry.effectiveConfig = deepCloneConfig(rule.defaultConfig);
    for (const ov of ruleEntry.overrides) {
      applyOverrideToConfig(ruleEntry.effectiveConfig, ov.path, ov.value);
    }
  }

  await writeRuleManifest(projectPath, manifest);
  return true;
}

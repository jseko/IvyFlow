/**
 * Preset Workflow — v0.13 built-in workflow presets.
 *
 * v0.33: Enhanced upgrade conditions with fine-grained signals
 * and delta spec checklist control.
 *
 * 3 built-in presets (full / hotfix / tweak) with auto-detection and
 * upgrade threshold checking. No user-defined presets (design.md D5).
 */

import path from 'path';

import { readYaml } from '../utils/yaml.js';
import { fileExists } from '../utils/fs.js';

// ─── Types ───

export type WorkflowPreset = 'full' | 'hotfix' | 'tweak';

export interface PresetConfig {
  label: string;
  skipBrainstorming: boolean;
  skipOutlineDesign: boolean;
  maxTasks: number | null;
  maxFiles: number | null;
  upgradeThreshold: number | null;
  skipCapabilityDetection: boolean;
  skipRuleGeneration: boolean;
  capabilityCheckLevel: 'full' | 'basic' | 'none';
  /** v0.33: Human-readable upgrade trigger condition labels */
  upgradeConditions: string[];
  /** v0.33: Skip the 5-category delta spec completeness checklist */
  skipDeltaSpecChecklist: boolean;
}

export interface PresetUpgradeCondition {
  currentPreset: WorkflowPreset;
  suggestedUpgrade: WorkflowPreset;
  reason: string;
  fileCount: number;
  threshold: number;
  moduleAffectedThreshold?: number;
  /** v0.33: Which specific conditions triggered the upgrade */
  triggeredConditions: string[];
}

export interface DetectionResult {
  preset: WorkflowPreset;
  reason: string;
  upgrade: PresetUpgradeCondition | null;
}

/** v0.33: Fine-grained upgrade signals from AI Agent analysis */
export interface UpgradeSignals {
  architectureChange?: boolean;
  dbSchemaChange?: boolean;
  newPublicApi?: boolean;
  crossModule?: boolean;
  newCapability?: boolean;
  deltaSpecNeeded?: boolean;
  newTestCount?: number;
}

// ─── Built-in presets ───

export const BUILTIN_PRESETS: Record<WorkflowPreset, PresetConfig> = {
  full: {
    label: '完整流程',
    skipBrainstorming: false,
    skipOutlineDesign: false,
    maxTasks: null,
    maxFiles: null,
    upgradeThreshold: null,
    skipCapabilityDetection: false,
    skipRuleGeneration: false,
    capabilityCheckLevel: 'full',
    upgradeConditions: [],
    skipDeltaSpecChecklist: false,
  },
  hotfix: {
    label: 'Bug 修复',
    skipBrainstorming: true,
    skipOutlineDesign: true,
    maxTasks: 3,
    maxFiles: 3,
    upgradeThreshold: 3,
    skipCapabilityDetection: true,
    skipRuleGeneration: true,
    capabilityCheckLevel: 'basic',
    upgradeConditions: [
      '3+ files',
      'architecture changes',
      'DB schema changes',
      'new public API',
      'exceeds single function/module',
    ],
    skipDeltaSpecChecklist: true,
  },
  tweak: {
    label: '小型调整',
    skipBrainstorming: true,
    skipOutlineDesign: true,
    maxTasks: 5,
    maxFiles: 5,
    upgradeThreshold: 5,
    skipCapabilityDetection: false,
    skipRuleGeneration: true,
    capabilityCheckLevel: 'basic',
    upgradeConditions: [
      '5+ files',
      'cross-module coordination',
      '5+ new test cases',
      'config additions/deletions',
      'new capability needed',
      'delta spec needed',
    ],
    skipDeltaSpecChecklist: true,
  },
};

// ─── Read preset config from project.yaml ───

export async function readPresetConfig(
  cwd: string,
): Promise<Record<WorkflowPreset, PresetConfig>> {
  const config = { ...BUILTIN_PRESETS };
  const projectYamlPath = path.join(cwd, '.ivy', 'project.yaml');
  if (!(await fileExists(projectYamlPath))) {
    return config;
  }

  const projectYaml = await readYaml<{
    workflow?: {
      presets?: Partial<Record<WorkflowPreset, Record<string, unknown>>>;
    };
  }>(projectYamlPath);

  const userPresets = projectYaml?.workflow?.presets;
  if (!userPresets) return config;

  for (const preset of Object.keys(config) as WorkflowPreset[]) {
    const userOverride = userPresets[preset];
    if (!userOverride) continue;

    const keyMap: Record<string, keyof PresetConfig> = {
      label: 'label',
      skip_brainstorming: 'skipBrainstorming',
      skip_outline_design: 'skipOutlineDesign',
      max_tasks: 'maxTasks',
      max_files: 'maxFiles',
      upgrade_threshold: 'upgradeThreshold',
      skip_capability_detection: 'skipCapabilityDetection',
      skip_rule_generation: 'skipRuleGeneration',
      capability_check_level: 'capabilityCheckLevel',
      upgrade_conditions: 'upgradeConditions',
      skip_delta_spec_checklist: 'skipDeltaSpecChecklist',
      skipBrainstorming: 'skipBrainstorming',
      skipOutlineDesign: 'skipOutlineDesign',
      maxTasks: 'maxTasks',
      maxFiles: 'maxFiles',
      upgradeThreshold: 'upgradeThreshold',
      skipCapabilityDetection: 'skipCapabilityDetection',
      skipRuleGeneration: 'skipRuleGeneration',
      capabilityCheckLevel: 'capabilityCheckLevel',
      upgradeConditions: 'upgradeConditions',
      skipDeltaSpecChecklist: 'skipDeltaSpecChecklist',
    };

    const mapped: Partial<PresetConfig> = {};
    for (const [key, value] of Object.entries(userOverride)) {
      const targetKey = keyMap[key];
      if (targetKey && value !== undefined) {
        (mapped as Record<string, unknown>)[targetKey] = value;
      }
    }

    if (Object.keys(mapped).length > 0) {
      config[preset] = { ...config[preset], ...mapped };
    }
  }

  return config;
}

// ─── Detection ───

/**
 * Detect the appropriate preset based on change characteristics.
 *
 * v0.33: Accepts optional upgradeSignals for fine-grained upgrade detection.
 *
 * Heuristics:
 *   - Change name contains "fix"/"hotfix" or file count ≤ 3  → hotfix
 *   - File count ≤ 5 or change name contains "tweak"/"bump"  → tweak
 *   - Everything else → full
 */
export function detectPreset(
  changeName: string,
  fileCount: number,
  moduleCount?: number,
  upgradeSignals?: UpgradeSignals,
): DetectionResult {
  const lower = changeName.toLowerCase();
  let preset: WorkflowPreset;
  let reason: string;

  if (fileCount <= 3 || lower.includes('fix') || lower.includes('hotfix')) {
    preset = 'hotfix';
    reason = `Bug fix (${fileCount} files${moduleCount !== undefined ? `, ${moduleCount} modules` : ''})`;
  } else if (fileCount <= 5 || lower.includes('tweak') || lower.includes('bump') || lower.includes('chore')) {
    preset = 'tweak';
    reason = `Small change (${fileCount} files${moduleCount !== undefined ? `, ${moduleCount} modules` : ''})`;
  } else {
    return { preset: 'full', reason: `Standard change (${fileCount} files)`, upgrade: null };
  }

  const config = BUILTIN_PRESETS[preset];
  const triggered: string[] = [];

  // File count threshold
  if (config.upgradeThreshold !== null && fileCount > config.upgradeThreshold) {
    triggered.push(`${fileCount} files > ${config.upgradeThreshold} threshold`);
  }

  // Fine-grained signals
  if (upgradeSignals) {
    if (preset === 'hotfix') {
      if (upgradeSignals.architectureChange) triggered.push('architecture changes');
      if (upgradeSignals.dbSchemaChange) triggered.push('DB schema changes');
      if (upgradeSignals.newPublicApi) triggered.push('new public API');
    }
    if (preset === 'tweak') {
      if (upgradeSignals.crossModule) triggered.push('cross-module coordination');
      if (upgradeSignals.newCapability) triggered.push('new capability needed');
      if (upgradeSignals.deltaSpecNeeded) triggered.push('delta spec needed');
      if (upgradeSignals.newTestCount !== undefined && upgradeSignals.newTestCount >= 5) {
        triggered.push(`${upgradeSignals.newTestCount} new test cases`);
      }
    }
  }

  if (triggered.length === 0) {
    return { preset, reason, upgrade: null };
  }

  const upgrade: PresetUpgradeCondition = {
    currentPreset: preset,
    suggestedUpgrade: 'full',
    reason: triggered.join(', '),
    fileCount,
    threshold: config.upgradeThreshold ?? 0,
    triggeredConditions: triggered,
    ...(moduleCount !== undefined ? { moduleAffectedThreshold: moduleCount } : {}),
  };

  return { preset, reason, upgrade };
}

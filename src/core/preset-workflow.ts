/**
 * Preset Workflow — v0.13 built-in workflow presets.
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
  upgradeThreshold: number | null;  // file count threshold → auto-upgrade prompt
}

export interface PresetUpgradeCondition {
  currentPreset: WorkflowPreset;
  suggestedUpgrade: WorkflowPreset;
  reason: string;
  fileCount: number;
  threshold: number;
  moduleAffectedThreshold?: number;  // module count threshold (design §2.3)
}

export interface DetectionResult {
  preset: WorkflowPreset;
  reason: string;
  upgrade: PresetUpgradeCondition | null;
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
  },
  hotfix: {
    label: 'Bug 修复',
    skipBrainstorming: true,
    skipOutlineDesign: true,
    maxTasks: 3,
    maxFiles: 3,
    upgradeThreshold: 3,
  },
  tweak: {
    label: '小型调整',
    skipBrainstorming: true,
    skipOutlineDesign: true,
    maxTasks: 5,
    maxFiles: 5,
    upgradeThreshold: 5,
  },
};

// ─── Read preset config from project.yaml ───

/**
 * Read preset workflow configuration from .ivy/project.yaml.
 * Merges user-provided overrides on top of BUILTIN_PRESETS defaults.
 * Handles snake_case YAML keys → camelCase interface conversion.
 */
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

    // Map snake_case YAML keys to camelCase interface fields
    const keyMap: Record<string, keyof PresetConfig> = {
      label: 'label',
      skip_brainstorming: 'skipBrainstorming',
      skip_outline_design: 'skipOutlineDesign',
      max_tasks: 'maxTasks',
      max_files: 'maxFiles',
      upgrade_threshold: 'upgradeThreshold',
      skipBrainstorming: 'skipBrainstorming',
      skipOutlineDesign: 'skipOutlineDesign',
      maxTasks: 'maxTasks',
      maxFiles: 'maxFiles',
      upgradeThreshold: 'upgradeThreshold',
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
 * Heuristics:
 *   - Change name contains "fix"/"hotfix" or file count ≤ 3  → hotfix
 *   - File count ≤ 5 or change name contains "tweak"/"bump"  → tweak
 *   - Everything else → full
 */
export function detectPreset(
  changeName: string,
  fileCount: number,
  moduleCount?: number,
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

  // Check upgrade condition
  const config = BUILTIN_PRESETS[preset];
  let upgrade: PresetUpgradeCondition | null = null;

  if (config.upgradeThreshold !== null && fileCount > config.upgradeThreshold) {
    upgrade = {
      currentPreset: preset,
      suggestedUpgrade: 'full',
      reason: `${fileCount} files > ${config.upgradeThreshold} threshold`,
      fileCount,
      threshold: config.upgradeThreshold,
      ...(moduleCount !== undefined ? { moduleAffectedThreshold: moduleCount } : {}),
    };
  }

  return { preset, reason, upgrade };
}

/**
 * Decision Protocol — v0.13 pause-and-confirm mechanism.
 *
 * 4 core decision points (mandatory pauses) + 3 event hooks (conditional).
 * Integrated with Lifecycle Projection — each checkpoint transition checks
 * the relevant decision point before proceeding.
 *
 * Design constraints (design.md D3):
 *   - Core points always pause unless auto-approved
 *   - Event hooks trigger only when conditions are met
 *   - CI/CD can auto-approve all points
 */

import { promises as fs } from 'fs';
import path from 'path';

import { readYaml } from '../utils/yaml.js';
import { fileExists, readDir } from '../utils/fs.js';

// ─── Types ───

export type CoreDecisionPoint =
  | 'requirements_confirmed'    // DP-1  at open
  | 'design_approved'           // DP-3  at design
  | 'implementation_ready'      // DP-4  at build
  | 'archive_confirmed';        // DP-8  at archive

export type EventHook =
  | 'brainstorming_confirmed'   // EH-2  at design (skipped by hotfix)
  | 'spec_change_detected'      // EH-5  triggered when spec files change
  | 'failure_strategy';         // EH-6  triggered when verification fails

export interface DecisionProtocolConfig {
  enabled: boolean;
  requiredPoints: CoreDecisionPoint[];
  eventHooks: EventHook[];
  autoApprovePoints?: CoreDecisionPoint[];
  autoApproveHooks?: EventHook[];
}

export interface DecisionPointStatus {
  id: string;
  point: CoreDecisionPoint | EventHook;
  label: string;
  description: string;
  status: 'pending' | 'approved' | 'skipped';
  checkpoint: string;
}

// ─── Default config ───

export const DEFAULT_DECISION_PROTOCOL: DecisionProtocolConfig = {
  enabled: true,
  requiredPoints: [
    'requirements_confirmed',
    'design_approved',
    'implementation_ready',
    'archive_confirmed',
  ],
  eventHooks: [
    'brainstorming_confirmed',
    'spec_change_detected',
    'failure_strategy',
  ],
  autoApprovePoints: [],
  autoApproveHooks: ['failure_strategy'],
};

// ─── Point-to-checkpoint mapping ───

export const DECISION_POINT_CHECKPOINTS: Record<string, string> = {
  requirements_confirmed: 'open',
  brainstorm_confirmed: 'design',
  design_approved: 'design',
  implementation_ready: 'build',
  spec_change_detected: 'build',
  failure_strategy: 'verify',
  archive_confirmed: 'archive',
};

// ─── Read config from project.yaml ───

export async function readDecisionProtocolConfig(cwd: string): Promise<DecisionProtocolConfig> {
  const projectYamlPath = path.join(cwd, '.ivy', 'project.yaml');
  if (!(await fileExists(projectYamlPath))) {
    return { ...DEFAULT_DECISION_PROTOCOL, enabled: false };
  }

  const projectYaml = await readYaml<{
    workflow?: {
      decision_protocol?: Partial<DecisionProtocolConfig>;
    };
  }>(projectYamlPath);

  const config = projectYaml?.workflow?.decision_protocol;
  if (!config) return { ...DEFAULT_DECISION_PROTOCOL };

  return {
    ...DEFAULT_DECISION_PROTOCOL,
    ...config,
  };
}

// ─── Get pending decision points for a checkpoint ───

export function getDecisionPointsForCheckpoint(
  checkpoint: string,
  config: DecisionProtocolConfig,
): DecisionPointStatus[] {
  if (!config.enabled) return [];

  const points: DecisionPointStatus[] = [];

  // Map checkpoint to relevant decision points
  switch (checkpoint) {
    case 'open':
      if (config.requiredPoints.includes('requirements_confirmed')) {
        points.push({
          id: 'DP-1',
          point: 'requirements_confirmed',
          label: 'Requirements clarification complete',
          description: 'Requirements have been clarified and confirmed',
          status: config.autoApprovePoints?.includes('requirements_confirmed') ? 'approved' : 'pending',
          checkpoint,
        });
      }
      break;
    case 'design':
      if (config.requiredPoints.includes('design_approved')) {
        points.push({
          id: 'DP-3',
          point: 'design_approved',
          label: 'Design document reviewed and approved',
          description: 'Design document has been reviewed and approved',
          status: config.autoApprovePoints?.includes('design_approved') ? 'approved' : 'pending',
          checkpoint,
        });
      }
      break;
    case 'build':
      if (config.requiredPoints.includes('implementation_ready')) {
        points.push({
          id: 'DP-4',
          point: 'implementation_ready',
          label: 'Implementation plan is ready',
          description: 'Implementation plan has been reviewed and confirmed',
          status: config.autoApprovePoints?.includes('implementation_ready') ? 'approved' : 'pending',
          checkpoint,
        });
      }
      break;
    case 'archive':
      if (config.requiredPoints.includes('archive_confirmed')) {
        points.push({
          id: 'DP-8',
          point: 'archive_confirmed',
          label: 'Archive final confirmation',
          description: 'Change is ready to be archived',
          status: config.autoApprovePoints?.includes('archive_confirmed') ? 'approved' : 'pending',
          checkpoint,
        });
      }
      break;
  }

  return points;
}

// ─── Check if all required points are approved for a transition ───

export function canProceedWithTransition(
  fromCheckpoint: string,
  toCheckpoint: string,
  config: DecisionProtocolConfig,
): { allowed: boolean; pendingPoints: DecisionPointStatus[] } {
  if (!config.enabled) {
    return { allowed: true, pendingPoints: [] };
  }

  // Which checkpoint are we transitioning INTO?
  const points = getDecisionPointsForCheckpoint(toCheckpoint, config);
  const pending = points.filter((p) => p.status === 'pending');

  return {
    allowed: pending.length === 0,
    pendingPoints: pending,
  };
}

// ─── Event hook detection ───

/**
 * Check EH-5: spec_change_detected.
 * Returns true if spec files in the change directory have been modified
 * more recently than the last transition timestamp.
 */
export async function checkSpecChangeDetected(
  cwd: string,
  changeName: string,
  lastTransitionAt?: string,
): Promise<boolean> {
  const specsDir = path.join(cwd, 'openspec', 'changes', changeName, 'specs');
  if (!(await fileExists(specsDir))) return false;

  try {
    const entries = await readDir(specsDir);
    const specFiles = entries.filter((e) => e.endsWith('.md'));
    if (specFiles.length === 0) return false;

    const lastTransition = lastTransitionAt ? new Date(lastTransitionAt).getTime() : 0;
    if (!lastTransition) return true; // no baseline — treat as changed

    let latestMod = 0;
    for (const file of specFiles) {
      const stat = await fs.stat(path.join(specsDir, file));
      if (stat.mtimeMs > latestMod) latestMod = stat.mtimeMs;
    }

    return latestMod > lastTransition;
  } catch {
    return false;
  }
}

/**
 * Check EH-6: failure_strategy.
 * Returns true if verify failure records exist in .ivy/verify/ directory.
 */
export async function checkFailureStrategyTriggered(
  cwd: string,
): Promise<boolean> {
  const verifyDir = path.join(cwd, '.ivy', 'verify');
  if (!(await fileExists(verifyDir))) return false;

  try {
    const entries = await readDir(verifyDir);
    return entries.some((e) => e.includes('fail') || e.includes('error'));
  } catch {
    return false;
  }
}

/**
 * Get all active event hooks for a given checkpoint.
 * Only returns hooks whose trigger conditions are met.
 */
export async function getActiveEventHooks(
  checkpoint: string,
  config: DecisionProtocolConfig,
  cwd: string,
  changeName: string,
  lastTransitionAt?: string,
): Promise<DecisionPointStatus[]> {
  if (!config.enabled) return [];

  const hooks: DecisionPointStatus[] = [];

  // EH-2: brainstorming_confirmed — at design checkpoint
  if (checkpoint === 'design' && config.eventHooks.includes('brainstorming_confirmed')) {
    hooks.push({
      id: 'EH-2',
      point: 'brainstorming_confirmed',
      label: 'Brainstorming scheme confirmed',
      description: 'Brainstorming has been completed and the approach is confirmed',
      status: config.autoApproveHooks?.includes('brainstorming_confirmed') ? 'approved' : 'pending',
      checkpoint,
    });
  }

  // EH-5: spec_change_detected — at build checkpoint, conditional on spec modification
  if (checkpoint === 'build' && config.eventHooks.includes('spec_change_detected')) {
    const triggered = await checkSpecChangeDetected(cwd, changeName, lastTransitionAt);
    if (triggered) {
      hooks.push({
        id: 'EH-5',
        point: 'spec_change_detected',
        label: 'Spec change detected',
        description: 'Spec files have been modified since the last transition',
        status: config.autoApproveHooks?.includes('spec_change_detected') ? 'approved' : 'pending',
        checkpoint,
      });
    }
  }

  // EH-6: failure_strategy — at verify checkpoint, conditional on verify failures
  if (checkpoint === 'verify' && config.eventHooks.includes('failure_strategy')) {
    const triggered = await checkFailureStrategyTriggered(cwd);
    if (triggered) {
      hooks.push({
        id: 'EH-6',
        point: 'failure_strategy',
        label: 'Verify failure detected',
        description: 'Verification has reported failures that need handling',
        status: config.autoApproveHooks?.includes('failure_strategy') ? 'approved' : 'pending',
        checkpoint,
      });
    }
  }

  return hooks;
}

/**
 * `ivy state` — Lifecycle checkpoint view, set, and recover.
 *
 * v0.13: Governed Execution — Lifecycle Projection.
 *
 * Commands:
 *   ivy state                          — display current checkpoint and history
 *   ivy state set <checkpoint>         — transition to a new checkpoint
 *   ivy state recover                  — restore checkpoint from state.yaml
 *   ivy state --pending                — show pending decision points
 */

import path from 'path';

import { logger } from '../utils/logger.js';
import { readYaml } from '../utils/yaml.js';
import { fileExists } from '../utils/fs.js';
import { parsePhase, listPhases, canTransition } from '../core/phase-machine.js';
import {
  readState,
  writeState,
  createInitialState,
  applyTransition,
  runGuardChecks,
  runPostTransitionActions,
  isBackwardTransition,
  type StateYaml,
  type LifecycleCheckpoint,
} from '../core/lifecycle-projection.js';
import {
  readDecisionProtocolConfig,
  canProceedWithTransition,
  getDecisionPointsForCheckpoint,
  getActiveEventHooks,
} from '../core/decision-protocol.js';
import { detectPreset, BUILTIN_PRESETS } from '../core/preset-workflow.js';

export interface StateOptions {
  command?: 'set' | 'recover';
  checkpoint?: string;
  change?: string;
  pending?: boolean;
  rationale?: string;
  refs?: string;
  cwd?: string;
}

export async function runState(opts: StateOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();

  // Read project.yaml to get project context
  const projectYaml = await readYaml<{ version?: string }>(path.join(cwd, '.ivy', 'project.yaml'));
  if (!projectYaml) {
    logger.error('No `.ivy/project.yaml` found. Run `ivy init` first.');
    return 1;
  }

  const changeName = opts.change ?? await detectCurrentChange(cwd);
  if (!changeName) {
    logger.error('No change detected. Specify --change <name> or create a change first.');
    return 1;
  }

  // Read existing state
  const state = await readState(cwd);

  if (opts.pending) {
    return showPendingDecisionPoints(state);
  }

  if (opts.command === 'recover') {
    return showStateRecover(state, changeName);
  }

  if (opts.command === 'set') {
    return await runStateSet(cwd, changeName, state, opts.checkpoint, opts.rationale, opts.refs);
  }

  // Default: show state
  return showState(state, changeName);
}

// ─── Show state ───

function showState(state: StateYaml | null, changeName: string): number {
  logger.header(`IvyFlow Lifecycle State — ${changeName}`);
  logger.divider();

  if (!state) {
    logger.info('  No lifecycle state file found.');
    logger.info('  Run `ivy state set <checkpoint>` to initialise.');
    return 0;
  }

  logger.info(`  Checkpoint:  ${state.checkpoint}`);
  logger.info(`  Change:     ${state.changeName}`);

  const enteredDate = new Date(state.enteredAt);
  const elapsed = Math.round((Date.now() - enteredDate.getTime()) / 60000);
  logger.info(`  Entered:    ${formatDate(state.enteredAt)} (${elapsed}m ago)`);

  // Allowed transitions
  logger.info('');
  logger.info('  Allowed Transitions:');
  for (const p of listPhases()) {
    if (p === state.checkpoint) continue;
    const from = parsePhase(state.checkpoint);
    if (!from) continue;
    if (canTransition(from, p)) {
      logger.info(`    ✓ → ${p}  (forward)`);
    } else if (isBackwardTransition(state.checkpoint as LifecycleCheckpoint, p as LifecycleCheckpoint)) {
      logger.info(`    ✓ → ${p}  (backward)`);
    }
  }

  // Transition history
  logger.info('');
  logger.info(`  Transition History (${Math.min(state.transitionHistory.length, 10)} of 10 shown):`);
  for (const entry of state.transitionHistory.slice(0, 10)) {
    const from = entry.from ?? '(start)';
    const rationale = entry.rationale ? `  ✓ ${entry.rationale}` : '';
    logger.info(`    ${from} → ${entry.to}  ${formatDate(entry.timestamp)}${rationale}`);
  }

  return 0;
}

// ─── State set ───

async function runStateSet(
  cwd: string,
  changeName: string,
  state: StateYaml | null,
  checkpoint?: string,
  rationale?: string,
  refs?: string,
): Promise<number> {
  if (!checkpoint) {
    logger.error('Usage: ivy state set <checkpoint>');
    logger.info('Checkpoints: open, design, build, verify, archive');
    return 1;
  }

  const targetPhase = parsePhase(checkpoint);
  if (!targetPhase) {
    logger.error(`Unknown checkpoint: '${checkpoint}'. Valid: ${listPhases().join(', ')}`);
    return 1;
  }

  // Check decision protocol before transitioning
  if (state) {
    const dpConfig = await readDecisionProtocolConfig(cwd);

    // Preset-aware auto-approval: hotfix/tweak skip design & brainstorming
    const fileCount = await estimateFileCount(changeName, cwd);
    const detection = detectPreset(changeName, fileCount);
    if (detection.preset === 'hotfix' || detection.preset === 'tweak') {
      const presetConfig = BUILTIN_PRESETS[detection.preset];
      if (!dpConfig.autoApprovePoints) dpConfig.autoApprovePoints = [];
      if (!dpConfig.autoApproveHooks) dpConfig.autoApproveHooks = [];
      if (presetConfig.skipOutlineDesign && !dpConfig.autoApprovePoints.includes('design_approved')) {
        dpConfig.autoApprovePoints.push('design_approved');
      }
      if (presetConfig.skipBrainstorming && !dpConfig.autoApproveHooks.includes('brainstorming_confirmed')) {
        dpConfig.autoApproveHooks.push('brainstorming_confirmed');
      }
    }

    const { allowed, pendingPoints } = canProceedWithTransition(
      state.checkpoint,
      checkpoint as string,
      dpConfig,
    );

    // See if there are pending decision points for the target checkpoint
    const { getDecisionPointsForCheckpoint } = await import('../core/decision-protocol.js');
    const targetPoints = getDecisionPointsForCheckpoint(checkpoint, dpConfig);
    const pendingDps = targetPoints.filter((p) => p.status === 'pending');

    if (pendingDps.length > 0) {
      logger.header('Decision Points Pending');
      logger.divider();
      for (const dp of pendingDps) {
        logger.info(`  [${dp.id}] ${dp.label}`);
        logger.info(`    "${dp.description}"`);
        logger.info(`    Status: ${dp.status}`);
        logger.info('');
      }
      logger.info('  Options:');
      logger.info('    1. Approve and continue  (Recommended)');
      logger.info('       Run `ivy state set <checkpoint> --rationale "<your reason>" --refs <evidence-id>`');
      logger.info('    2. Review documentation before proceeding');
      logger.info('       Review the relevant artifacts (`proposal.md`, `design.md`, `tasks.md`)');
      logger.info('    3. Pause and come back later');
      logger.info('       No action needed — current state is preserved.');
      return 1;
    }

    // Check active event hooks
    const activeHooks = await getActiveEventHooks(
      checkpoint as string,
      dpConfig,
      cwd,
      changeName,
      state.lastTransitionAt,
    );
    const pendingHooks = activeHooks.filter((h) => h.status === 'pending');
    if (pendingHooks.length > 0) {
      logger.header('Active Event Hooks');
      logger.divider();
      for (const hook of pendingHooks) {
        logger.info(`  [${hook.id}] ${hook.label}`);
        logger.info(`    "${hook.description}"`);
        logger.info(`    Status: ${hook.status}`);
        logger.info('');
      }
      logger.warn('Active event hooks require attention before transition.');
      logger.info('  Run `ivy state --pending` for details and options.');
      return 1;
    }

    // Check transition permission
    if (!allowed) {
      logger.warn('Decision protocol blocks this transition.');
      return 1;
    }
  }

  let currentState = state;

  // Initialise state if not present
  if (!currentState) {
    currentState = createInitialState(changeName);
    if (targetPhase !== 'open') {
      try {
        currentState = applyTransition(currentState, targetPhase as LifecycleCheckpoint);
      } catch (err) {
        logger.error((err as Error).message);
        return 1;
      }
    }
  } else {
    try {
      currentState = applyTransition(currentState, targetPhase as LifecycleCheckpoint, rationale, refs ? refs.split(',').map((r) => r.trim()) : undefined);
    } catch (err) {
      logger.error((err as Error).message);
      return 1;
    }
  }

  const transitionFrom = currentState.transitionHistory[0].from ?? '(start)';
  logger.header(`IvyFlow Checkpoint Transition — ${transitionFrom} → ${checkpoint}`);
  logger.divider();

  // Run guard checks
  const from = currentState.transitionHistory[0].from ?? 'open';
  const guardResults = await runGuardChecks(cwd, from as LifecycleCheckpoint, targetPhase as LifecycleCheckpoint, changeName);
  let allPassed = true;
  let checkNum = 1;
  for (const result of guardResults) {
    const icon = result.passed ? '✓' : '✗';
    if (!result.passed) allPassed = false;
    logger.info(`    CHECK ${checkNum}/${guardResults.length}: ${result.check}         ${icon}`);
    checkNum++;
  }

  if (!allPassed) {
    logger.error('Guard checks failed. Transition blocked.');
    for (const result of guardResults.filter((r) => !r.passed)) {
      logger.info(`    ✗ ${result.check}: ${result.message ?? 'failed'}`);
    }
    return 1;
  } else if (guardResults.length > 0) {
    logger.success('ALL CHECKS PASSED');
  }

  logger.info('');
  if (currentState.transitionHistory[0].from && isBackwardTransition(from as LifecycleCheckpoint, targetPhase as LifecycleCheckpoint)) {
    logger.warn(`  Backward transition: ${from} → ${checkpoint}`);
    logger.info('     Returning to earlier checkpoint. Evidence record will note the rollback.');
  }

  // Write state
  await writeState(cwd, currentState);
  logger.success(`Checkpoint updated: ${from} → ${checkpoint}`);

  // Post-transition actions (archive cleanup hook, etc.)
  await runPostTransitionActions(cwd, changeName, targetPhase as LifecycleCheckpoint);

  return 0;
}

// ─── State recover ───

function showStateRecover(state: StateYaml | null, changeName: string): number {
  logger.header(`IvyFlow State Recovery — ${changeName}`);
  logger.divider();

  if (!state) {
    logger.info('  No lifecycle state to recover.');
    logger.info('  Run `ivy state set <checkpoint>` to initialise.');
    return 0;
  }

  logger.info('  Recovered:');
  logger.info(`    Checkpoint: ${state.checkpoint}`);
  logger.info(`    Change:     ${state.changeName}`);
  logger.info('');
  logger.info(`  Transition History Available: ${state.transitionHistory.length} transitions`);
  logger.info('  Action: Continue from last checkpoint. No execution state to restore (IvyFlow does not execute tasks).');

  return 0;
}

// ─── Pending decision points ───

function showPendingDecisionPoints(state: StateYaml | null): number {
  logger.header('Pending Decision Points');
  logger.divider();

  if (!state) {
    logger.info('  No lifecycle state. Create a checkpoint first.');
    return 0;
  }

  const decisionPoints: Array<{ id: string; label: string; description: string }> = [];

  if (state.checkpoint === 'open') {
    decisionPoints.push({ id: 'DP-1', label: 'requirements_confirmed', description: 'Requirements clarification complete.' });
  }
  if (state.checkpoint === 'design') {
    decisionPoints.push({ id: 'DP-3', label: 'design_approved', description: 'Design document reviewed and approved.' });
  }
  if (state.checkpoint === 'build') {
    decisionPoints.push({ id: 'DP-4', label: 'implementation_ready', description: 'Implementation plan is ready.' });
  }
  if (state.checkpoint === 'archive') {
    decisionPoints.push({ id: 'DP-8', label: 'archive_confirmed', description: 'Archive final confirmation.' });
  }

  if (decisionPoints.length === 0) {
    logger.info('  No pending decision points for this checkpoint.');
    return 0;
  }

  for (const dp of decisionPoints) {
    logger.info(`  [${dp.id}] ${dp.label}`);
    logger.info(`    "${dp.description}"`);
  }

  logger.info('');
  logger.info('  Options:');
  logger.info('    1. Continue to implementation  (Recommended)');
  logger.info('       Run `ivy state set build --rationale "<reason>" --refs <evidence-id>`');
  logger.info('    2. Review plan before proceeding');
  logger.info('       Review the relevant artifacts to confirm readiness.');
  logger.info('    3. Pause and come back later');
  logger.info('       No action needed — current state is preserved.');

  return 0;
}

// ─── Helpers ───

async function detectCurrentChange(cwd: string): Promise<string | null> {
  const changesDir = path.join(cwd, 'openspec', 'changes');
  if (!(await fileExists(changesDir))) return null;

  const { readDir } = await import('../utils/fs.js');
  const entries = await readDir(changesDir);
  const changes = entries.filter((e) => !e.startsWith('.') && e !== 'archive');
  if (changes.length === 0) return null;
  if (changes.length === 1) return changes[0];

  // Pick the most recent by checking .ivy.yaml modification time
  let latest: string | null = null;
  let latestTime = 0;
  for (const change of changes) {
    const ivyPath = path.join(changesDir, change, '.ivy.yaml');
    if (await fileExists(ivyPath)) {
      const { promises: fs } = await import('fs');
      const stat = await fs.stat(ivyPath);
      if (stat.mtimeMs > latestTime) {
        latestTime = stat.mtimeMs;
        latest = change;
      }
    }
  }
  return latest;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  } catch {
    return iso;
  }
}

async function estimateFileCount(changeName: string, cwd?: string): Promise<number> {
  const baseDir = cwd ?? process.cwd();
  const changeDir = path.join(baseDir, 'openspec', 'changes', changeName);
  if (!(await fileExists(changeDir))) return 1;
  const { readDir } = await import('../utils/fs.js');
  try {
    const entries = await readDir(changeDir);
    return Math.max(1, entries.filter((e) => !e.startsWith('.')).length);
  } catch {
    return 1;
  }
}

/**
 * `ivy workflow` — workflow preset detection, evidence display, archive.
 *
 * v0.13: Governed Execution — Preset Workflows, Workflow Evidence.
 *
 * Subcommands:
 *   ivy workflow preset [--detect] [<name>]    — list or detect workflow presets
 *   ivy workflow evidence [--check-archive]     — display transition evidence
 *   ivy workflow archive [<change>]             — archive with evidence chain check
 */

import path from 'path';

import { logger } from '../utils/logger.js';
import { fileExists } from '../utils/fs.js';
import { readYaml } from '../utils/yaml.js';
import { readState } from '../core/lifecycle-projection.js';
import { detectPreset, BUILTIN_PRESETS } from '../core/preset-workflow.js';
import {
  buildWorkflowEvidenceReport,
  checkArchiveReadiness,
  type WorkflowEvidenceEntry,
} from '../core/workflow-evidence.js';
import { createInitialState, writeState } from '../core/lifecycle-projection.js';

export interface WorkflowOptions {
  subcommand?: 'preset' | 'evidence' | 'archive' | 'start' | 'status';
  detect?: boolean;
  change?: string;
  checkArchive?: boolean;
  clean?: boolean;
  isolate?: boolean;
  cwd?: string;
}

export async function runWorkflow(opts: WorkflowOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();

  const changeName = opts.change ?? await detectCurrentChange(cwd);

  switch (opts.subcommand) {
    case 'start':
      return runStart(cwd, changeName, opts);
    case 'status':
      return runStatus(cwd, changeName);
    case 'preset':
      return runPreset(changeName, opts);
    case 'evidence':
      return runEvidence(cwd, changeName, opts);
    case 'archive':
      return runArchive(cwd, changeName, opts);
    default:
      return showWorkflowHelp();
  }
}

// ─── Start ───

async function runStart(cwd: string, changeName: string | null, opts: WorkflowOptions): Promise<number> {
  if (!changeName) {
    logger.error('No change specified. Use --change <name> to select a change.');
    return 1;
  }

  logger.header(`IvyFlow Workflow Start — ${changeName}`);
  logger.divider();

  // Check if state already exists
  const state = await readState(cwd);
  if (state) {
    logger.info(`  Workflow already started for "${changeName}" at checkpoint "${state.checkpoint}".`);
    return 0;
  }

  // Create initial state
  const newState = createInitialState(changeName);
  await writeState(cwd, newState);
  logger.success(`Workflow started for "${changeName}" at checkpoint "open".`);

  // Optional isolation
  if (opts.isolate) {
    const { createWorktree } = await import('../core/execution-isolation.js');
    try {
      const result = await createWorktree(cwd, changeName);
      if (result.provider === 'git-worktree') {
        logger.success(`Isolated worktree created at: ${result.worktreeDir}`);
      } else {
        logger.warn('Isolation not available (git-worktree failed). Working in-place.');
      }
    } catch {
      logger.warn('Isolation setup failed. Working in-place.');
    }
  }

  return 0;
}

// ─── Status ───

async function runStatus(cwd: string, changeName: string | null): Promise<number> {
  if (!changeName) {
    logger.error('No change specified. Use --change <name> to select a change.');
    return 1;
  }

  logger.header(`IvyFlow Workflow Status — ${changeName}`);
  logger.divider();

  const state = await readState(cwd);
  if (!state) {
    logger.info('  No workflow state found. Run `ivy workflow start` to begin.');
    return 0;
  }

  const enteredDate = new Date(state.enteredAt);
  const elapsed = Math.round((Date.now() - enteredDate.getTime()) / 60000);

  logger.info(`  Change:     ${state.changeName}`);
  logger.info(`  Checkpoint: ${state.checkpoint}`);
  logger.info(`  Elapsed:    ${elapsed}m at current checkpoint`);

  // Auto-detect preset
  const fileCount = await estimateFileCount(changeName);
  const presetResult = detectPreset(changeName, fileCount);
  logger.info(`  Preset:     ${presetResult.preset} (${presetResult.reason})`);

  if (presetResult.upgrade) {
    logger.warn(`  Upgrade:    ${presetResult.upgrade.suggestedUpgrade} recommended (${presetResult.upgrade.fileCount} files > ${presetResult.upgrade.threshold} threshold)`);
  }

  logger.info(`  Transitions: ${state.transitionHistory.length} recorded`);

  return 0;
}

// ─── Preset ───

async function runPreset(changeName: string | null, opts: WorkflowOptions): Promise<number> {
  logger.header('IvyFlow Workflow Presets');
  logger.divider();

  if (opts.detect) {
    if (!changeName) {
      logger.error('No change detected. Cannot auto-detect preset.');
      return 1;
    }
    const fileCount = await estimateFileCount(changeName);
    const result = detectPreset(changeName, fileCount);

    logger.info(`  Change:      ${changeName}`);
    logger.info(`  Detected:    ${result.preset} (${result.reason})`);
    logger.info(`  File Count:  ${fileCount}`);

    if (result.upgrade) {
      logger.warn(`  Preset Upgrade: ${result.upgrade.currentPreset} (${result.upgrade.reason})`);
      logger.info(`  Suggested:   ${result.upgrade.suggestedUpgrade}`);
      const confirmed = await promptUpgrade(result.upgrade.suggestedUpgrade);
      if (confirmed) {
        logger.success(`  Upgrade to "${result.upgrade.suggestedUpgrade}" confirmed.`);
        logger.info('  Run `ivy state set build` to continue with the upgraded preset.');
      } else {
        logger.info('  Upgrade declined. Continuing with current preset.');
      }
    }
    return 0;
  }

  // List all presets
  for (const [name, config] of Object.entries(BUILTIN_PRESETS)) {
    logger.info(`  ${name}:`);
    logger.info(`    Label:           ${config.label}`);
    logger.info(`    Skip Brainstorm: ${config.skipBrainstorming}`);
    logger.info(`    Skip Design:     ${config.skipOutlineDesign}`);
    logger.info(`    Max Tasks:       ${config.maxTasks ?? 'unlimited'}`);
    logger.info(`    Max Files:       ${config.maxFiles ?? 'unlimited'}`);
    logger.info(`    Upgrade At:      ${config.upgradeThreshold ?? 'never'}`);
    logger.info('');
  }

  return 0;
}

// ─── Evidence ───

async function runEvidence(cwd: string, changeName: string | null, opts: WorkflowOptions): Promise<number> {
  if (!changeName) {
    logger.error('No change specified. Use --change <name> to select a change.');
    return 1;
  }

  logger.header(`Workflow Evidence — ${changeName}`);
  logger.divider();

  const state = await readState(cwd);
  if (!state || state.transitionHistory.length === 0) {
    logger.info('  No transition history found. Run `ivy state set` to start tracking.');
    return 0;
  }

  const entries: WorkflowEvidenceEntry[] = state.transitionHistory.map((t) => ({
    transition: t.from ? `${t.from}→${t.to}` : `(start)→${t.to}`,
    rationale: t.rationale ?? '',
    refs: t.refs ?? [],
    timestamp: t.timestamp,
  }));

  const report = buildWorkflowEvidenceReport(changeName, entries);

  // Table header
  const transitionPad = 20;
  const rationalePad = 44;
  logger.info(`  ${'Transition'.padEnd(transitionPad)} │ ${'Rationale'.padEnd(rationalePad)} │ Refs`);
  logger.info(`  ${'─'.repeat(transitionPad)}─┼${'─'.repeat(rationalePad)}─┼${'─'.repeat(14)}`);

  for (const entry of report.entries) {
    const transition = entry.transition.length > transitionPad - 2
      ? entry.transition.slice(0, transitionPad - 5) + '...'
      : entry.transition;
    const rationale = entry.rationale.length > rationalePad - 2
      ? entry.rationale.slice(0, rationalePad - 5) + '...'
      : (entry.rationale || '(none)');
    const refsStr = entry.refs.length > 0 ? entry.refs.join(', ') : '(none)';
    logger.info(`  ${transition.padEnd(transitionPad)} │ ${rationale.padEnd(rationalePad)} │ ${refsStr}`);
  }

  logger.info('');
  logger.info(`  Total: ${report.totalTransitions} transitions, ${report.documentedTransitions} documented`);
  logger.info('  Refs reference v0.12 EvidenceRecord IDs.');

  if (opts.checkArchive) {
    logger.divider();
    logger.header('Archive Readiness Check');
    const readiness = checkArchiveReadiness(report);
    if (readiness.ready) {
      logger.success('All transitions have rationale and evidence refs. Ready for archive.');
    } else {
      logger.warn('Archive readiness issues:');
      for (const issue of readiness.issues) {
        logger.info(`    - ${issue}`);
      }
    }
  }

  return 0;
}

// ─── Archive ───

async function runArchive(cwd: string, changeName: string | null, opts: WorkflowOptions): Promise<number> {
  if (!changeName) {
    logger.error('No change specified. Use --change <name> to select a change.');
    return 1;
  }

  logger.header(`IvyFlow Archive — ${changeName}`);
  logger.divider();

  const state = await readState(cwd);
  if (!state) {
    logger.error('No lifecycle state found. Nothing to archive.');
    return 1;
  }

  if (state.checkpoint !== 'archive') {
    logger.warn(`Change is at "${state.checkpoint}", not "archive". Run \`ivy state set archive\` first.`);
    return 1;
  }

  // Check evidence readiness
  const entries: WorkflowEvidenceEntry[] = state.transitionHistory.map((t) => ({
    transition: t.from ? `${t.from}→${t.to}` : `(start)→${t.to}`,
    rationale: t.rationale ?? '',
    refs: t.refs ?? [],
    timestamp: t.timestamp,
  }));

  const report = buildWorkflowEvidenceReport(changeName, entries);
  const readiness = checkArchiveReadiness(report);

  if (!readiness.ready) {
    logger.warn('Evidence chain is incomplete:');
    for (const issue of readiness.issues) {
      logger.info(`    - ${issue}`);
    }
    logger.info('');
    logger.info('Proceeding with archive anyway (evidence gaps noted).');
  }

  // Clean worktrees if requested
  if (opts.clean) {
    const { listWorktrees, destroyWorktree } = await import('../core/execution-isolation.js');
    const worktrees = await listWorktrees(cwd);
    for (const wt of worktrees) {
      logger.info(`  Cleaning worktree: ${wt}`);
      await destroyWorktree(wt);
    }
  }

  logger.success(`Change "${changeName}" archived.`);
  return 0;
}

// ─── Help ───

function showWorkflowHelp(): number {
  logger.header('IvyFlow Workflow Commands');
  logger.divider();
  logger.info('  start [--isolate]     Start workflow for a change');
  logger.info('  status                Show current workflow state');
  logger.info('  preset                List available workflow presets');
  logger.info('  preset --detect       Auto-detect preset for current change');
  logger.info('  evidence              Display transition evidence');
  logger.info('  evidence --check-archive   Check archive readiness');
  logger.info('  archive [--clean]     Archive a completed change');
  logger.info('');
  logger.info('Options:');
  logger.info('  --change <name>     Specify a change to operate on');
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
  return changes[0] ?? null;
}

async function estimateFileCount(changeName: string): Promise<number> {
  // Quick heuristic: count files in the change directory
  const changeDir = path.join(process.cwd(), 'openspec', 'changes', changeName);
  if (!(await fileExists(changeDir))) return 1;

  const { readDir } = await import('../utils/fs.js');
  try {
    const entries = await readDir(changeDir);
    return Math.max(1, entries.filter((e) => !e.startsWith('.')).length);
  } catch {
    return 1;
  }
}

/**
 * Prompt the user for upgrade confirmation.
 * Returns true if confirmed, false otherwise.
 * Falls back to false in non-TTY environments (CI).
 */
async function promptUpgrade(suggested: string): Promise<boolean> {
  try {
    const { createInterface } = await import('readline');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question(`  Upgrade to "${suggested}"? [y/N] `, (answer: string) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  } catch {
    // Non-TTY or readline unavailable — assume no
    return false;
  }
}

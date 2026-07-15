import path from 'path';
import { logger } from '../utils/logger.js';
import { readYaml } from '../utils/yaml.js';
import { fileExists } from '../utils/fs.js';
import { parsePhase } from '../core/phase-machine.js';
import { readState, applyTransition, writeState, runPostTransitionActions } from '../core/lifecycle-projection.js';
import { runHardGuard, formatGuardResult } from '../core/guard-engine.js';
import type { LifecycleCheckpoint } from '../core/lifecycle-projection.js';

export interface GuardOptions {
  phase: string;
  apply?: boolean;
  change?: string;
  cwd?: string;
}

export async function runGuard(opts: GuardOptions): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const targetPhase = parsePhase(opts.phase);
  if (!targetPhase) {
    logger.error(`Unknown phase: '${opts.phase}'. Valid: open, design, build, verify, archive`);
    return 1;
  }

  const changeName = opts.change ?? await detectCurrentChange(cwd);
  if (!changeName) {
    logger.error('No change detected. Specify --change <name>.');
    return 1;
  }

  const state = await readState(cwd);
  if (!state) {
    logger.error('No lifecycle state found. Run ivy state init first.');
    return 1;
  }

  if (state.checkpoint !== targetPhase) {
    logger.warn(`State checkpoint is '${state.checkpoint}', but guard is for '${targetPhase}'.`);
  }

  const result = await runHardGuard(cwd, targetPhase, changeName, state);
  logger.info(formatGuardResult(result));

  if (!result.passed) {
    return 1;
  }

  if (opts.apply && result.nextPhase && result.nextPhase !== 'done') {
    const next = result.nextPhase as LifecycleCheckpoint;
    try {
      const newState = applyTransition(state, next);
      await writeState(cwd, newState);
      logger.success(`Phase transitioned: ${state.checkpoint} → ${next}`);
      await runPostTransitionActions(cwd, changeName, next);
    } catch (err) {
      logger.error((err as Error).message);
      return 1;
    }
  }

  return 0;
}

// ── Legacy guard validation (v0.15 triple-defense demo) ──

export interface GuardValidateOptions {
  demo?: boolean;
  cwd?: string;
}

export async function runGuardValidate(opts: GuardValidateOptions = {}): Promise<number> {
  if (opts.demo) {
    renderDemo();
    return 0;
  }

  logger.header('=== ivy guard ===');
  logger.info('');
  logger.info('Guard system is active. Use `ivy guard run <phase> --apply` for hard-blocking phase guards.');
  logger.info('Use `ivy guard validate --demo` to see guard scenarios.');
  return 0;
}

function renderDemo(): void {
  logger.header('=== ivy guard --demo ===');
  logger.info('');
  logger.info('The IvyFlow triple-defense system protects your workflow across 3 layers:');
  logger.info('');
  logger.info('Scenario 1: OPEN phase — agent tries to write .ts');
  logger.info('  Phase: open | Operation: write | File: src/main.ts');
  logger.info('  Blocks at: Layer 1 (Hook) — only .md writes allowed in OPEN phase');
  logger.info('');
  logger.info('Scenario 2: BUILD phase — agent writes .ts');
  logger.info('  Phase: build | Operation: write | File: src/main.ts');
  logger.info('  Blocks at: None (allowed) — BUILD phase permits all code edits');
  logger.info('');
  logger.info('Scenario 3: ARCHIVE phase — force push attempted');
  logger.info('  Phase: archive | Operation: push | File: refs/heads/main');
  logger.info('  Blocks at: Layer 3 (Git Hook) — no writes allowed in terminal phase');
  logger.info('');
  logger.success('Demo complete — 3 scenarios shown');
}

async function detectCurrentChange(cwd: string): Promise<string | null> {
  const changesDir = path.join(cwd, 'openspec', 'changes');
  if (!(await fileExists(changesDir))) return null;
  const { readDir } = await import('../utils/fs.js');
  const entries = await readDir(changesDir);
  const changes = entries.filter((e) => !e.startsWith('.') && e !== 'archive');
  return changes.length > 0 ? changes[0] : null;
}

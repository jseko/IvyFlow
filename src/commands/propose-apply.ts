import { execSync } from 'child_process';
import path from 'path';
import { logger } from '../utils/logger.js';
import { fileExists } from '../utils/fs.js';
import { WorktreeManager } from '../core/worktree-manager.js';
import { OpenSpecBridge } from '../core/openspec-bridge.js';

export interface ProposeOptions {
  cwd?: string;
  parallel?: boolean;
}

export async function runPropose(changeName: string, opts: ProposeOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();

  // 1) Create worktree
  logger.step('Creating worktree...');
  const mgr = new WorktreeManager({ cwd });
  try {
    const info = await mgr.create(changeName);
    logger.success(`Worktree: ${info.path}`);
  } catch (err) {
    logger.warn(`Worktree creation skipped: ${(err as Error).message}`);
  }

  // 2) Run OpenSpec propose — sequential or parallel
  if (opts.parallel) {
    logger.step('Running OpenSpec propose (parallel mode)...');
    try {
      execSync(`openspec new change "${changeName}"`, { cwd, stdio: 'inherit' });
    } catch {
      logger.warn('OpenSpec propose may have already been run or is unavailable.');
    }

    logger.step('Generating artifacts in parallel...');
    const bridge = new OpenSpecBridge({ changeName, cwd });
    const count = await bridge.generateArtifactsParallel(changeName);
    logger.success(`Generated ${count} artifact(s) in parallel.`);
  } else {
    logger.step('Running OpenSpec propose...');
    try {
      execSync(`openspec new change "${changeName}"`, { cwd, stdio: 'inherit' });
    } catch {
      logger.warn('OpenSpec propose may have already been run or is unavailable.');
    }
  }

  // 3) Recommend DESIGN phase
  logger.step('Recommending phase transition...');
  const bridge = new OpenSpecBridge({ changeName, cwd });
  const rec = await bridge.translateEvent('proposed', changeName);
  await bridge.recommendPhase(rec);

  return 0;
}

export async function runApply(changeName: string, opts: ProposeOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const changeDir = path.join(cwd, 'openspec', 'changes', changeName);

  if (!(await fileExists(changeDir))) {
    logger.error(`Change "${changeName}" not found at ${changeDir}`);
    return 1;
  }

  // 1) Run /opsx:apply
  logger.step('Running OpenSpec apply...');
  try {
    execSync(`openspec start apply "${changeName}"`, { cwd, stdio: 'inherit' });
  } catch {
    logger.warn('OpenSpec apply may not be available or already in progress.');
  }

  // 2) Recommend VERIFY phase
  const bridge = new OpenSpecBridge({ changeName, cwd });
  const rec = await bridge.translateEvent('applied', changeName);
  await bridge.recommendPhase(rec);

  return 0;
}

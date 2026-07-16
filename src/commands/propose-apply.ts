import path from 'path';
import { logger } from '../utils/logger.js';
import { fileExists } from '../utils/fs.js';
import { WorktreeManager } from '../core/worktree-manager.js';
import { readState, writeState, createInitialState } from '../core/lifecycle-projection.js';

export interface ProposeOptions {
  cwd?: string;
  parallel?: boolean;
}

export async function runPropose(changeName: string, opts: ProposeOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();

  const state = await readState(cwd);
  if (state && state.checkpoint !== 'open') {
    logger.warn(`Current phase is '${state.checkpoint}', not 'open'. Proceeding anyway.`);
  }

  logger.step('Creating worktree...');
  const mgr = new WorktreeManager({ cwd });
  try {
    const info = await mgr.create(changeName);
    logger.success(`Worktree: ${info.path}`);
  } catch (err) {
    logger.warn(`Worktree creation skipped: ${(err as Error).message}`);
  }

  logger.step('Initializing state...');
  if (!state) {
    const newState = createInitialState(changeName);
    await writeState(cwd, newState);
    logger.success(`State initialized for "${changeName}" at checkpoint "open".`);
  } else {
    logger.info(`State already exists for "${changeName}" at checkpoint "${state.checkpoint}".`);
  }

  logger.info('');
  logger.info('To create OpenSpec artifacts, load the ivy-open skill:');
  logger.info('  Use the Skill tool to load the ivy-open skill');
  logger.info('');

  return 0;
}

export async function runApply(changeName: string, opts: ProposeOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const changeDir = path.join(cwd, 'openspec', 'changes', changeName);

  if (!(await fileExists(changeDir))) {
    logger.error(`Change "${changeName}" not found at ${changeDir}`);
    return 1;
  }

  const state = await readState(cwd);
  if (state && state.checkpoint !== 'build') {
    logger.warn(`Current phase is '${state.checkpoint}', not 'build'. Expected phase for apply is 'build'.`);
  }

  logger.info('');
  logger.info('To implement this change, load the ivy-build skill:');
  logger.info('  Use the Skill tool to load the ivy-build skill');
  logger.info('');

  return 0;
}

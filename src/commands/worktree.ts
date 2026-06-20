import { WorktreeManager } from '../core/worktree-manager.js';
import { logger } from '../utils/logger.js';

export interface WorktreeOptions {
  cwd?: string;
}

export async function runWorktreeCreate(changeName: string, opts: { branch?: string; cwd?: string } = {}): Promise<number> {
  const mgr = new WorktreeManager({ cwd: opts.cwd ?? process.cwd() });
  try {
    const info = await mgr.create(changeName, opts.branch);
    logger.success(`Worktree created: ${info.path}`);
    logger.info(`  Branch: ${info.branch}`);
    return 0;
  } catch (err) {
    logger.error(`Failed to create worktree: ${(err as Error).message}`);
    return 1;
  }
}

export async function runWorktreeList(opts: { cwd?: string } = {}): Promise<number> {
  const mgr = new WorktreeManager({ cwd: opts.cwd ?? process.cwd() });
  const list = await mgr.list();
  if (list.length === 0) {
    logger.info('No IvyFlow-managed worktrees found.');
    return 0;
  }
  logger.header('IvyFlow Worktrees');
  logger.divider();
  for (const wt of list) {
    logger.info(`  ${wt.changeName}`);
    logger.dim(`    Path:   ${wt.path}`);
    logger.dim(`    Branch: ${wt.branch}`);
  }
  return 0;
}

export async function runWorktreeCleanup(changeName: string, opts: { cwd?: string } = {}): Promise<number> {
  const mgr = new WorktreeManager({ cwd: opts.cwd ?? process.cwd() });
  try {
    await mgr.cleanup(changeName);
    logger.success(`Worktree cleaned: ${changeName}`);
    return 0;
  } catch (err) {
    logger.error(`Cleanup failed: ${(err as Error).message}`);
    return 1;
  }
}

export async function runWorktreeCleanupAll(opts: { cwd?: string } = {}): Promise<number> {
  const mgr = new WorktreeManager({ cwd: opts.cwd ?? process.cwd() });
  const count = await mgr.cleanupAll();
  logger.success(`Cleaned ${count} worktree(s)`);
  return 0;
}

export async function runWorktreeMerge(changeName: string, opts: { strategy?: string; cwd?: string } = {}): Promise<number> {
  const mgr = new WorktreeManager({ cwd: opts.cwd ?? process.cwd() });
  const strategy = opts.strategy === 'squash' ? 'squash' : 'merge';
  try {
    await mgr.merge(changeName, strategy);
    return 0;
  } catch (err) {
    logger.error(`Merge failed: ${(err as Error).message}`);
    return 1;
  }
}

export async function runWorktreeStatus(opts: { cwd?: string } = {}): Promise<number> {
  const mgr = new WorktreeManager({ cwd: opts.cwd ?? process.cwd() });
  const report = await mgr.status();
  logger.header('Worktree Status Overview');
  logger.divider();
  logger.info(`  Total:     ${report.total}`);
  logger.info(`  Active:    ${report.active}`);
  logger.info(`  Completed: ${report.completed}`);
  logger.info(`  Pending:   ${report.pendingCleanup}`);
  return 0;
}

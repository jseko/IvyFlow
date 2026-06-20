import path from 'path';
import { logger } from '../utils/logger.js';
import { WorktreeManager } from './worktree-manager.js';
import { readState, type LifecycleCheckpoint } from './lifecycle-projection.js';

export interface ArchiveCleanupOptions {
  changeName: string;
  cwd: string;
  cleanupWorktree?: boolean;
  cleanupBranch?: boolean;
  keepLogs?: boolean;
}

export interface ArchiveCleanupResult {
  changeName: string;
  worktreeCleaned: boolean;
  branchCleaned: boolean;
  logsKept: boolean;
}

export async function archiveCleanup(options: ArchiveCleanupOptions): Promise<ArchiveCleanupResult> {
  const result: ArchiveCleanupResult = {
    changeName: options.changeName,
    worktreeCleaned: false,
    branchCleaned: false,
    logsKept: options.keepLogs ?? true,
  };

  if (options.cleanupWorktree) {
    try {
      const mgr = new WorktreeManager({ cwd: options.cwd });
      await mgr.cleanup(options.changeName);
      result.worktreeCleaned = true;
      logger.success(`Worktree cleaned for change: ${options.changeName}`);
    } catch (err) {
      logger.warn(`Worktree cleanup skipped: ${(err as Error).message}`);
    }
  }

  return result;
}

export async function onPhaseArchive(cwd: string, changeName: string): Promise<void> {
  const state = await readState(cwd);
  if (!state) return;

  if (state.checkpoint === 'archive') {
    logger.step('Archive phase detected — checking worktree...');
    const mgr = new WorktreeManager({ cwd });
    const wts = await mgr.list();
    const target = wts.find((w) => w.changeName === changeName);
    if (target) {
      logger.info(`  Worktree found at: ${target.path}`);
      logger.info('  Run `ivy worktree cleanup <name>` to clean up,');
      logger.info('  or archive with `--cleanup-worktree` flag.');
    } else {
      logger.info('  No worktree to clean up.');
    }
  }
}

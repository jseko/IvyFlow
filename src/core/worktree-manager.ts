import { execSync } from 'child_process';
import path from 'path';
import { logger } from '../utils/logger.js';

export interface WorktreeInfo {
  path: string;
  branch: string;
  changeName: string;
}

export interface WorktreeStatusReport {
  total: number;
  active: number;
  completed: number;
  pendingCleanup: number;
  worktrees: WorktreeInfo[];
}

export interface WorktreeManagerOptions {
  cwd: string;
}

export class WorktreeManager {
  private cwd: string;

  constructor(opts: WorktreeManagerOptions) {
    this.cwd = opts.cwd;
  }

  async create(changeName: string, baseBranch?: string): Promise<WorktreeInfo> {
    const projectName = path.basename(this.cwd);
    const wtPath = path.resolve(this.cwd, '..', '.zcf', projectName, changeName);
    const branch = baseBranch ?? `ivyflow-wt-${changeName}`;

    execSync(`git worktree add -b "${branch}" "${wtPath}" "${baseBranch ?? 'main'}"`, {
      cwd: this.cwd,
      stdio: 'pipe',
    });

    logger.success(`Worktree created: ${wtPath} (branch: ${branch})`);
    return { path: wtPath, branch, changeName };
  }

  async list(): Promise<WorktreeInfo[]> {
    const output = execSync('git worktree list', { cwd: this.cwd, encoding: 'utf-8' });
    const lines = output.trim().split('\n');
    const projectName = path.basename(this.cwd);
    const zcfPrefix = path.resolve(this.cwd, '..', '.zcf', projectName) + path.sep;

    return lines
      .filter((line) => line.includes(zcfPrefix))
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        const wtPath = parts[0];
        const branch = parts.find((p) => p.startsWith('['))?.replace(/^\[|\]$/g, '') ?? '';
        const changeName = path.basename(wtPath);
        return { path: wtPath, branch, changeName };
      });
  }

  async cleanup(changeName: string): Promise<void> {
    const wts = await this.list();
    const target = wts.find((w) => w.changeName === changeName);
    if (!target) {
      logger.warn(`No worktree found for change: ${changeName}`);
      return;
    }
    execSync(`git worktree remove "${target.path}"`, { cwd: this.cwd, stdio: 'pipe' });
    if (target.branch && !/^[0-9a-f]{7,40}$/.test(target.branch)) {
      execSync(`git branch -D "${target.branch}"`, { cwd: this.cwd, stdio: 'pipe' });
    }
    logger.success(`Worktree cleaned up: ${changeName}`);
  }

  async cleanupAll(): Promise<number> {
    const wts = await this.list();
    for (const wt of wts) {
      await this.cleanup(wt.changeName);
    }
    return wts.length;
  }

  async status(): Promise<WorktreeStatusReport> {
    const wts = await this.list();
    const total = wts.length;
    return { total, active: total, completed: 0, pendingCleanup: 0, worktrees: wts };
  }

  async merge(changeName: string, strategy: 'merge' | 'squash' = 'merge'): Promise<void> {
    const wts = await this.list();
    const target = wts.find((w) => w.changeName === changeName);
    if (!target) {
      throw new Error(`No worktree found for change: ${changeName}`);
    }

    execSync('git checkout main', { cwd: this.cwd, stdio: 'pipe' });
    execSync('git pull', { cwd: this.cwd, stdio: 'pipe' });

    if (strategy === 'squash') {
      execSync(`git merge --squash "${target.branch}"`, { cwd: this.cwd, stdio: 'pipe' });
      execSync('git commit --allow-empty -m "feat: merge worktree changes"', {
        cwd: this.cwd,
        stdio: 'pipe',
      });
    } else {
      execSync(`git merge "${target.branch}" --no-ff`, { cwd: this.cwd, stdio: 'pipe' });
    }

    logger.success(`Worktree merged (${strategy}): ${changeName}`);
  }
}

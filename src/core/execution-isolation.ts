/**
 * Execution Isolation — v0.13 git worktree isolation provider.
 *
 * Creates isolated git worktrees for safe parallel agent execution.
 * Internal mechanism — not a product feature.
 *
 * Design constraints (design.md D6):
 *   - v0.13 implements git-worktree only
 *   - Docker/DevContainer interfaces reserved for v0.14+
 *   - Graceful fallback to provider: none on failure
 */

import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const activeWorktrees: string[] = [];

// Auto-cleanup on process exit
process.on('exit', () => {
  for (const wt of activeWorktrees) {
    try {
      exec(`git worktree remove --force "${wt}"`, { timeout: 5000 });
    } catch {
      // Silently ignore cleanup failures during shutdown
    }
  }
});

// ─── Types ───

export type IsolationProvider = 'git-worktree' | 'docker' | 'dev-container' | 'none';

export interface IsolationConfig {
  provider: IsolationProvider;
  excludePaths: string[];
  maxInstances: number;
}

/**
 * Provider interface for future implementations (v0.14+).
 */
export interface IsolationProviderInterface {
  name: string;
  create(config: IsolationConfig, worktreeDir: string, branchName: string): Promise<string>;
  destroy(id: string): Promise<void>;
  list(): Promise<string[]>;
}

// ─── Default config ───

export const DEFAULT_ISOLATION_CONFIG: IsolationConfig = {
  provider: 'git-worktree',
  excludePaths: ['node_modules', 'dist', 'target', '.git'],
  maxInstances: 5,
};

// ─── Git worktree provider ───

/**
 * Create a git worktree for isolated execution.
 * Falls back to 'none' on failure with a warning message.
 */
export async function createWorktree(
  repoRoot: string,
  changeName: string,
  config: IsolationConfig = DEFAULT_ISOLATION_CONFIG,
): Promise<{ worktreeDir: string; provider: IsolationProvider }> {
  if (config.provider === 'none') {
    return { worktreeDir: repoRoot, provider: 'none' };
  }

  const sanitized = changeName.replace(/[^a-zA-Z0-9-]/g, '-');
  const worktreeDir = path.join(repoRoot, '.worktrees', sanitized);
  const branchName = `workflow/${sanitized}`;

  try {
    await execPromise(`git worktree add "${worktreeDir}" -b "${branchName}"`, { cwd: repoRoot });

    // Create symlinks for excluded directories
    for (const excludePath of config.excludePaths) {
      const srcPath = path.join(repoRoot, excludePath);
      const destPath = path.join(worktreeDir, excludePath);
      try {
        await fs.access(srcPath);
        // Remove the empty dir that git worktree created, symlink to original
        await fs.rm(destPath, { recursive: true, force: true });
        await fs.symlink(srcPath, destPath, 'dir');
      } catch {
        // Source path doesn't exist, skip
      }
    }

    activeWorktrees.push(worktreeDir);
    return { worktreeDir, provider: 'git-worktree' };
  } catch (err) {
    // Fallback — return repo root with warning
    return { worktreeDir: repoRoot, provider: 'none' };
  }
}

/**
 * Remove a git worktree.
 */
export async function destroyWorktree(worktreeDir: string): Promise<void> {
  try {
    await execPromise(`git worktree remove "${worktreeDir}"`);
  } catch {
    // If removal fails (dirty worktree), try force
    try {
      await execPromise(`git worktree remove --force "${worktreeDir}"`);
    } catch {
      // Silently ignore — worktree may already be gone
    }
  }
}

/**
 * List all IvyFlow-managed worktrees.
 */
export async function listWorktrees(repoRoot: string): Promise<string[]> {
  try {
    const stdout = await execPromise('git worktree list', { cwd: repoRoot });
    return stdout
      .split('\n')
      .filter((line) => line.includes('.worktrees/'))
      .map((line) => line.split(/\s+/)[0]);
  } catch {
    return [];
  }
}

// ─── Helper ───

function execPromise(cmd: string, opts?: { cwd?: string }): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { ...opts, timeout: 30000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

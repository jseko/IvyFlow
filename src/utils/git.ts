import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface GitResult {
  stdout: string;
  stderr: string;
}

/**
 * Run `git <args>` in the given cwd and return stdout/stderr.
 * Throws if git is not installed or the command fails.
 */
export async function runGit(args: string[], cwd: string): Promise<GitResult> {
  const { stdout, stderr } = await execFileAsync('git', args, { cwd });
  return { stdout: stdout.toString(), stderr: stderr.toString() };
}

/**
 * Check whether `cwd` is inside a git working tree.
 */
export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    const { stdout } = await runGit(['rev-parse', '--is-inside-work-tree'], cwd);
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

/**
 * Resolve the absolute path to the .git directory (handles worktrees).
 */
export async function resolveGitDir(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await runGit(['rev-parse', '--absolute-git-dir'], cwd);
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Get current HEAD commit SHA, or null if not in a repo / no commits yet.
 */
export async function getHeadCommit(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await runGit(['rev-parse', 'HEAD'], cwd);
    return stdout.trim();
  } catch {
    return null;
  }
}

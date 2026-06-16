import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { execFileSync } from 'child_process';

import { installGitPrePushHook } from './git-hook.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-githook-'));
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' });
}

function runHookOnBranch(repoRoot: string): { exit: number; stderr: string } {
  const hookPath = path.join(repoRoot, '.git', 'hooks', 'pre-push');
  try {
    const stdout = execFileSync('bash', [hookPath], {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { exit: 0, stderr: stdout };
  } catch (err: unknown) {
    const e = err as { status?: number; stderr?: Buffer | string };
    const stderr = typeof e.stderr === 'string' ? e.stderr : (e.stderr?.toString() ?? '');
    return { exit: e.status ?? 1, stderr };
  }
}

describe('installGitPrePushHook', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns no-git when target dir is not a git repo', async () => {
    const result = await installGitPrePushHook(tmp, true);
    expect(result).toEqual({ installed: false, reason: 'no-git' });
  });

  it('installs executable pre-push hook in a git repo', async () => {
    git(tmp, 'init', '-q');
    const result = await installGitPrePushHook(tmp, true);
    expect(result.installed).toBe(true);
    if (!result.installed) return;

    const stat = await fs.stat(result.path);
    expect(stat.isFile()).toBe(true);
    // Owner-execute bit must be set (0o100 within mode).
    expect(stat.mode & 0o100).toBe(0o100);
  });

  it('skipped-existing when overwrite=false and hook already present', async () => {
    git(tmp, 'init', '-q');
    await installGitPrePushHook(tmp, true);
    const second = await installGitPrePushHook(tmp, false);
    expect(second.installed).toBe(false);
    if (!second.installed) {
      expect(second.reason).toBe('skipped-existing');
    }
  });

  it('hook blocks push when phase != archive on ivy/<change> branch', async () => {
    git(tmp, 'init', '-q');
    git(tmp, 'config', 'user.email', 't@e.com');
    git(tmp, 'config', 'user.name', 'T');
    git(tmp, 'commit', '--allow-empty', '-q', '-m', 'init');
    git(tmp, 'checkout', '-qb', 'ivy/sample');

    await fs.mkdir(path.join(tmp, 'openspec', 'changes', 'sample'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'openspec', 'changes', 'sample', '.ivy.yaml'),
      'phase: build\n',
      'utf-8',
    );

    await installGitPrePushHook(tmp, true);
    const built = runHookOnBranch(tmp);
    expect(built.exit).toBe(1);
    expect(built.stderr).toContain("change 'sample'");
    expect(built.stderr).toContain("'build' phase");
  });

  it('hook allows push when phase = archive', async () => {
    git(tmp, 'init', '-q');
    git(tmp, 'config', 'user.email', 't@e.com');
    git(tmp, 'config', 'user.name', 'T');
    git(tmp, 'commit', '--allow-empty', '-q', '-m', 'init');
    git(tmp, 'checkout', '-qb', 'ivy/done');

    await fs.mkdir(path.join(tmp, 'openspec', 'changes', 'done'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'openspec', 'changes', 'done', '.ivy.yaml'),
      'phase: archive\n',
      'utf-8',
    );

    await installGitPrePushHook(tmp, true);
    expect(runHookOnBranch(tmp).exit).toBe(0);
  });

  it('hook is no-op on non-ivy branches even with bad yaml', async () => {
    git(tmp, 'init', '-q');
    git(tmp, 'config', 'user.email', 't@e.com');
    git(tmp, 'config', 'user.name', 'T');
    git(tmp, 'commit', '--allow-empty', '-q', '-m', 'init');
    git(tmp, 'checkout', '-qb', 'feature/unrelated');

    await installGitPrePushHook(tmp, true);
    expect(runHookOnBranch(tmp).exit).toBe(0);
  });

  it('hook is no-op on ivy/ branch when yaml is missing', async () => {
    git(tmp, 'init', '-q');
    git(tmp, 'config', 'user.email', 't@e.com');
    git(tmp, 'config', 'user.name', 'T');
    git(tmp, 'commit', '--allow-empty', '-q', '-m', 'init');
    git(tmp, 'checkout', '-qb', 'ivy/no-yaml');

    await installGitPrePushHook(tmp, true);
    expect(runHookOnBranch(tmp).exit).toBe(0);
  });
});

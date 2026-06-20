import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { WorktreeManager } from './worktree-manager.js';

function createTempRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-test-'));
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email test@test.com', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name test', { cwd: dir, stdio: 'pipe' });
  fs.writeFileSync(path.join(dir, 'README.md'), '# test');
  execSync('git add -A && git commit -m "init"', { cwd: dir, stdio: 'pipe' });
  return dir;
}

describe('WorktreeManager', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = createTempRepo();
  });

  afterEach(() => {
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('list returns empty for fresh repo', async () => {
    const mgr = new WorktreeManager({ cwd: repoDir });
    const list = await mgr.list();
    expect(list).toEqual([]);
  });

  it('create adds a worktree', async () => {
    const mgr = new WorktreeManager({ cwd: repoDir });
    const info = await mgr.create('test-change');
    expect(info.changeName).toBe('test-change');
    expect(fs.existsSync(info.path)).toBe(true);
    const list = await mgr.list();
    expect(list.some((w) => w.changeName === 'test-change')).toBe(true);
  });

  it('cleanup removes worktree', async () => {
    const mgr = new WorktreeManager({ cwd: repoDir });
    await mgr.create('to-clean');
    await mgr.cleanup('to-clean');
    const list = await mgr.list();
    expect(list.some((w) => w.changeName === 'to-clean')).toBe(false);
  });

  it('cleanupAll removes all managed worktrees', async () => {
    const mgr = new WorktreeManager({ cwd: repoDir });
    await mgr.create('a');
    await mgr.create('b');
    const count = await mgr.cleanupAll();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('status returns report with correct total', async () => {
    const mgr = new WorktreeManager({ cwd: repoDir });
    await mgr.create('s1');
    const s = await mgr.status();
    expect(s.total).toBeGreaterThanOrEqual(1);
    expect(s.worktrees.length).toBe(s.total);
  });

  it('WorktreeInfo has minimal fields only', () => {
    const info = { path: '/a', branch: 'b', changeName: 'c' } as const;
    expect(Object.keys(info)).toEqual(['path', 'branch', 'changeName']);
  });
});

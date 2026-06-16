import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { execFileSync } from 'child_process';

import { runGit, isGitRepo, resolveGitDir, getHeadCommit } from './git.js';

async function mkTmpRepo(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-git-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: dir });
  return dir;
}

describe('git utils', () => {
  describe('isGitRepo', () => {
    it('returns false outside a repo', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-non-git-'));
      try {
        expect(await isGitRepo(dir)).toBe(false);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    it('returns true inside a repo', async () => {
      const dir = await mkTmpRepo();
      try {
        expect(await isGitRepo(dir)).toBe(true);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });

  describe('runGit', () => {
    let dir: string;
    beforeEach(async () => {
      dir = await mkTmpRepo();
    });
    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    it('returns stdout for a valid command', async () => {
      const result = await runGit(['rev-parse', '--is-inside-work-tree'], dir);
      expect(result.stdout.trim()).toBe('true');
    });

    it('throws on a failing command', async () => {
      await expect(runGit(['rev-parse', 'nonexistent-ref'], dir)).rejects.toThrow();
    });
  });

  describe('resolveGitDir', () => {
    it('returns absolute .git path inside a repo', async () => {
      const dir = await mkTmpRepo();
      try {
        const gitDir = await resolveGitDir(dir);
        expect(gitDir).not.toBeNull();
        expect(path.isAbsolute(gitDir!)).toBe(true);
        expect(gitDir!.endsWith('.git')).toBe(true);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    it('returns null outside a repo', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-non-git-'));
      try {
        expect(await resolveGitDir(dir)).toBeNull();
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });

  describe('getHeadCommit', () => {
    it('returns null for a fresh repo with no commits', async () => {
      const dir = await mkTmpRepo();
      try {
        expect(await getHeadCommit(dir)).toBeNull();
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    it('returns SHA after a commit', async () => {
      const dir = await mkTmpRepo();
      try {
        await fs.writeFile(path.join(dir, 'a.txt'), 'hi\n');
        execFileSync('git', ['add', 'a.txt'], { cwd: dir });
        execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir });
        const sha = await getHeadCommit(dir);
        expect(sha).toMatch(/^[0-9a-f]{40}$/);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    it('returns null outside a repo', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-non-git-'));
      try {
        expect(await getHeadCommit(dir)).toBeNull();
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });
});

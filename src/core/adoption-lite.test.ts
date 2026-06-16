import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { execFileSync } from 'child_process';

import { parseShortstat, snapshotAdoption } from './adoption-lite.js';
import { readYaml } from '../utils/yaml.js';

async function mkTmpRepo(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-adopt-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: dir });
  return dir;
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' });
}

async function commitFile(cwd: string, relPath: string, body: string, msg: string): Promise<string> {
  const full = path.join(cwd, relPath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, body);
  git(cwd, 'add', relPath);
  git(cwd, 'commit', '-q', '-m', msg);
  return git(cwd, 'rev-parse', 'HEAD').trim();
}

async function writeChangeYaml(cwd: string, changeName: string, body: string): Promise<string> {
  const dir = path.join(cwd, 'openspec', 'changes', changeName);
  await fs.mkdir(dir, { recursive: true });
  const yamlPath = path.join(dir, '.ivy.yaml');
  await fs.writeFile(yamlPath, body);
  return yamlPath;
}

describe('parseShortstat', () => {
  it('parses standard insertions + deletions', () => {
    expect(parseShortstat(' 5 files changed, 420 insertions(+), 30 deletions(-)')).toEqual({
      added: 420,
      removed: 30,
    });
  });

  it('handles insertions-only', () => {
    expect(parseShortstat(' 1 file changed, 10 insertions(+)')).toEqual({ added: 10, removed: 0 });
  });

  it('handles deletions-only', () => {
    expect(parseShortstat(' 1 file changed, 7 deletions(-)')).toEqual({ added: 0, removed: 7 });
  });

  it('returns zeros for empty diff', () => {
    expect(parseShortstat('')).toEqual({ added: 0, removed: 0 });
  });

  it('handles singular forms (1 insertion, 1 deletion)', () => {
    expect(parseShortstat(' 1 file changed, 1 insertion(+), 1 deletion(-)')).toEqual({
      added: 1,
      removed: 1,
    });
  });
});

describe('snapshotAdoption', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpRepo();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('produces a snapshot in archive phase and persists under adoption key', async () => {
    const baseCommit = await commitFile(tmp, 'a.txt', 'one\ntwo\nthree\n', 'base');
    await commitFile(tmp, 'b.txt', 'alpha\nbeta\ngamma\ndelta\n', 'add b');

    await writeChangeYaml(
      tmp,
      'add-x',
      [
        'phase: archive',
        `base_commit: ${baseCommit}`,
        'phase_updated_at: 2026-06-16T10:00:00Z',
        '',
      ].join('\n'),
    );

    const snap = await snapshotAdoption('add-x', { cwd: tmp });
    expect(snap.change_name).toBe('add-x');
    expect(snap.base_commit).toBe(baseCommit);
    expect(snap.confidence).toBe('low');
    expect(snap.source).toBe('commit-diff');
    expect(snap.lines_added).toBe(4);
    expect(snap.lines_removed).toBe(0);
    expect(snap.estimated_ai_lines).toBe(4);

    // Persistence preserves other keys.
    const reloaded = await readYaml<{
      phase?: string;
      phase_updated_at?: string;
      base_commit?: string;
      adoption?: { lines_added?: number };
    }>(path.join(tmp, 'openspec', 'changes', 'add-x', '.ivy.yaml'));
    expect(reloaded?.phase).toBe('archive');
    expect(reloaded?.phase_updated_at).toBe('2026-06-16T10:00:00Z');
    expect(reloaded?.base_commit).toBe(baseCommit);
    expect(reloaded?.adoption?.lines_added).toBe(4);
  });

  it('returns zeros when base==HEAD (empty diff)', async () => {
    const baseCommit = await commitFile(tmp, 'a.txt', 'x\n', 'base');
    await writeChangeYaml(
      tmp,
      'noop',
      `phase: archive\nbase_commit: ${baseCommit}\n`,
    );

    const snap = await snapshotAdoption('noop', { cwd: tmp });
    expect(snap.lines_added).toBe(0);
    expect(snap.lines_removed).toBe(0);
  });

  it('throws when phase is not terminal', async () => {
    const baseCommit = await commitFile(tmp, 'a.txt', 'x\n', 'base');
    await writeChangeYaml(
      tmp,
      'wip',
      `phase: build\nbase_commit: ${baseCommit}\n`,
    );

    await expect(snapshotAdoption('wip', { cwd: tmp })).rejects.toThrow(
      /terminal phase/,
    );
  });

  it('throws when phase is unknown', async () => {
    const baseCommit = await commitFile(tmp, 'a.txt', 'x\n', 'base');
    await writeChangeYaml(
      tmp,
      'bogus',
      `phase: implementing\nbase_commit: ${baseCommit}\n`,
    );

    await expect(snapshotAdoption('bogus', { cwd: tmp })).rejects.toThrow();
  });

  it('throws when base_commit is missing', async () => {
    await commitFile(tmp, 'a.txt', 'x\n', 'base');
    await writeChangeYaml(tmp, 'no-base', 'phase: archive\n');
    await expect(snapshotAdoption('no-base', { cwd: tmp })).rejects.toThrow(/base_commit/);
  });

  it('throws when change yaml is missing', async () => {
    await expect(snapshotAdoption('ghost', { cwd: tmp })).rejects.toThrow(
      /no .ivy.yaml/,
    );
  });
});

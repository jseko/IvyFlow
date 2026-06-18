import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import { execSync } from 'child_process';

import { runArchiveEngine, isChangeArchivable, listArchivableChanges } from './archive-engine.js';

describe('runArchiveEngine', () => {
  let tmpDir: string;
  let ivyDir: string;
  let openspecDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-ae-'));
    ivyDir = path.join(tmpDir, '.ivy');
    openspecDir = path.join(tmpDir, 'openspec');
    await fs.mkdir(path.join(ivyDir), { recursive: true });
    await fs.mkdir(path.join(openspecDir, 'changes', 'my-change'), { recursive: true });

    // Git repo for stats
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email test@test.com', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name Tester', { cwd: tmpDir, stdio: 'pipe' });
    await fs.writeFile(path.join(tmpDir, 'test.txt'), 'hello');
    execSync('git add -A && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('transitions VERIFY → archive on valid input', async () => {
    const projectYaml = {
      version: '0.9',
      changes: [{ name: 'my-change', phase: 'verify' }],
    };
    await fs.writeFile(path.join(ivyDir, 'project.yaml'), JSON.stringify(projectYaml));

    const result = await runArchiveEngine({
      changeName: 'my-change',
      openspecDir,
      ivyDir,
    });

    expect(result.oldPhase).toBe('verify');
    expect(result.newPhase).toBe('archive');
    expect(result.reportPath).toContain('archive');
    expect(result.summary).toContain('Archived');
  });

  it('throws when change directory is missing', async () => {
    await expect(runArchiveEngine({
      changeName: 'nonexistent',
      openspecDir,
      ivyDir,
    })).rejects.toThrow('not found');
  });

  it('throws when not in VERIFY phase without --force', async () => {
    await fs.writeFile(path.join(ivyDir, 'project.yaml'), JSON.stringify({
      version: '0.9',
      changes: [{ name: 'my-change', phase: 'build' }],
    }));

    await expect(runArchiveEngine({
      changeName: 'my-change',
      openspecDir,
      ivyDir,
    })).rejects.toThrow('Only VERIFY→ARCHIVE');
  });

  it('--force overrides phase check', async () => {
    await fs.writeFile(path.join(ivyDir, 'project.yaml'), JSON.stringify({
      changes: [{ name: 'my-change', phase: 'open' }],
    }));

    const result = await runArchiveEngine({
      changeName: 'my-change',
      openspecDir,
      ivyDir,
      force: true,
    });
    expect(result.newPhase).toBe('archive');
  });

  it('moves change directory from changes/ to archive/', async () => {
    await fs.writeFile(path.join(ivyDir, 'project.yaml'), JSON.stringify({
      changes: [{ name: 'my-change', phase: 'verify' }],
    }));

    await runArchiveEngine({ changeName: 'my-change', openspecDir, ivyDir });

    const archiveExists = await fs.stat(path.join(openspecDir, 'archive', 'my-change')).then(() => true, () => false);
    const changesExists = await fs.stat(path.join(openspecDir, 'changes', 'my-change')).then(() => true, () => false);
    expect(archiveExists).toBe(true);
    expect(changesExists).toBe(false);
  });
});

describe('isChangeArchivable', () => {
  let tmpDir: string;
  let ivyDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-arch-'));
    ivyDir = path.join(tmpDir, '.ivy');
    await fs.mkdir(ivyDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns archivable for VERIFY phase', async () => {
    await fs.writeFile(path.join(ivyDir, 'project.yaml'), JSON.stringify({
      changes: [{ name: 'c1', phase: 'verify' }],
    }));
    const r = await isChangeArchivable(ivyDir, 'c1');
    expect(r.archivable).toBe(true);
    expect(r.phase).toBe('verify');
  });

  it('returns not archivable for non-VERIFY phase', async () => {
    await fs.writeFile(path.join(ivyDir, 'project.yaml'), JSON.stringify({
      changes: [{ name: 'c1', phase: 'build' }],
    }));
    const r = await isChangeArchivable(ivyDir, 'c1');
    expect(r.archivable).toBe(false);
  });

  it('returns not found when change missing', async () => {
    await fs.writeFile(path.join(ivyDir, 'project.yaml'), JSON.stringify({ changes: [] }));
    const r = await isChangeArchivable(ivyDir, 'c1');
    expect(r.archivable).toBe(false);
    expect(r.reason).toContain('not found');
  });
});

describe('listArchivableChanges', () => {
  let tmpDir: string;
  let ivyDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-lac-'));
    ivyDir = path.join(tmpDir, '.ivy');
    await fs.mkdir(ivyDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns only VERIFY-phase changes', async () => {
    await fs.writeFile(path.join(ivyDir, 'project.yaml'), JSON.stringify({
      changes: [
        { name: 'c1', phase: 'verify' },
        { name: 'c2', phase: 'build' },
        { name: 'c3', phase: 'verify' },
      ],
    }));
    const list = await listArchivableChanges(ivyDir);
    expect(list).toHaveLength(2);
    expect(list.map((c) => c.name)).toEqual(['c1', 'c3']);
  });

  it('returns empty array for no changes', async () => {
    await fs.writeFile(path.join(ivyDir, 'project.yaml'), JSON.stringify({}));
    const list = await listArchivableChanges(ivyDir);
    expect(list).toEqual([]);
  });
});

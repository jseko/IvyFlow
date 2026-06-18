import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';

import { runRelease } from './release.js';

describe('runRelease', () => {
  let tmp: string;
  let ivyDir: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-release-'));
    ivyDir = path.join(tmp, '.ivy');
    await fs.mkdir(ivyDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('requires --change argument', async () => {
    const code = await runRelease({ cwd: tmp });
    expect(code).toBe(1);
  });

  it('rejects non-archive phase change', async () => {
    await fs.writeFile(path.join(ivyDir, 'project.yaml'), JSON.stringify({
      changes: [{ name: 'my-feat', phase: 'build' }],
    }));

    const code = await runRelease({ cwd: tmp, change: 'my-feat' });
    expect(code).toBe(1);
  });

  it('accepts archive phase change', async () => {
    await fs.writeFile(path.join(ivyDir, 'project.yaml'), JSON.stringify({
      changes: [{ name: 'my-feat', phase: 'archive' }],
    }));

    const code = await runRelease({ cwd: tmp, change: 'my-feat' });
    expect(code).toBe(0);
  });

  it('creates release directory and manifest', async () => {
    await fs.writeFile(path.join(ivyDir, 'project.yaml'), JSON.stringify({
      changes: [{ name: 'my-feat', phase: 'archive' }],
    }));

    // Create some artifact directories (may be empty)
    await fs.mkdir(path.join(ivyDir, 'archive'), { recursive: true });
    await fs.mkdir(path.join(ivyDir, 'knowledge'), { recursive: true });
    await fs.mkdir(path.join(ivyDir, 'evidence'), { recursive: true });

    const code = await runRelease({ cwd: tmp, change: 'my-feat' });
    expect(code).toBe(0);

    // Check release dir exists
    const releaseDir = path.join(ivyDir, 'releases', 'my-feat');
    const dirExists = await fs.stat(releaseDir).then(() => true, () => false);
    expect(dirExists).toBe(true);

    // Check manifest
    const manifestRaw = await fs.readFile(path.join(releaseDir, 'release.yaml'), 'utf-8');
    expect(manifestRaw).toContain('changeName: my-feat');
    expect(manifestRaw).toContain('phase: archive');
  });

  it('writes release.yaml manifest with correct structure', async () => {
    await fs.writeFile(path.join(ivyDir, 'project.yaml'), JSON.stringify({
      changes: [{ name: 'my-feat', phase: 'archive' }],
    }));

    await runRelease({ cwd: tmp, change: 'my-feat' });

    const manifestRaw = await fs.readFile(
      path.join(ivyDir, 'releases', 'my-feat', 'release.yaml'), 'utf-8',
    );
    expect(manifestRaw).toContain('releaseDate:');
    expect(manifestRaw).toContain('artifacts:');
  });

  it('rejects change not found in project.yaml', async () => {
    await fs.writeFile(path.join(ivyDir, 'project.yaml'), JSON.stringify({
      changes: [],
    }));

    const code = await runRelease({ cwd: tmp, change: 'ghost' });
    expect(code).toBe(1);
  });

  it('handles missing artifacts gracefully (skip)', async () => {
    await fs.writeFile(path.join(ivyDir, 'project.yaml'), JSON.stringify({
      changes: [{ name: 'empty-change', phase: 'archive' }],
    }));

    const code = await runRelease({ cwd: tmp, change: 'empty-change' });
    expect(code).toBe(0);

    const releaseDir = path.join(ivyDir, 'releases', 'empty-change');
    const files = await fs.readdir(releaseDir);
    expect(files).toContain('release.yaml');
  });
});

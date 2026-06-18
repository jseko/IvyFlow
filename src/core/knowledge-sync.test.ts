import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { mkdirSync, rmSync } from 'fs';
import { promises as fs } from 'fs';

import { syncReference, syncReferencesForProject } from './knowledge-sync.js';

const MANAGED_MARKER = '<!-- ivy:managed -->';

describe('Knowledge Sync — TC-19: Create new KB file', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `ivy-ks-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    mkdirSync(tmpDir, { recursive: true });
  });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('creates a new file with managed marker', async () => {
    const filePath = path.join(tmpDir, 'CLAUDE.md');
    const result = await syncReference({ filePath });

    expect(result.action).toBe('created');
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toContain(MANAGED_MARKER);
    expect(content).toContain('IvyFlow managed');
  });
});

describe('Knowledge Sync — TC-20: Skip existing managed file', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `ivy-ks-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    mkdirSync(tmpDir, { recursive: true });
  });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('skips file that already has managed marker', async () => {
    const filePath = path.join(tmpDir, 'CURSOR.md');
    await fs.writeFile(filePath, `${MANAGED_MARKER}\n\nExisting content\n`, 'utf-8');

    const result = await syncReference({ filePath });
    expect(result.action).toBe('skipped');
  });

  it('appends marker to file without managed marker', async () => {
    const filePath = path.join(tmpDir, 'WINDSURF.md');
    await fs.writeFile(filePath, 'User content here\n', 'utf-8');

    const result = await syncReference({ filePath });
    expect(result.action).toBe('synced');

    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toContain(MANAGED_MARKER);
    expect(content).toContain('User content here');
  });
});

describe('Knowledge Sync — TC-21: Multi-platform sync', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `ivy-ks-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    mkdirSync(tmpDir, { recursive: true });
  });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('syncs references for multiple platforms', async () => {
    const results = await syncReferencesForProject(tmpDir, ['claude', 'cursor']);
    expect(results.length).toBe(2);

    const claudeResult = results.find((r) => r.filePath.endsWith('CLAUDE.md'));
    const cursorResult = results.find((r) => r.filePath.endsWith('CURSOR.md'));
    expect(claudeResult).toBeDefined();
    expect(cursorResult).toBeDefined();
    expect(claudeResult!.action).toBe('created');
    expect(cursorResult!.action).toBe('created');
  });

  it('deduplicates when same file maps to multiple platforms', async () => {
    const results = await syncReferencesForProject(tmpDir, ['claude', 'cursor', 'claude']);
    expect(results.length).toBe(2); // CLAUDE.md and CURSOR.md, no duplicates
  });
});

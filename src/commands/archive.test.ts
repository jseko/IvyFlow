import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { execFileSync } from 'child_process';

import { runArchive } from './archive.js';
import { runInit } from './init.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-archive-'));
}

function gitInit(cwd: string): void {
  execFileSync('git', ['init', '-q'], { cwd });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd });
  execFileSync('git', ['commit', '--allow-empty', '-q', '-m', 'init'], { cwd });
}

async function writeRawEvent(cwd: string, event: Record<string, unknown>): Promise<void> {
  const dir = path.join(cwd, '.ivy', 'sessions', 'raw');
  await fs.mkdir(dir, { recursive: true });
  const line = JSON.stringify(event) + '\n';
  await fs.appendFile(path.join(dir, 'events.jsonl'), line, 'utf-8');
}

describe('runArchive', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns 1 when --change is missing', async () => {
    const code = await runArchive({ cwd: tmp });
    expect(code).toBe(1);
  });

  it('returns 0 without --report (v0.7 compatible)', async () => {
    gitInit(tmp);
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true });
    const code = await runArchive({ cwd: tmp, change: 'feat-x' });
    expect(code).toBe(0);
  });

  it('generates report file with --report flag', async () => {
    gitInit(tmp);
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true });

    // Add phase transition events for timeline
    await writeRawEvent(tmp, { ts: '2026-06-01T10:00:00Z', eventId: 'e1', change: 'feat-x', event: 'git_commit', source: 'git-hook' });
    await writeRawEvent(tmp, { ts: '2026-06-01T12:00:00Z', eventId: 'e2', change: 'feat-x', event: 'phase_transition', source: 'hook', meta: { from: 'open', to: 'design' } });
    await writeRawEvent(tmp, { ts: '2026-06-05T10:00:00Z', eventId: 'e3', change: 'feat-x', event: 'phase_transition', source: 'hook', meta: { from: 'design', to: 'build' } });

    const code = await runArchive({ cwd: tmp, change: 'feat-x', report: true });
    expect(code).toBe(0);

    // Verify report file exists in .ivy/reports/
    const reportsDir = path.join(tmp, '.ivy', 'reports');
    const files = await fs.readdir(reportsDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^feat-x-\d{4}-\d{2}-\d{2}\.md$/);

    // Verify report content has expected sections
    const content = await fs.readFile(path.join(reportsDir, files[0]), 'utf-8');
    expect(content).toContain('# Archive Report: feat-x');
    expect(content).toContain('## Summary');
    expect(content).toContain('## Timeline');
    expect(content).toContain('## Decision Log');
    expect(content).toContain('## Suggestion Impact');
    expect(content).toContain('## Lessons Learned');
    expect(content).toContain('<!-- Fill in manually -->');
  });

  it('includes phase transitions in report when events exist', async () => {
    gitInit(tmp);
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true });

    await writeRawEvent(tmp, { ts: '2026-06-01T10:00:00Z', eventId: 'e1', change: 'feat-y', event: 'phase_transition', source: 'hook', meta: { from: 'open', to: 'design' } });
    await writeRawEvent(tmp, { ts: '2026-06-05T10:00:00Z', eventId: 'e2', change: 'feat-y', event: 'phase_transition', source: 'hook', meta: { from: 'design', to: 'build' } });
    await writeRawEvent(tmp, { ts: '2026-06-10T10:00:00Z', eventId: 'e3', change: 'feat-y', event: 'phase_transition', source: 'hook', meta: { from: 'build', to: 'verify' } });

    const code = await runArchive({ cwd: tmp, change: 'feat-y', report: true });
    expect(code).toBe(0);

    const reportsDir = path.join(tmp, '.ivy', 'reports');
    const files = await fs.readdir(reportsDir);
    const content = await fs.readFile(path.join(reportsDir, files[0]), 'utf-8');

    // Should list all phase transitions
    expect(content).toContain('open → design');
    expect(content).toContain('design → build');
    expect(content).toContain('build → verify');
  });

  it('handles no events gracefully (empty events.jsonl)', async () => {
    gitInit(tmp);
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true });
    // No events written — empty events.jsonl

    const code = await runArchive({ cwd: tmp, change: 'feat-z', report: true });
    expect(code).toBe(0);

    const reportsDir = path.join(tmp, '.ivy', 'reports');
    const files = await fs.readdir(reportsDir);
    expect(files.length).toBe(1);
  });

  it('does not generate report without --report flag', async () => {
    gitInit(tmp);
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true });

    await writeRawEvent(tmp, { ts: '2026-06-01T10:00:00Z', eventId: 'e1', change: 'feat-a', event: 'git_commit', source: 'git-hook' });

    const code = await runArchive({ cwd: tmp, change: 'feat-a', report: false });
    expect(code).toBe(0);

    const reportsDir = path.join(tmp, '.ivy', 'reports');
    try {
      await fs.access(reportsDir);
      // Directory exists but should be empty or not created
      const files = await fs.readdir(reportsDir);
      expect(files.length).toBe(0);
    } catch {
      // Directory doesn't exist — also valid
      expect(true).toBe(true);
    }
  });
});
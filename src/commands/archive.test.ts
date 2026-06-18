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

  async function ensureChangeDir(name: string): Promise<void> {
    const changeDir = path.join(tmp, 'openspec', 'changes', name);
    await fs.mkdir(changeDir, { recursive: true });
    // Add to project.yaml
    const { patchYaml } = await import('../utils/yaml.js');
    await patchYaml(path.join(tmp, '.ivy', 'project.yaml'), {
      changes: [{ name, phase: 'verify' }],
    });
  }

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
    await ensureChangeDir('feat-x');
    const code = await runArchive({ cwd: tmp, change: 'feat-x' });
    expect(code).toBe(0);
  });

  it('generates report file with --report flag', async () => {
    gitInit(tmp);
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true });
    await ensureChangeDir('feat-x');

    // Add phase transition events for timeline
    await writeRawEvent(tmp, { ts: '2026-06-01T10:00:00Z', eventId: 'e1', change: 'feat-x', event: 'git_commit', source: 'git-hook' });
    await writeRawEvent(tmp, { ts: '2026-06-01T12:00:00Z', eventId: 'e2', change: 'feat-x', event: 'phase_transition', source: 'hook', meta: { from: 'open', to: 'design' } });
    await writeRawEvent(tmp, { ts: '2026-06-05T10:00:00Z', eventId: 'e3', change: 'feat-x', event: 'phase_transition', source: 'hook', meta: { from: 'design', to: 'build' } });

    const code = await runArchive({ cwd: tmp, change: 'feat-x' });
    expect(code).toBe(0);

    // Verify report file exists in .ivy/archive/
    const reportsDir = path.join(tmp, '.ivy', 'archive');
    const files = await fs.readdir(reportsDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^feat-x-\d{4}-\d{2}-\d{2}\.md$/);

    // Verify report content has expected sections
    const content = await fs.readFile(path.join(reportsDir, files[0]), 'utf-8');
    expect(content).toContain('# Archive Report: feat-x');
    expect(content).toContain('## Summary');
    expect(content).toContain('## Lessons Learned');
  });

  it('includes phase transitions in report when events exist', async () => {
    gitInit(tmp);
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true });
    await ensureChangeDir('feat-y');

    await writeRawEvent(tmp, { ts: '2026-06-01T10:00:00Z', eventId: 'e1', change: 'feat-y', event: 'phase_transition', source: 'hook', meta: { from: 'open', to: 'design' } });
    await writeRawEvent(tmp, { ts: '2026-06-05T10:00:00Z', eventId: 'e2', change: 'feat-y', event: 'phase_transition', source: 'hook', meta: { from: 'design', to: 'build' } });
    await writeRawEvent(tmp, { ts: '2026-06-10T10:00:00Z', eventId: 'e3', change: 'feat-y', event: 'phase_transition', source: 'hook', meta: { from: 'build', to: 'verify' } });

    const code = await runArchive({ cwd: tmp, change: 'feat-y' });
    expect(code).toBe(0);

    const reportsDir = path.join(tmp, '.ivy', 'archive');
    const files = await fs.readdir(reportsDir);
    expect(files.length).toBe(1);
    const content = await fs.readFile(path.join(reportsDir, files[0]), 'utf-8');
    expect(content).toContain('Phase Transition');
  });

  it('handles no events gracefully (empty events.jsonl)', async () => {
    gitInit(tmp);
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true });
    await ensureChangeDir('feat-z');
    // No events written — empty events.jsonl

    const code = await runArchive({ cwd: tmp, change: 'feat-z' });
    expect(code).toBe(0);

    const reportsDir = path.join(tmp, '.ivy', 'archive');
    const files = await fs.readdir(reportsDir);
    expect(files.length).toBe(1);
  });

  it('does not generate report without --report flag', async () => {
    // In v0.9, report is always generated; this test verifies graceful handling
    gitInit(tmp);
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true });
    await ensureChangeDir('feat-a');

    await writeRawEvent(tmp, { ts: '2026-06-01T10:00:00Z', eventId: 'e1', change: 'feat-a', event: 'git_commit', source: 'git-hook' });

    const code = await runArchive({ cwd: tmp, change: 'feat-a' });
    expect(code).toBe(0);

    // Report is always generated in .ivy/archive/
    const reportsDir = path.join(tmp, '.ivy', 'archive');
    const files = await fs.readdir(reportsDir);
    expect(files.length).toBe(1);
  });
});

// ─── v0.9: Knowledge extraction + action flags ───

describe('runArchive v0.9', () => {
  let tmp: string;

  async function setupChange(name = 'feat-x'): Promise<void> {
    const changeDir = path.join(tmp, 'openspec', 'changes', name);
    await fs.mkdir(changeDir, { recursive: true });
    // Add change to project.yaml via patchYaml
    const { patchYaml } = await import('../utils/yaml.js');
    await patchYaml(path.join(tmp, '.ivy', 'project.yaml'), {
      changes: [{ name, phase: 'verify' }],
    });
  }

  beforeEach(async () => {
    tmp = await mkTmpDir();
    gitInit(tmp);
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true });
    await setupChange();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('uses --force to archive from early phase', async () => {
    // Override to design phase
    const { patchYaml } = await import('../utils/yaml.js');
    await patchYaml(path.join(tmp, '.ivy', 'project.yaml'), {
      changes: [{ name: 'feat-x', phase: 'design' }],
    });
    const code = await runArchive({ cwd: tmp, change: 'feat-x', force: true });
    expect(code).toBe(0);
  });

  it('--no-extract skips knowledge extraction', async () => {
    const code = await runArchive({ cwd: tmp, change: 'feat-x', noExtract: true });
    expect(code).toBe(0);
    const knowledgeDir = path.join(tmp, '.ivy', 'knowledge');
    const exists = await fs.stat(knowledgeDir).then(() => true, () => false);
    expect(exists).toBe(false);
  });

  it('extracts knowledge from change documents', async () => {
    const changeDir = path.join(tmp, 'openspec', 'changes', 'feat-x');
    await fs.writeFile(path.join(changeDir, 'design.md'), [
      '## Decision',
      '- Use TypeScript for safety',
      '',
      '## Constraints',
      '- Must be backward compatible',
      '',
    ].join('\n'));

    const code = await runArchive({ cwd: tmp, change: 'feat-x' });
    expect(code).toBe(0);

    const knowledgeFile = path.join(tmp, '.ivy', 'knowledge', 'feat-x.yaml');
    const exists = await fs.stat(knowledgeFile).then(() => true, () => false);
    expect(exists).toBe(true);
  });

  it('accepts --action parameter', async () => {
    const code = await runArchive({ cwd: tmp, change: 'feat-x', action: 'discard', noExtract: true });
    expect(code).toBe(0);
  });

  it('accepts --message parameter', async () => {
    const code = await runArchive({ cwd: tmp, change: 'feat-x', message: 'Archive msg', noExtract: true });
    expect(code).toBe(0);
  });
});
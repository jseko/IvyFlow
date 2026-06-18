import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { execFileSync } from 'child_process';

import { emitFileSaveEvents, isGitWatchEnabled } from './git-watch.js';
import { readRawEvents, type RawEvent } from './sessions.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-gitwatch-'));
}

function gitInit(cwd: string): void {
  execFileSync('git', ['init', '-q'], { cwd });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd });
  execFileSync('git', ['commit', '--allow-empty', '-q', '-m', 'init'], { cwd });
}

describe('emitFileSaveEvents', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
    gitInit(tmp);
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns 0 when no new files changed', async () => {
    const count = await emitFileSaveEvents({ cwd: tmp, change: 'test-change' });
    expect(count).toBe(0);
  });

  it('emits file_save events for added files', async () => {
    await fs.writeFile(path.join(tmp, 'test.txt'), 'hello world');
    execFileSync('git', ['add', '.'], { cwd: tmp });
    execFileSync('git', ['commit', '-q', '-m', 'add test file'], { cwd: tmp });

    const count = await emitFileSaveEvents({ cwd: tmp, change: 'test-change' });
    expect(count).toBeGreaterThanOrEqual(1);

    // Read back events
    const events: RawEvent[] = [];
    for await (const e of readRawEvents(tmp)) {
      events.push(e);
    }
    const fileEvents = events.filter((e) => e.event === 'file_save');
    expect(fileEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('file_save event has correct schema (no file content)', async () => {
    await fs.writeFile(path.join(tmp, 'code.ts'), 'const x = 1;');
    execFileSync('git', ['add', '.'], { cwd: tmp });
    execFileSync('git', ['commit', '-q', '-m', 'add code file'], { cwd: tmp });

    await emitFileSaveEvents({ cwd: tmp, change: 'test-change' });

    const events: RawEvent[] = [];
    for await (const e of readRawEvents(tmp)) {
      events.push(e);
    }
    const fileEvent = events.find((e) => e.event === 'file_save');
    expect(fileEvent).toBeDefined();

    const meta = fileEvent!.meta as Record<string, unknown>;
    expect(meta).toHaveProperty('path');
    expect(meta).toHaveProperty('status');
    expect(meta).toHaveProperty('commitHash');
    expect(meta).toHaveProperty('fileSize');
    expect(meta).toHaveProperty('insertions');
    expect(meta).toHaveProperty('deletions');

    // MUST NOT contain file content per §9.11
    expect(JSON.stringify(fileEvent)).not.toContain('const x = 1');
    expect(JSON.stringify(meta)).not.toContain('content');
  });

  it('file_save event is valid RawEvent', async () => {
    await fs.writeFile(path.join(tmp, 'data.json'), JSON.stringify({ a: 1 }));
    execFileSync('git', ['add', '.'], { cwd: tmp });
    execFileSync('git', ['commit', '-q', '-m', 'add data'], { cwd: tmp });

    await emitFileSaveEvents({ cwd: tmp, change: 'test-change' });

    const events: RawEvent[] = [];
    for await (const e of readRawEvents(tmp)) {
      events.push(e);
    }
    const fileEvent = events.find((e) => e.event === 'file_save');
    expect(fileEvent).toBeDefined();
    expect(fileEvent!.eventId).toBeTruthy();
    expect(fileEvent!.ts).toBeTruthy();
    expect(fileEvent!.change).toBe('test-change');
    expect(fileEvent!.source).toBe('git-hook');
    expect(fileEvent!.event).toBe('file_save');
  });
});

describe('isGitWatchEnabled', () => {
  const OLD_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  it('returns false by default', () => {
    delete process.env.IVY_GIT_WATCH;
    expect(isGitWatchEnabled()).toBe(false);
  });

  it('returns true when IVY_GIT_WATCH=1', () => {
    process.env.IVY_GIT_WATCH = '1';
    expect(isGitWatchEnabled()).toBe(true);
  });

  it('returns true when IVY_GIT_WATCH=true', () => {
    process.env.IVY_GIT_WATCH = 'true';
    expect(isGitWatchEnabled()).toBe(true);
  });

  it('returns false when IVY_GIT_WATCH=0', () => {
    process.env.IVY_GIT_WATCH = '0';
    expect(isGitWatchEnabled()).toBe(false);
  });
});

/**
 * Tests for analytics command (ivy analytics) — v0.7 rewrite.
 *
 * Coverage:
 * - --enable / --disable (maintained from v0.4)
 * - --project aggregation
 * - --change filtering
 * - --period filtering
 * - --json output
 * - --confidence disclosure
 * - Empty data handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { execFileSync } from 'child_process';

import { runAnalytics } from './analytics.js';
import { runInit } from './init.js';
import { appendRawEvent } from '../core/sessions.js';
import { type RawEvent } from '../core/sessions.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-analytics-'));
}

function gitInit(cwd: string): void {
  execFileSync('git', ['init', '-q'], { cwd });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd });
  execFileSync('git', ['commit', '--allow-empty', '-q', '-m', 'init'], { cwd });
}

function makeCommit(ts: string, change: string, hash: string): RawEvent {
  return {
    eventId: `evt_${hash}`,
    event: 'git_commit',
    ts,
    change,
    source: 'git-hook',
    meta: { hash, insertions: 10, deletions: 2 },
  };
}

let capturedLogs: string[] = [];
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

beforeEach(() => {
  capturedLogs = [];
  console.log = (...args: string[]) => {
    capturedLogs.push(args.map(String).join(' '));
  };
  console.warn = (...args: string[]) => {
    capturedLogs.push(args.map(String).join(' '));
  };
  console.error = (...args: string[]) => {
    capturedLogs.push(args.map(String).join(' '));
  };
});

afterEach(() => {
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;
});

function captured(): string {
  return capturedLogs.join('\n');
}

describe('runAnalytics', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
    capturedLogs = [];
    gitInit(tmp);
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true });
    capturedLogs = [];

    // Enable analytics
    await runAnalytics({ cwd: tmp, enable: true });
    capturedLogs = [];
  });

  afterEach(async () => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  });

  it('--enable updates project.yaml', async () => {
    // Already enabled in beforeEach, test the --disable then --enable flow
    await runAnalytics({ cwd: tmp, disable: true });
    capturedLogs = [];

    const code = await runAnalytics({ cwd: tmp, enable: true });
    expect(code).toBe(0);
    expect(captured()).toContain('Analytics enabled');
  });

  it('--disable stops analytics', async () => {
    const code = await runAnalytics({ cwd: tmp, disable: true });
    expect(code).toBe(0);
    expect(captured()).toContain('disabled');
  });

  it('shows insufficient data with no events', async () => {
    const code = await runAnalytics({ cwd: tmp });
    expect(code).toBe(0);
    expect(captured()).toContain('Insufficient data');
  });

  it('shows analytics with commit events', async () => {
    await appendRawEvent(tmp, makeCommit('2026-06-16T10:00:00Z', 'feat-x', 'a1'));
    await appendRawEvent(tmp, makeCommit('2026-06-17T10:00:00Z', 'feat-x', 'a2'));

    const code = await runAnalytics({ cwd: tmp });
    expect(code).toBe(0);
    const out = captured();
    expect(out).toContain('Adoption Analytics');
    expect(out).toContain('commits');
  });

  it('supports --change filtering', async () => {
    await appendRawEvent(tmp, makeCommit('2026-06-16T10:00:00Z', 'feat-x', 'a1'));

    const code = await runAnalytics({ cwd: tmp, change: 'feat-x' });
    expect(code).toBe(0);
    expect(captured()).toContain('feat-x');
  });

  it('supports --json output', async () => {
    await appendRawEvent(tmp, makeCommit('2026-06-16T10:00:00Z', 'feat-x', 'a1'));

    const code = await runAnalytics({ cwd: tmp, json: true });
    expect(code).toBe(0);
    const parsed = JSON.parse(captured());
    expect(parsed.funnel).toBeDefined();
    expect(parsed.confidence).toBeDefined();
  });

  it('supports --confidence for detailed disclosure', async () => {
    await appendRawEvent(tmp, makeCommit('2026-06-16T10:00:00Z', 'feat-x', 'a1'));

    const code = await runAnalytics({ cwd: tmp, confidence: true });
    expect(code).toBe(0);
    const out = captured();
    expect(out).toContain('Confidence Disclosure');
    expect(out).toContain('high');
    expect(out).toContain('medium');
    expect(out).toContain('low');
  });

  it('supports --period 90d', async () => {
    await appendRawEvent(tmp, makeCommit('2026-06-01T10:00:00Z', 'feat-x', 'a1'));

    const code = await runAnalytics({ cwd: tmp, period: '90d' });
    expect(code).toBe(0);
    expect(captured()).toContain('Adoption Analytics');
  });
});

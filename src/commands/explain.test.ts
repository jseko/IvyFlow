/**
 * Tests for explain command (ivy explain) — v0.7.
 *
 * Coverage:
 * - Single suggestion by --id
 * - Batch mode by --change / --type
 * - --json output
 * - Nonexistent ID graceful error
 * - Read-only verification (§9.15)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { execFileSync } from 'child_process';

import { runExplain } from './explain.js';
import { runInit } from './init.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-explain-'));
}

function gitInit(cwd: string): void {
  execFileSync('git', ['init', '-q'], { cwd });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd });
  execFileSync('git', ['commit', '--allow-empty', '-q', '-m', 'init'], { cwd });
}

let capturedLogs: string[] = [];
const originalLog = console.log;
const originalWarn = console.warn;

beforeEach(() => {
  capturedLogs = [];
  console.log = (...args: string[]) => {
    capturedLogs.push(args.map(String).join(' '));
  };
  console.warn = (...args: string[]) => {
    capturedLogs.push(args.map(String).join(' '));
  };
});

afterEach(() => {
  console.log = originalLog;
  console.warn = originalWarn;
});

function captured(): string {
  return capturedLogs.join('\n');
}

describe('runExplain', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
    capturedLogs = [];
    gitInit(tmp);
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true });
    // Clear init output from captured logs
    capturedLogs = [];
  });

  afterEach(async () => {
    console.log = originalLog;
    console.warn = originalWarn;
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  });

  it('returns "not found" for nonexistent suggestion ID', async () => {
    const code = await runExplain({ cwd: tmp, id: 'nonexistent' });
    expect(code).toBe(1);
    expect(captured()).toContain('not found');
  });

  it('returns "No suggestions found" when no suggestions exist', async () => {
    const code = await runExplain({ cwd: tmp });
    expect(code).toBe(0);
    expect(captured()).toContain('No suggestions');
  });

  it('returns JSON output with empty array when requested', async () => {
    const code = await runExplain({ cwd: tmp, json: true });
    expect(code).toBe(0);
    const out = captured();
    // Should be parseable JSON with explanations array
    const parsed = JSON.parse(out);
    expect(parsed.explanations).toEqual([]);
  });

  it('gracefully handles --change with no matching data', async () => {
    const code = await runExplain({ cwd: tmp, change: 'nonexistent-change' });
    expect(code).toBe(0);
    expect(captured()).toContain('No suggestions');
  });

  it('gracefully handles --type with no matching data', async () => {
    const code = await runExplain({ cwd: tmp, type: 'stuck' });
    expect(code).toBe(0);
    expect(captured()).toContain('No suggestions');
  });

  it('read-only: does not create any files (§9.15)', async () => {
    // Record files before
    const before = new Set<string>();
    await collectFiles(tmp, before);

    await runExplain({ cwd: tmp, id: 'nonexistent' });

    // Record files after
    const after = new Set<string>();
    await collectFiles(tmp, after);

    // No new files should exist
    for (const f of after) {
      expect(before.has(f)).toBe(true);
    }
  });
});

async function collectFiles(dir: string, set: Set<string>): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
  for (const e of entries) {
    const full = path.join(e.parentPath ?? dir, e.name);
    if (e.isFile()) set.add(full);
  }
}

/**
 * Tests for rules command (ivy rules) — v0.7.
 *
 * Coverage:
 * - --list all rules
 * - --info single rule
 * - --override with valid/invalid params
 * - --remove override
 * - JSON output
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { execFileSync } from 'child_process';

import { runRules } from './rules.js';
import { runInit } from './init.js';
import { readRuleManifest } from '../core/rule-registry.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-rules-cmd-'));
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

describe('runRules', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
    capturedLogs = [];
    gitInit(tmp);
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true });
    capturedLogs = [];
  });

  afterEach(async () => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  });

  it('lists all 5 rules with --list', async () => {
    const code = await runRules({ cwd: tmp, list: true });
    expect(code).toBe(0);
    const out = captured();
    expect(out).toContain('5 rule(s)');
    expect(out).toContain('stuck_detection');
    expect(out).toContain('calibration');
  });

  it('shows detailed info with --info', async () => {
    const code = await runRules({ cwd: tmp, info: 'stuck_detection' });
    expect(code).toBe(0);
    const out = captured();
    expect(out).toContain('stuck_detection');
    expect(out).toContain('threshold');
    expect(out).toContain('v3');
  });

  it('returns error for --info with nonexistent rule', async () => {
    const code = await runRules({ cwd: tmp, info: 'nonexistent' });
    expect(code).toBe(1);
    expect(captured()).toContain('not found');
  });

  it('applies override with --override', async () => {
    const code = await runRules({ cwd: tmp, override: 'stuck_detection.build=25' });
    expect(code).toBe(0);
    const out = captured();
    expect(out).toContain('saved');
    expect(out).toContain('build = 25');

    // Verify manifest
    const manifest = await readRuleManifest(tmp);
    expect(manifest).not.toBeNull();
    const ruleEntry = manifest!.rules.find((r) => r.name === 'stuck_detection');
    expect(ruleEntry?.overrides[0].value).toBe(25);
  });

  it('returns error for --override with invalid param', async () => {
    const code = await runRules({ cwd: tmp, override: 'stuck_detection.invalid=10' });
    expect(code).toBe(1);
    expect(captured()).toContain('not allowed');
  });

  it('removes override with --remove', async () => {
    // First add an override
    await runRules({ cwd: tmp, override: 'stuck_detection.build=25' });
    capturedLogs = [];

    const code = await runRules({ cwd: tmp, remove: 'stuck_detection.build' });
    expect(code).toBe(0);
    expect(captured()).toContain('removed');
  });

  it('returns success when removing nonexistent override', async () => {
    const code = await runRules({ cwd: tmp, remove: 'stuck_detection.build' });
    expect(code).toBe(0);
    expect(captured()).toContain('No override found');
  });

  it('returns error for --override with bad format', async () => {
    const code = await runRules({ cwd: tmp, override: 'badformat' });
    expect(code).toBe(1);
    expect(captured()).toContain('Invalid');
  });

  it('outputs JSON with --list --json', async () => {
    const code = await runRules({ cwd: tmp, list: true, json: true });
    expect(code).toBe(0);
    const parsed = JSON.parse(captured());
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(5);
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { execFileSync } from 'child_process';

import { runDashboard } from './dashboard.js';
import { runInit } from './init.js';
import { recordFeedback } from '../core/feedback-recorder.js';
import { writeCalibrationProfile } from '../core/quality-calibrator.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-dash-'));
}

function gitInit(cwd: string): void {
  execFileSync('git', ['init', '-q'], { cwd });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd });
  execFileSync('git', ['commit', '--allow-empty', '-q', '-m', 'init'], { cwd });
}

/**
 * Write a raw event JSONL line to .ivy/sessions/raw/events.jsonl.
 * Creates the directory and file if they don't exist.
 */
async function writeRawEvent(cwd: string, event: Record<string, unknown>): Promise<void> {
  const dir = path.join(cwd, '.ivy', 'sessions', 'raw');
  await fs.mkdir(dir, { recursive: true });
  const line = JSON.stringify(event) + '\n';
  await fs.appendFile(path.join(dir, 'events.jsonl'), line, 'utf-8');
}

// Capture console output manually
let capturedLogs: string[] = [];
const originalLog = console.log;

beforeEach(() => {
  capturedLogs = [];
  console.log = (...args: string[]) => {
    capturedLogs.push(args.map(String).join(' '));
  };
});

afterEach(() => {
  console.log = originalLog;
});

describe('runDashboard team mode', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
    capturedLogs = [];
    gitInit(tmp);
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true });
    // Enable analytics
    const yamlPath = path.join(tmp, '.ivy', 'project.yaml');
    const yaml = await fs.readFile(yamlPath, 'utf-8');
    await fs.writeFile(yamlPath, yaml.replace('analytics_enabled: false', 'analytics_enabled: true'));
  });

  afterEach(async () => {
    console.log = originalLog;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  function captured(): string {
    return capturedLogs.join('\n');
  }

  it('renders team dashboard output with --team flag', async () => {
    // Write events for multiple changes with transitions spanning several weeks
    // Change "feat-auth": completed (reached archive), with slow build (28d > 21d baseline)
    // This should trigger a bottleneck phase detection
    const baseTs = new Date('2026-06-01T10:00:00Z');

    // Week 1 — change "feat-auth" starts in open
    await writeRawEvent(tmp, { ts: new Date(baseTs.getTime() + 0).toISOString(), eventId: 'e1', change: 'feat-auth', event: 'git_commit', source: 'git-hook' });
    await writeRawEvent(tmp, { ts: new Date(baseTs.getTime() + 3600000).toISOString(), eventId: 'e2', change: 'feat-auth', event: 'phase_transition', source: 'hook', meta: { from: 'open', to: 'design' } });

    // Week 2 — feat-auth transitions to build
    await writeRawEvent(tmp, { ts: new Date(baseTs.getTime() + 7 * 86400000).toISOString(), eventId: 'e3', change: 'feat-auth', event: 'phase_transition', source: 'hook', meta: { from: 'design', to: 'build' } });

    // Week 3 — change "feat-api" starts
    await writeRawEvent(tmp, { ts: new Date(baseTs.getTime() + 14 * 86400000).toISOString(), eventId: 'e4', change: 'feat-api', event: 'git_commit', source: 'git-hook' });
    await writeRawEvent(tmp, { ts: new Date(baseTs.getTime() + 14 * 86400000 + 3600000).toISOString(), eventId: 'e5', change: 'feat-api', event: 'phase_transition', source: 'hook', meta: { from: 'open', to: 'design' } });

    // Week 5 — feat-auth takes 28 days in build (exceeds 21d baseline), transitions to verify then archive
    await writeRawEvent(tmp, { ts: new Date(baseTs.getTime() + 35 * 86400000).toISOString(), eventId: 'e6', change: 'feat-auth', event: 'phase_transition', source: 'hook', meta: { from: 'build', to: 'verify' } });
    await writeRawEvent(tmp, { ts: new Date(baseTs.getTime() + 36 * 86400000).toISOString(), eventId: 'e7', change: 'feat-auth', event: 'phase_transition', source: 'hook', meta: { from: 'verify', to: 'archive' } });

    // Week 6 — feat-api transitions to build
    await writeRawEvent(tmp, { ts: new Date(baseTs.getTime() + 42 * 86400000).toISOString(), eventId: 'e8', change: 'feat-api', event: 'phase_transition', source: 'hook', meta: { from: 'design', to: 'build' } });

    // Change "fix-login" starts in week 7
    await writeRawEvent(tmp, { ts: new Date(baseTs.getTime() + 49 * 86400000).toISOString(), eventId: 'e9', change: 'fix-login', event: 'git_commit', source: 'git-hook' });
    await writeRawEvent(tmp, { ts: new Date(baseTs.getTime() + 49 * 86400000 + 3600000).toISOString(), eventId: 'e10', change: 'fix-login', event: 'phase_transition', source: 'hook', meta: { from: 'open', to: 'design' } });

    const code = await runDashboard({ cwd: tmp, team: true });
    expect(code).toBe(0);
    const out = captured();
    expect(out).toContain('IvyFlow Team Dashboard');
    expect(out).toContain('Project Overview');
    expect(out).toContain('Bottleneck Identification');
    expect(out).toContain('Suggestion System Health');
    expect(out).toContain('correlation observation');
    // Should show non-zero data — change counts and phase names
    expect(out).toContain('3 total');
    expect(out).toContain('12.2d vs baseline');
    expect(out).toContain('Suggestion System Health');
  });

  it('handles no data gracefully with exit code 0', async () => {
    // Create a directory with no events at all
    const emptyTmp = await mkTmpDir();
    try {
      gitInit(emptyTmp);
      // No .ivy dir at all — team mode bypasses analytics_enabled check
      const code = await runDashboard({ cwd: emptyTmp, team: true });
      expect(code).toBe(0);
      const out = capturedLogs.join('\n');
      expect(out).toContain('IvyFlow Team Dashboard');
      expect(out).toContain('Insufficient data');
    } finally {
      await fs.rm(emptyTmp, { recursive: true, force: true });
    }
  });
});

describe('runDashboard quality panel', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
    capturedLogs = [];
    gitInit(tmp);
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true });
    // Enable analytics
    const yamlPath = path.join(tmp, '.ivy', 'project.yaml');
    const yaml = await fs.readFile(yamlPath, 'utf-8');
    await fs.writeFile(yamlPath, yaml.replace('analytics_enabled: false', 'analytics_enabled: true'));
  });

  afterEach(async () => {
    console.log = originalLog;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  function captured(): string {
    return capturedLogs.join('\n');
  }

  it('renders standard dashboard without quality panel by default', async () => {
    const code = await runDashboard({ cwd: tmp });
    expect(code).toBe(0);
    const out = captured();
    expect(out).toContain('IvyFlow Dashboard');
    expect(out).not.toContain('Suggestion Quality');
  });

  it('renders quality metrics panel with --quality flag', async () => {
    // Add some feedback data
    await recordFeedback(tmp, 'sugg-1', 'accepted');
    await recordFeedback(tmp, 'sugg-2', 'dismissed', 'not_relevant');
    await recordFeedback(tmp, 'sugg-3', 'accepted');

    const code = await runDashboard({ cwd: tmp, quality: true });
    expect(code).toBe(0);
    const out = captured();
    expect(out).toContain('Suggestion Quality');
    expect(out).toContain('Effectiveness');
    expect(out).toContain('Accuracy');
    expect(out).toContain('Dismissal Reasons');
  });

  it('renders weekly trend when feedback data exists', async () => {
    await recordFeedback(tmp, 'sugg-1', 'accepted');
    await recordFeedback(tmp, 'sugg-2', 'accepted');

    const code = await runDashboard({ cwd: tmp, quality: true });
    expect(code).toBe(0);
    const out = captured();
    expect(out).toContain('Suggestion Quality');
    expect(out).toContain('Effectiveness');
  });

  it('renders calibration info when calibration profile exists', async () => {
    // Write a calibration profile
    await writeCalibrationProfile(tmp, {
      stuckThresholds: { open: 14, design: 21, build: 30, verify: 14, archive: 0 },
      percentileThreshold: 0.8,
      minDataPoints: 5,
      calibrationVersion: 1,
      advisorVersion: '0.6.0',
      ruleVersion: 1,
      lastCalibratedAt: new Date().toISOString(),
      calibrationCount: 3,
      mode: 'hybrid',
    });

    const code = await runDashboard({ cwd: tmp, quality: true });
    expect(code).toBe(0);
    const out = captured();
    expect(out).toContain('Calibration');
    expect(out).toContain('hybrid');
  });
});

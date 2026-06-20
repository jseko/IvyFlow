import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import { runInit } from './init.js';
import { runDoctor } from './doctor.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-doctor-'));
}

// Capture console output for --platforms tests
let capturedLogs: string[] = [];
const originalLog = console.log;

describe('runDoctor (v0.2 local invariant)', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('exits 1 when no .ivy/project.yaml present', async () => {
    const code = await runDoctor({ cwd: tmp });
    expect(code).toBe(1);
  });

  it('returns 0 after a fresh `ivy init`', async () => {
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });
    const code = await runDoctor({ cwd: tmp });
    expect(code).toBe(0);
  });

  it('detects missing rule and reports failed', async () => {
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });
    await fs.rm(path.join(tmp, '.claude', 'rules', 'ivy-phase-guard.md'));
    const code = await runDoctor({ cwd: tmp });
    expect(code).toBe(1);
  });

  it('--fix re-creates a missing rule (never rewrites existing files)', async () => {
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });
    const rulePath = path.join(tmp, '.claude', 'rules', 'ivy-phase-guard.md');
    await fs.rm(rulePath);

    const code = await runDoctor({ cwd: tmp, fix: true });
    // After --fix the file should be back; doctor itself reports the *pre-fix*
    // state, so the exit code may still be 1 — re-running confirms recovery.
    expect([0, 1]).toContain(code);

    const stat = await fs.stat(rulePath);
    expect(stat.isFile()).toBe(true);

    const second = await runDoctor({ cwd: tmp });
    expect(second).toBe(0);
  });

  it('handles multi-platform install (windsurf hook + cursor mdc)', async () => {
    await runInit({
      mode: 'quick',
      cwd: tmp,
      skipOpenSpec: true,
      platforms: ['claude', 'cursor', 'windsurf'],
    });
    const code = await runDoctor({ cwd: tmp });
    expect(code).toBe(0);
  });
});

// Separate describe block for --platforms tests with console capture
describe('runDoctor --platforms (v0.8)', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
    capturedLogs = [];
    console.log = (...args: string[]) => {
      capturedLogs.push(args.map(String).join(' '));
    };
  });

  afterEach(async () => {
    console.log = originalLog;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('shows platform health report with claude installed', async () => {
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });
    const code = await runDoctor({ cwd: tmp, platforms: true });
    expect(code).toBe(0);

    const out = capturedLogs.join('\n');
    expect(out).toContain('IvyFlow Platform Certification Report');
    expect(out).toContain('Certified');
    expect(out).toContain('claude');
    expect(out).toContain('skills');
    expect(out).toContain('rules');
  });

  it('shows all platforms in clean project', async () => {
    const code = await runDoctor({ cwd: tmp, platforms: true });
    expect(code).toBe(0);

    const out = capturedLogs.join('\n');
    // Should reference total count (29 platforms)
    expect(out).toMatch(/\d+ \/ 29 /);
    expect(out).toContain('Certified');
    expect(out).toContain('Experimental');
  });

  it('reports platform certification counts', async () => {
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude', 'cursor'] });
    const code = await runDoctor({ cwd: tmp, platforms: true });
    expect(code).toBe(0);

    const out = capturedLogs.join('\n');
    // Should show Certified count = 11
    expect(out).toContain('Certified: 11');
    // Should show Experimental count = 18
    expect(out).toContain('Experimental: 18');
  });
});

// ─── --environment (v0.9) ───

describe('runDoctor --environment', () => {
  let tmp: string;

  async function gitInit(cwd: string): Promise<void> {
    const { execFileSync } = await import('child_process');
    execFileSync('git', ['init', '-q'], { cwd });
    execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd });
    execFileSync('git', ['config', 'user.name', 'T'], { cwd });
    execFileSync('git', ['commit', '--allow-empty', '-q', '-m', 'init'], { cwd });
  }

  beforeEach(async () => {
    tmp = await mkTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('exits 0 in a valid environment', async () => {
    await gitInit(tmp);
    const code = await runDoctor({ cwd: tmp, environment: true });
    expect(code).toBe(0);
  });

  it('does not crash when package.json is present', async () => {
    await gitInit(tmp);
    await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 'test' }));
    const code = await runDoctor({ cwd: tmp, environment: true });
    expect(code).toBe(0);
  });

  it('handles pom.xml without Java gracefully', async () => {
    await gitInit(tmp);
    await fs.writeFile(path.join(tmp, 'pom.xml'), '<project></project>');
    const code = await runDoctor({ cwd: tmp, environment: true });
    // Should not crash — if Java is missing, it logs a warning
    expect([0, 1]).toContain(code);
  });

  it('handles git presence gracefully in non-repo directory', async () => {
    // No git init — git rev-parse will fail
    const code = await runDoctor({ cwd: tmp, environment: true });
    expect(code).toBe(1);
  });
});

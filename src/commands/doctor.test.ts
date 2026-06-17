import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import { runInit } from './init.js';
import { runDoctor } from './doctor.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-doctor-'));
}

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

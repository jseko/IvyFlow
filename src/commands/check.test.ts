import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import { runCheck, type CheckOptions } from './check.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-check-'));
}

function mockConsole(): {
  logSpy: ReturnType<typeof vi.spyOn>;
  warnSpy: ReturnType<typeof vi.spyOn>;
  captured: () => string;
} {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  return {
    logSpy,
    warnSpy,
    captured: () =>
      [...logSpy.mock.calls, ...warnSpy.mock.calls]
        .map((c) => c.map(String).join(' '))
        .join('\n'),
  };
}

describe('runCheck', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns 0 by default (non-blocking)', async () => {
    const code = await runCheck({ cwd: tmp });
    expect(code).toBe(0);
  });

  it('returns 0 with --output markdown', async () => {
    const { captured, logSpy } = mockConsole();
    const code = await runCheck({ cwd: tmp, output: 'markdown' });
    expect(code).toBe(0);
    const out = captured();
    expect(out).toContain('## IvyFlow Workflow Check');
    expect(out).toContain('| Status | Check | Detail |');
    expect(out).toContain('non-blocking');
    logSpy.mockRestore();
  });

  it('returns 0 with --output json', async () => {
    const { captured, logSpy } = mockConsole();
    const code = await runCheck({ cwd: tmp, output: 'json' });
    expect(code).toBe(0);
    const out = captured();
    const parsed = JSON.parse(out);
    expect(parsed.nonBlocking).toBe(true);
    expect(parsed.checks).toBeInstanceOf(Array);
    expect(parsed.mode).toBeDefined();
    logSpy.mockRestore();
  });

  it('returns 0 with --output cli', async () => {
    const { captured, logSpy } = mockConsole();
    const code = await runCheck({ cwd: tmp, output: 'cli' });
    expect(code).toBe(0);
    const out = captured();
    expect(out).toContain('IvyFlow Check');
    logSpy.mockRestore();
  });

  it('returns 0 in quick mode', async () => {
    const code = await runCheck({ cwd: tmp, mode: 'quick' });
    expect(code).toBe(0);
  });

  it('returns 0 in standard mode', async () => {
    const code = await runCheck({ cwd: tmp, mode: 'standard' });
    expect(code).toBe(0);
  });

  it('returns 0 with --env mode (environment detection)', async () => {
    const { captured, logSpy } = mockConsole();
    const code = await runCheck({ cwd: tmp, env: true });
    expect(code).toBe(0);
    const out = captured();
    expect(out).toContain('IvyFlow Environment Check');
    expect(out).toContain('Node.js');
    logSpy.mockRestore();
  });

  it('--env mode detects Git repo when present', async () => {
    const { captured, logSpy } = mockConsole();
    const { execFileSync } = await import('child_process');
    execFileSync('git', ['init', '-q'], { cwd: tmp });
    execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: tmp });
    execFileSync('git', ['config', 'user.name', 'T'], { cwd: tmp });
    execFileSync('git', ['commit', '--allow-empty', '-q', '-m', 'init'], { cwd: tmp });

    const code = await runCheck({ cwd: tmp, env: true });
    expect(code).toBe(0);
    const out = captured();
    expect(out).toContain('Git');
    expect(out).toContain('repository detected');
    logSpy.mockRestore();
  });

  it('exit-code with failOn=none does not trigger (returns 0)', async () => {
    const code = await runCheck({ cwd: tmp, exitCode: true, failOn: 'none' });
    expect(code).toBe(0);
  });

  it('exit-code with failOn=any_critical returns 0 when no failures', async () => {
    const code = await runCheck({ cwd: tmp, exitCode: true, failOn: 'any_critical' });
    expect(code).toBe(0);
  });

  it('exit-code with failOn=stuck_critical returns 0 when no stuck warnings', async () => {
    const code = await runCheck({ cwd: tmp, exitCode: true, failOn: 'stuck_critical' });
    expect(code).toBe(0);
  });

  it('uses default mode=standard when no mode provided', async () => {
    const code = await runCheck({ cwd: tmp });
    expect(code).toBe(0);
  });

  it('handles change param in report output', async () => {
    const { captured, logSpy } = mockConsole();
    const code = await runCheck({ cwd: tmp, change: 'my-change', output: 'cli' });
    expect(code).toBe(0);
    const out = captured();
    expect(out).toContain('my-change');
    logSpy.mockRestore();
  });
});

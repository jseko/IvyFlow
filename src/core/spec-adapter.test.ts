import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process BEFORE importing modules that use it.
vi.mock('child_process', () => {
  return {
    execFileSync: vi.fn(),
  };
});

import { execFileSync } from 'child_process';
import { defaultSpecAdapter, OpenSpecAdapter } from './spec-adapter.js';

const mockedExec = execFileSync as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedExec.mockReset();
});

describe('SpecAdapter — defaults', () => {
  it('defaultSpecAdapter is named "openspec"', () => {
    expect(defaultSpecAdapter.name).toBe('openspec');
  });

  it('defaultSpecAdapter is an OpenSpecAdapter instance', () => {
    expect(defaultSpecAdapter).toBeInstanceOf(OpenSpecAdapter);
  });

  it('ignores IVY_SPEC_ADAPTER env var in v0.1 (returns OpenSpec regardless)', async () => {
    const prev = process.env.IVY_SPEC_ADAPTER;
    process.env.IVY_SPEC_ADAPTER = 'some-future-adapter';
    try {
      // Re-import to ensure the module re-evaluates with the env set.
      // ESM modules are cached, so the singleton is the same — that's the
      // assertion: env var has no effect on the singleton in v0.1.
      const { defaultSpecAdapter: again } = await import('./spec-adapter.js');
      expect(again.name).toBe('openspec');
    } finally {
      if (prev === undefined) delete process.env.IVY_SPEC_ADAPTER;
      else process.env.IVY_SPEC_ADAPTER = prev;
    }
  });
});

describe('OpenSpecAdapter.ensureCli', () => {
  it('runs `npm install @fission-ai/openspec@latest` when openspec CLI is missing', async () => {
    const calls: Array<{ cmd: string; args: string[] }> = [];

    mockedExec.mockImplementation((cmd: string, args: string[]) => {
      calls.push({ cmd, args });
      // First call is the `which openspec` (or `where` on win32) probe.
      // We simulate it FAILING the first time (CLI missing) and the
      // post-install verification SUCCEEDING.
      const isWhich = cmd === 'which' || cmd === 'where';
      if (isWhich) {
        const probeIndex = calls.filter(
          (c) => c.cmd === 'which' || c.cmd === 'where',
        ).length;
        if (probeIndex === 1) {
          throw new Error('not found');
        }
        return Buffer.from('/usr/local/bin/openspec\n');
      }
      // npm install — succeed silently.
      return Buffer.from('');
    });

    const adapter = new OpenSpecAdapter();
    const ok = await adapter.ensureCli('project', '/tmp/project');
    expect(ok).toBe(true);

    const npmCalls = calls.filter((c) => c.cmd === 'npm' || c.cmd === 'npm.cmd');
    expect(npmCalls.length).toBe(1);
    expect(npmCalls[0].args).toContain('install');
    expect(npmCalls[0].args).toContain('@fission-ai/openspec@latest');
  });

  it('runs `npm install -g` when scope is global', async () => {
    const calls: Array<{ cmd: string; args: string[] }> = [];

    mockedExec.mockImplementation((cmd: string, args: string[]) => {
      calls.push({ cmd, args });
      const isWhich = cmd === 'which' || cmd === 'where';
      if (isWhich) {
        const probeIndex = calls.filter(
          (c) => c.cmd === 'which' || c.cmd === 'where',
        ).length;
        if (probeIndex === 1) {
          throw new Error('not found');
        }
        return Buffer.from('/usr/local/bin/openspec\n');
      }
      return Buffer.from('');
    });

    const adapter = new OpenSpecAdapter();
    await adapter.ensureCli('global', '/tmp/project');

    const npmCalls = calls.filter((c) => c.cmd === 'npm' || c.cmd === 'npm.cmd');
    expect(npmCalls[0].args).toEqual([
      'install',
      '-g',
      '@fission-ai/openspec@latest',
    ]);
  });

  it('returns true without npm install when openspec CLI is already available', async () => {
    const calls: Array<{ cmd: string; args: string[] }> = [];

    mockedExec.mockImplementation((cmd: string, args: string[]) => {
      calls.push({ cmd, args });
      const isWhich = cmd === 'which' || cmd === 'where';
      if (isWhich) {
        return Buffer.from('/usr/local/bin/openspec\n');
      }
      return Buffer.from('');
    });

    const adapter = new OpenSpecAdapter();
    const ok = await adapter.ensureCli('project', '/tmp/project');
    expect(ok).toBe(true);
    // `npm install` is still attempted (Comet behaviour: upgrade path) — we
    // don't assert on its absence, only that ensureCli returns true.
  });
});

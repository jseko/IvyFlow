/**
 * Integration: real CouncilEngine wired into the CLI cross-project path (G2).
 * Seeds two sibling projects with memory and drives runCouncilAsk end-to-end.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runCouncilAsk } from './council.js';
import { MemoryStore } from '../core/memory-arch.js';

let root: string;
let projA: string;
let savedCwd: string;

beforeAll(async () => {
  savedCwd = process.cwd();
  root = mkdtempSync(join(tmpdir(), 'ivy-cli-'));
  const parent = join(root, 'ws');
  mkdirSync(parent, { recursive: true });

  for (const name of ['projA', 'projB']) {
    const pdir = join(parent, name);
    mkdirSync(join(pdir, '.ivy', 'memory'), { recursive: true });
    const store = new MemoryStore(pdir);
    await store.ensureSchema();
    await store.referenceV09Knowledge();
    await store.write({
      type: 'decision',
      title: 'Adopt React 18',
      timestamp: '2025-01-01T00:00:00.000Z',
      changeName: 'v1',
      source: 'm',
      content: 'Upgrade UI to React 18 for concurrency',
      tags: ['react'],
    });
    await store.write({
      type: 'risk',
      title: 'Regression risk',
      timestamp: '2025-01-02T00:00:00.000Z',
      changeName: 'v1',
      source: 'm',
      content: 'React 18 may break class components',
      tags: ['risk'],
    });
  }

  projA = join(parent, 'projA');
  process.chdir(projA);
});

afterAll(() => {
  process.chdir(savedCwd);
  rmSync(root, { recursive: true, force: true });
});

describe('runCouncilAsk --cross-project (G2 integration)', () => {
  it('should produce a real cross-project report from seeded memory', async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((m) => logs.push(String(m)));

    const code = await runCouncilAsk('react upgrade', { crossProject: true, format: 'text' });

    spy.mockRestore();
    const output = logs.join('\n');

    expect(code).toBe(0);
    // Both sibling projects discovered and analyzed (not stubbed to all-degraded)
    expect(output).toContain('projA');
    expect(output).toContain('projB');
    // Real concern text from memory appears
    expect(output).toContain('React 18');
    // At least one perspective is sufficiently sourced (not every line degraded)
    expect(output).not.toMatch(/无相关记忆[\s\S]*无相关记忆[\s\S]*无相关记忆[\s\S]*无相关记忆/);
  });
});

describe('runCouncilAsk --cross-project exit code (G3)', () => {
  it('should return exit code 1 when all perspectives are degraded', async () => {
    const saved = process.cwd();
    const root = mkdtempSync(join(tmpdir(), 'ivy-cli-deg-'));
    const parent = join(root, 'ws');
    mkdirSync(parent, { recursive: true });

    // Two sibling projects with memory dirs but NO records → fully degraded.
    for (const name of ['projX', 'projY']) {
      mkdirSync(join(parent, name, '.ivy', 'memory'), { recursive: true });
    }
    process.chdir(join(parent, 'projX'));

    try {
      const code = await runCouncilAsk('anything', { crossProject: true, format: 'text' });
      expect(code).toBe(1);
    } finally {
      process.chdir(saved);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should return exit code 0 when at least one perspective has data', async () => {
    const saved = process.cwd();
    const root = mkdtempSync(join(tmpdir(), 'ivy-cli-ok-'));
    const parent = join(root, 'ws');
    mkdirSync(parent, { recursive: true });

    for (const name of ['projX', 'projY']) {
      const pdir = join(parent, name);
      mkdirSync(join(pdir, '.ivy', 'memory'), { recursive: true });
      const store = new MemoryStore(pdir);
      await store.ensureSchema();
      await store.referenceV09Knowledge();
      await store.write({
        type: 'decision',
        title: 'Use Postgres',
        timestamp: '2025-02-01T00:00:00.000Z',
        changeName: 'v1',
        source: 'm',
        content: 'Standardize on Postgres for persistence',
        tags: ['db'],
      });
    }
    process.chdir(join(parent, 'projX'));

    try {
      const code = await runCouncilAsk('postgres', { crossProject: true, format: 'text' });
      expect(code).toBe(0);
    } finally {
      process.chdir(saved);
      rmSync(root, { recursive: true, force: true });
    }
  });
});

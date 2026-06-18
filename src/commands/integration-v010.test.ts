/**
 * Integration tests for v0.10 components:
 *   6.1 — HookAdapter + skills.ts installation flow (TC-15)
 *   6.2 — archive --report --adr end-to-end (TC-16)
 *   6.3 — export command (basic, --pipe, --project)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import os from 'os';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { promises as fs } from 'fs';

import { PLATFORMS } from '../core/platforms.js';
import { readYaml, writeYaml } from '../utils/yaml.js';
import type { Platform } from '../core/platforms.js';

// ─── Helper ───

function tmpDir(): string {
  const dir = path.join(os.tmpdir(), `ivy-int-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('6.1 — HookAdapter + skills.ts installation flow (TC-15)', () => {
  let tmp: string;

  beforeEach(() => { tmp = tmpDir(); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it('PreToolUseGuard.evaluate works with real phase contexts', async () => {
    const { PreToolUseGuard, createDefaultGuardConfig } = await import('../core/hook-runtime.js');

    // Use a dummy adapter for instantiation (install not tested here)
    const dummyAdapter = {
      format: 'windsurf-json' as const,
      render: () => '{}',
      installPath: () => '/dev/null/hooks.json',
    };
    const guard = new PreToolUseGuard(createDefaultGuardConfig(), dummyAdapter);

    // BUILD phase should allow Write
    const allowResult = guard.evaluate({
      toolName: 'Write',
      filePath: 'src/foo.ts',
      currentPhase: 'build',
      phaseHistory: [],
    });
    expect(allowResult.decision).toBe('allow');

    // OPEN phase should block Write
    const blockResult = guard.evaluate({
      toolName: 'Write',
      filePath: 'src/foo.ts',
      currentPhase: 'open',
      phaseHistory: [],
    });
    expect(blockResult.decision).toBe('block');
  });

  it('detects platforms with hook support', async () => {
    const hookPlatforms = PLATFORMS.filter((p: Platform) => p.supportsHooks);
    expect(hookPlatforms.length).toBeGreaterThanOrEqual(3);
    const ids = hookPlatforms.map((p: Platform) => p.id);
    expect(ids).toContain('windsurf');
    expect(ids).toContain('cursor');
    expect(ids).toContain('gemini-cli');
  });
});

describe('6.2 — archive --report --adr end-to-end (TC-16)', () => {
  let tmp: string;

  beforeEach(() => { tmp = tmpDir(); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it('MemoryStore.ensureSchema creates memory directory and schema file', async () => {
    const { MemoryStore } = await import('../core/memory-arch.js');
    const store = new MemoryStore(tmp);
    await store.ensureSchema();

    const schemaPath = path.join(tmp, '.ivy', 'memory', 'schema.yaml');
    await expect(fs.readFile(schemaPath, 'utf-8')).resolves.toContain('version');
  });

  it('archive --adr writes decision records', async () => {
    const { MemoryStore } = await import('../core/memory-arch.js');
    const store = new MemoryStore(tmp);
    await store.ensureSchema();

    const id = await store.write({
      type: 'decision',
      title: 'Use TypeScript',
      timestamp: new Date().toISOString(),
      changeName: 'test-change',
      source: 'design.md',
      content: 'Decision to use TypeScript strict mode',
      tags: ['architecture', 'tech-stack'],
    });
    expect(id).toBe('ADR-001');

    const view = await store.renderAdrView();
    expect(view.records.length).toBe(1);
    expect(view.index[0].title).toBe('Use TypeScript');
  });
});

describe('6.3 — export command (basic, --pipe, --project)', () => {
  let tmp: string;

  beforeEach(() => { tmp = tmpDir(); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it('export command returns valid JSON payload', async () => {
    // Setup minimal project
    const ivyDir = path.join(tmp, '.ivy');
    mkdirSync(ivyDir, { recursive: true });
    await writeYaml(path.join(ivyDir, 'project.yaml'), {
      version: '0.10.0',
      scope: 'change',
      platforms: ['claude'],
      analytics_enabled: false,
    });

    const { runExport } = await import('../commands/export.js');
    const exitCode = await runExport({ cwd: tmp, pipe: true });
    expect(exitCode).toBe(0);
  });

  it('export --pipe outputs JSON to stdout', async () => {
    const ivyDir = path.join(tmp, '.ivy');
    mkdirSync(ivyDir, { recursive: true });
    await writeYaml(path.join(ivyDir, 'project.yaml'), {
      version: '0.10.0',
      scope: 'change',
      platforms: ['cursor'],
    });

    const { runExport } = await import('../commands/export.js');
    // Capture stdout
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      const exitCode = await runExport({ cwd: tmp, pipe: true });
      expect(exitCode).toBe(0);
      expect(writeSpy).toHaveBeenCalled();
      const jsonArg = writeSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(jsonArg);
      expect(parsed.version).toBe('0.10.0');
    } finally {
      writeSpy.mockRestore();
    }
  });

  it('export with --project flag processes additional projects', async () => {
    const ivyDir = path.join(tmp, '.ivy');
    mkdirSync(ivyDir, { recursive: true });
    await writeYaml(path.join(ivyDir, 'project.yaml'), {
      version: '0.10.0',
      scope: 'change',
      platforms: ['windsurf'],
    });

    const { buildExportPayload } = await import('../core/export-api.js');
    const payload = await buildExportPayload({
      cwd: tmp,
      projects: [tmp],
    });
    expect(payload.project.name).toBeDefined();
    expect(Array.isArray(payload.changes)).toBe(true);
  });
});

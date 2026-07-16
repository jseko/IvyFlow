import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';

import { PreToolUseGuard, createDefaultGuardConfig, detectLegacyHookConfig, type PlatformHookAdapter } from './hook-runtime.js';
import type { PreToolUseGuardConfig, PreToolUseContext } from './types.js';

// ─── Mock Adapter ───

class MockAdapter implements PlatformHookAdapter {
  format = 'windsurf-json' as const;
  lastConfig?: PreToolUseGuardConfig;
  private basePath = '';

  setBasePath(p: string) { this.basePath = p; }

  render(config: PreToolUseGuardConfig): string {
    this.lastConfig = config;
    return JSON.stringify({ mock: true, rules: config.rules.length });
  }

  installPath(): string {
    return path.join(this.basePath, 'hook.json');
  }
}

// ─── PreToolUseGuard Tests ───

describe('PreToolUseGuard', () => {
  let guard: PreToolUseGuard;
  let adapter: MockAdapter;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-guard-'));
    adapter = new MockAdapter();
    adapter.setBasePath(tmpDir);
    guard = new PreToolUseGuard(createDefaultGuardConfig(), adapter);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('returns allow when tool matches allowed phase (TC-1)', () => {
    const ctx: PreToolUseContext = {
      toolName: 'Write',
      filePath: 'src/foo.ts',
      currentPhase: 'build',
    };
    expect(guard.evaluate(ctx)).toEqual({ decision: 'allow' });
  });

  it('returns block when tool is in disallowed phase (TC-2)', () => {
    const ctx: PreToolUseContext = {
      toolName: 'Write',
      filePath: 'src/foo.ts',
      currentPhase: 'open',
    };
    const result = guard.evaluate(ctx);
    expect(result.decision).toBe('block');
  });

  it('respects global block patterns (TC-3)', () => {
    const config: PreToolUseGuardConfig = {
      rules: [{ matcher: '**/*.md', allowedPhases: ['build'] }],
      globalBlock: ['ArchiveTool'],
    };
    guard = new PreToolUseGuard(config, adapter);
    const ctx: PreToolUseContext = {
      toolName: 'ArchiveTool',
      filePath: 'readme.md',
      currentPhase: 'build',
    };
    const result = guard.evaluate(ctx);
    expect(result.decision).toBe('block');
    if (result.decision === 'block') {
      expect(result.reason).toContain('globally blocked');
    }
  });

  it('evaluates phase-specific rules with glob matching (TC-4)', () => {
    const config: PreToolUseGuardConfig = {
      rules: [
        { matcher: '**/*.ts', allowedPhases: ['build'] },
        { matcher: '**/*.md', allowedPhases: ['design', 'build'] },
      ],
      globalBlock: [],
    };
    guard = new PreToolUseGuard(config, adapter);

    // .ts file in design phase → block
    const ctx1: PreToolUseContext = { toolName: 'Write', filePath: 'src/foo.ts', currentPhase: 'design' };
    expect(guard.evaluate(ctx1).decision).toBe('block');

    // .md file in design phase → allow
    const ctx2: PreToolUseContext = { toolName: 'Write', filePath: 'readme.md', currentPhase: 'design' };
    expect(guard.evaluate(ctx2).decision).toBe('allow');
  });

  it('blocks Write/Edit in archive phase as extra safety (TC-5)', () => {
    // Configure rules that explicitly allow archive, but archive guard still blocks Write/Edit
    const config: PreToolUseGuardConfig = {
      rules: [{ matcher: '**/*.ts', allowedPhases: ['build', 'verify', 'archive'] }],
      globalBlock: [],
    };
    guard = new PreToolUseGuard(config, adapter);
    const ctx: PreToolUseContext = {
      toolName: 'Write',
      filePath: 'src/foo.ts',
      currentPhase: 'archive',
    };
    const result = guard.evaluate(ctx);
    // Even though rules allow archive, the archive guard blocks Write/Edit
    expect(result.decision).toBe('block');
    if (result.decision === 'block') {
      expect(result.reason).toContain('modifications');
    }
  });

  it('allows non-Write/Edit tools in archive phase', () => {
    const config: PreToolUseGuardConfig = {
      rules: [{ matcher: '**/*.ts', allowedPhases: ['build', 'verify', 'archive'] }],
      globalBlock: [],
    };
    guard = new PreToolUseGuard(config, adapter);
    const ctx: PreToolUseContext = {
      toolName: 'Read',
      filePath: 'src/foo.ts',
      currentPhase: 'archive',
    };
    expect(guard.evaluate(ctx)).toEqual({ decision: 'allow' });
  });

  it('delegates render to adapter on install', async () => {
    const mockPlatform = {
      id: 'test', name: 'Test', skillsDir: '.test',
      openspecToolId: '', certification: 'certified' as const, tier: 3 as const,
      detectionPaths: [],
    };
    const result = await guard.install(mockPlatform, tmpDir);
    expect(result).toBe(path.join(tmpDir, 'hook.json'));

    const exists = await fs.stat(result).then(() => true).catch(() => false);
    expect(exists).toBe(true);
    expect(adapter.lastConfig).toBeDefined();
  });
});

// ─── Legacy Config Detection Tests (TC-8) ───

describe('detectLegacyHookConfig', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-legacy-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('detects v0.7+ Windsurf JSON format', async () => {
    const hookPath = path.join(tmpDir, 'ivy-phase-guard.json');
    await fs.writeFile(hookPath, JSON.stringify({
      name: 'ivy-phase-guard',
      event: 'PreToolUse',
      match: { tools: ['Edit', 'Write'] },
      command: 'ivy validate',
      blockOnNonZeroExit: true,
    }));
    const config = await detectLegacyHookConfig(hookPath);
    expect(config).not.toBeNull();
    expect(config!.rules).toHaveLength(1);
  });

  it('detects v0.8+ Cursor hooks.json format', async () => {
    const hookPath = path.join(tmpDir, 'hooks.json');
    await fs.writeFile(hookPath, JSON.stringify({
      version: 1,
      hooks: {
        preToolUse: [{ command: 'ivy validate', matcher: 'Edit|Write' }],
      },
    }));
    const config = await detectLegacyHookConfig(hookPath);
    expect(config).not.toBeNull();
    expect(config!.rules).toHaveLength(1);
  });

  it('returns null for non-existent file', async () => {
    const config = await detectLegacyHookConfig(path.join(tmpDir, 'nope.json'));
    expect(config).toBeNull();
  });

  it('returns null for invalid JSON', async () => {
    const hookPath = path.join(tmpDir, 'bad.json');
    await fs.writeFile(hookPath, 'not-json');
    const config = await detectLegacyHookConfig(hookPath);
    expect(config).toBeNull();
  });

  it('returns null for unrecognized JSON structure', async () => {
    const hookPath = path.join(tmpDir, 'unknown.json');
    await fs.writeFile(hookPath, JSON.stringify({ foo: 'bar' }));
    const config = await detectLegacyHookConfig(hookPath);
    expect(config).toBeNull();
  });
});

// ─── Default Config ───

describe('createDefaultGuardConfig', () => {
  it('creates a valid config with rules and empty globalBlock', () => {
    const config = createDefaultGuardConfig();
    expect(config.rules.length).toBeGreaterThanOrEqual(1);
    expect(config.rules.some((r) => r.allowedPhases.includes('build'))).toBe(true);
    expect(config.globalBlock).toEqual([]);
  });
});

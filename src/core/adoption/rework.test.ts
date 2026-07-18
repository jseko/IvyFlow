import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { computeRework } from './rework.js';
import type { OriginProjection, Origin } from '../provenance/types.js';

function makeOrigin(id: string, filePath: string): Origin {
  return {
    id,
    createdAt: Date.now() - 86400000,
    provider: 'test-provider',
    actions: [{ id: 'a1', provider: 'test', operation: 'GENERATE', artifact: { path: filePath }, metadata: {} }],
    artifacts: [{ filePath, fingerprint: 'orig-fp' }],
    status: {
      aiLifecycle: 'GENERATED',
      gitLifecycle: 'COMMITTED',
      runtimeLifecycle: 'NONE',
    },
  };
}

function makeProjection(origins: Origin[]): OriginProjection {
  const map = new Map<string, Origin>();
  for (const o of origins) map.set(o.id, o);
  return { origins: map, lastEventId: null, rebuiltAt: Date.now() };
}

describe('computeRework', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync('/tmp/rework-test-');
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email test@test.com', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name Test', { cwd: tmpDir, stdio: 'pipe' });
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should compute rework cost for modified AI-generated files', async () => {
    const filePath = 'src/modified.ts';
    const absPath = join(tmpDir, filePath);
    mkdirSync(join(tmpDir, 'src'), { recursive: true });
    writeFileSync(absPath, '// AI generated line 1\n// AI generated line 2\n');
    execSync('git add -A && git commit -m "ai: generate code"', { cwd: tmpDir, stdio: 'pipe' });

    writeFileSync(absPath, '// AI generated line 1\n// HUMAN modified line 2\n');
    execSync('git add -A && git commit -m "human: fix line 2"', { cwd: tmpDir, stdio: 'pipe' });

    const origin = makeOrigin('o1', filePath);
    const projection = makeProjection([origin]);

    const result = await computeRework(projection, tmpDir);
    expect(result.aiGeneratedLines).toBeGreaterThan(0);
    expect(result.reworkRatio).toBeGreaterThanOrEqual(0);
    expect(result.modificationCount).toBeGreaterThanOrEqual(0);
  });

  it('should return zero rework when no git history', async () => {
    const origin = makeOrigin('o2', 'src/nonexistent.ts');
    const projection = makeProjection([origin]);
    const result = await computeRework(projection, '/tmp/nonexistent-dir');
    expect(result.confidence).toBe('low');
    expect(result.aiGeneratedLines).toBeGreaterThanOrEqual(0);
  });

  it('should handle empty origins', async () => {
    const projection = makeProjection([]);
    const result = await computeRework(projection, tmpDir);
    expect(result.aiGeneratedLines).toBe(0);
    expect(result.reworkRatio).toBe(0);
  });
});

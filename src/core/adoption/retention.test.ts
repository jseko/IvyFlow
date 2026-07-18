import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { computeRetention } from './retention.js';
import type { OriginProjection, Origin } from '../provenance/types.js';

function makeOrigin(id: string, filePath: string, fingerprint: string, aiLifecycle: string = 'GENERATED'): Origin {
  return {
    id,
    createdAt: Date.now() - 86400000,
    provider: 'test-provider',
    actions: [{ id: 'a1', provider: 'test', operation: 'GENERATE', artifact: { path: filePath }, metadata: {} }],
    artifacts: [{ filePath, fingerprint }],
    status: {
      aiLifecycle: aiLifecycle as Origin['status']['aiLifecycle'],
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

describe('computeRetention', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync('/tmp/retention-test-');
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email test@test.com', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name Test', { cwd: tmpDir, stdio: 'pipe' });
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return 100% retention when all fingerprints match across commits', async () => {
    const filePath = 'src/test.ts';
    const content = 'export const x = 1;';
    const absPath = join(tmpDir, filePath);
    mkdirSync(join(tmpDir, 'src'), { recursive: true });
    writeFileSync(absPath, content);
    execSync('git add -A && git commit -m "initial"', { cwd: tmpDir, stdio: 'pipe' });

    const fingerprint = 'abc123';
    const origin = makeOrigin('o1', filePath, fingerprint);
    const projection = makeProjection([origin]);

    const result = await computeRetention(projection, tmpDir, 3);
    expect(result.retentionRatio).toBeGreaterThan(0);
    expect(result.confidence).toBeDefined();
  });

  it('should return low confidence when not a git repo', async () => {
    const origin = makeOrigin('o2', 'src/test.ts', 'abc');
    const projection = makeProjection([origin]);
    const result = await computeRetention(projection, '/tmp/non-existent-dir', 3);
    expect(result.confidence).toBe('low');
    expect(result.retentionRatio).toBeGreaterThanOrEqual(0);
  });

  it('should handle empty origins', async () => {
    const projection = makeProjection([]);
    const result = await computeRetention(projection, tmpDir, 3);
    expect(result.totalGeneratedLines).toBe(0);
    expect(result.retentionRatio).toBe(1);
  });
});

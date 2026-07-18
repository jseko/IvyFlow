import { describe, it, expect } from 'vitest';
import { computeCSI } from './context-intelligence.js';
import type { OriginProjection, Origin } from '../provenance/types.js';

function makeOrigin(
  id: string,
  filePath: string,
  operation: string = 'GENERATE',
): Origin {
  return {
    id,
    createdAt: Date.now() - 86400000,
    provider: 'test-provider',
    actions: [{ id: 'a1', provider: 'test', operation: operation as 'GENERATE' | 'EDIT' | 'DELETE', artifact: { path: filePath }, metadata: {} }],
    artifacts: [{ filePath, fingerprint: 'abc' }],
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

describe('computeCSI', () => {
  it('should return zero CSI for empty origins', async () => {
    const projection = makeProjection([]);
    const result = await computeCSI(projection);
    expect(result.csi).toBe(0);
    expect(result.taskType).toBe('GENERATE');
    expect(result.confidence).toBe('low');
  });
});

describe('computeCSI with data', () => {
  it('should compute CSI for GENERATE task type', async () => {
    const origins: Origin[] = [];
    for (let i = 0; i < 10; i++) {
      origins.push(makeOrigin(`o${i}`, `src/file${i}.ts`, 'GENERATE'));
    }
    const projection = makeProjection(origins);
    const result = await computeCSI(projection);
    expect(result.taskType).toBe('GENERATE');
    expect(result.csi).toBeGreaterThan(0);
    expect(result.csi).toBeLessThanOrEqual(1);
    expect(result.dimensions).toHaveLength(3);
  });

  it('should infer EDIT as dominant task type', async () => {
    const o1 = makeOrigin('o1', 'src/file1.ts', 'EDIT');
    const o2 = makeOrigin('o2', 'src/file2.ts', 'EDIT');
    const o3 = makeOrigin('o3', 'src/file3.ts', 'GENERATE');
    const projection = makeProjection([o1, o2, o3]);
    const result = await computeCSI(projection);
    expect(result.taskType).toBe('EDIT');
  });

  it('should infer DELETE as dominant task type', async () => {
    const o1 = makeOrigin('o1', 'src/file1.ts', 'DELETE');
    const projection = makeProjection([o1]);
    const result = await computeCSI(projection);
    expect(result.taskType).toBe('DELETE');
  });

  it('should return low confidence for fewer than 5 origins', async () => {
    const origin = makeOrigin('o1', 'src/file1.ts', 'GENERATE');
    const projection = makeProjection([origin]);
    const result = await computeCSI(projection);
    expect(result.confidence).toBe('low');
  });

  it('should return medium confidence for 5+ origins', async () => {
    const origins: Origin[] = [];
    for (let i = 0; i < 5; i++) {
      origins.push(makeOrigin(`o${i}`, `src/file${i}.ts`, 'GENERATE'));
    }
    const projection = makeProjection(origins);
    const result = await computeCSI(projection);
    expect(result.confidence).toBe('medium');
  });

  it('should have all three dimensions present', async () => {
    const origin = makeOrigin('o1', 'src/file1.ts', 'GENERATE');
    const projection = makeProjection([origin]);
    const result = await computeCSI(projection);
    const dimNames = result.dimensions.map((d) => d.dimension);
    expect(dimNames).toContain('codebaseContext');
    expect(dimNames).toContain('knowledgeContext');
    expect(dimNames).toContain('taskContext');
  });
});

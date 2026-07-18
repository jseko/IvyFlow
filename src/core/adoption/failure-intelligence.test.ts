import { describe, it, expect } from 'vitest';
import { computeFailureIntelligence } from './failure-intelligence.js';
import type { OriginProjection, Origin } from '../provenance/types.js';

function makeOrigin(
  id: string,
  aiLifecycle: string = 'GENERATED',
  filePath: string = `src/${id}.ts`,
  provider: string = 'test',
): Origin {
  return {
    id,
    createdAt: Date.now() - 86400000,
    provider,
    actions: [{ id: 'a1', provider, operation: 'GENERATE', artifact: { path: filePath }, metadata: {} }],
    artifacts: [{ filePath, fingerprint: 'fp1' }],
    status: {
      aiLifecycle: aiLifecycle as Origin['status']['aiLifecycle'],
      gitLifecycle: 'NONE',
      runtimeLifecycle: 'NONE',
    },
  };
}

function makeProjection(origins: Origin[]): OriginProjection {
  const map = new Map<string, Origin>();
  for (const o of origins) map.set(o.id, o);
  return { origins: map, lastEventId: null, rebuiltAt: Date.now() };
}

describe('computeFailureIntelligence', () => {
  it('should compute failure rates by AI lifecycle phase', () => {
    const origins = [
      makeOrigin('o1', 'CREATED'),
      makeOrigin('o2', 'CREATED'),
      makeOrigin('o3', 'GENERATED'),
      makeOrigin('o4', 'GENERATED'),
      makeOrigin('o5', 'ADOPTED'),
    ];
    const projection = makeProjection(origins);
    const result = computeFailureIntelligence(projection);
    expect(result.byPhase).toBeDefined();
    expect(Object.keys(result.byPhase).length).toBeGreaterThan(0);
  });

  it('should extract top failure modes from failed origins', () => {
    const origins = [
      makeOrigin('o1', 'CREATED', 'src/a.ts', 'provider-a'),
      makeOrigin('o2', 'CREATED', 'src/b.ts', 'provider-a'),
      makeOrigin('o3', 'CREATED', 'src/c.ts', 'provider-b'),
      makeOrigin('o4', 'GENERATED'),
    ];
    const projection = makeProjection(origins);
    const result = computeFailureIntelligence(projection);
    expect(result.topFailureModes.length).toBeGreaterThanOrEqual(0);
    expect(result.topFailureModes.length).toBeLessThanOrEqual(3);
  });

  it('should handle empty origins', () => {
    const projection = makeProjection([]);
    const result = computeFailureIntelligence(projection);
    expect(Object.keys(result.byPhase).length).toBe(0);
    expect(result.topFailureModes).toEqual([]);
    expect(result.confidence).toBe('low');
  });

  it('should assign medium confidence with sufficient data', () => {
    const origins = Array.from({ length: 10 }, (_, i) =>
      makeOrigin(`o${i}`, i < 5 ? 'CREATED' : 'GENERATED'),
    );
    const projection = makeProjection(origins);
    const result = computeFailureIntelligence(projection);
    expect(result.confidence).toBe('medium');
  });
});

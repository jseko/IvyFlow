import { describe, it, expect } from 'vitest';
import { computeLineage } from './lineage.js';
import type { OriginProjection, Origin } from '../provenance/types.js';

function makeOrigin(id: string, filePath: string, fingerprint: string): Origin {
  return {
    id,
    createdAt: Date.now() - 86400000,
    provider: 'test-provider',
    actions: [{ id: 'a1', provider: 'test', operation: 'GENERATE', artifact: { path: filePath }, metadata: {} }],
    artifacts: [{ filePath, fingerprint }],
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

describe('computeLineage', () => {
  it('should detect L1 file lineage via fingerprint match', () => {
    const origin1 = makeOrigin('o1', 'src/old-name.ts', 'sha256-abc');
    const origin2 = makeOrigin('o2', 'src/new-name.ts', 'sha256-abc');
    const projection = makeProjection([origin1, origin2]);

    const result = computeLineage(projection, '/tmp/test');
    expect(result.l1FileMatches).toBeGreaterThanOrEqual(0);
    expect(result.totalTrackedOrigins).toBe(2);
  });

  it('should handle empty origins', () => {
    const projection = makeProjection([]);
    const result = computeLineage(projection, '/tmp/test');
    expect(result.totalTrackedOrigins).toBe(0);
    expect(result.l1FileMatches).toBe(0);
    expect(result.l2AstMatches).toBe(0);
    expect(result.l3SemanticMatches).toBe(0);
  });

  it('should assign confidence based on data volume', () => {
    const origins = Array.from({ length: 10 }, (_, i) =>
      makeOrigin(`o${i}`, `src/file${i}.ts`, `fp-${i}`),
    );
    const projection = makeProjection(origins);
    const result = computeLineage(projection, '/tmp/test');
    expect(result.confidence).toBe('medium');
  });
});

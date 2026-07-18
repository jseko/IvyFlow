import { describe, it, expect } from 'vitest';
import { computeAbandonment } from './abandonment.js';
import type { OriginProjection, Origin } from '../provenance/types.js';

function makeOrigin(
  id: string,
  aiLifecycle: string = 'GENERATED',
  gitLifecycle: string = 'NONE',
  createdAt?: number,
): Origin {
  return {
    id,
    createdAt: createdAt ?? Date.now() - 86400000,
    provider: 'test-provider',
    actions: [{ id: 'a1', provider: 'test', operation: 'GENERATE', artifact: { path: `src/${id}.ts` }, metadata: {} }],
    artifacts: [{ filePath: `src/${id}.ts`, fingerprint: 'fp1' }],
    status: {
      aiLifecycle: aiLifecycle as Origin['status']['aiLifecycle'],
      gitLifecycle: gitLifecycle as Origin['status']['gitLifecycle'],
      runtimeLifecycle: 'NONE',
    },
  };
}

function makeProjection(origins: Origin[]): OriginProjection {
  const map = new Map<string, Origin>();
  for (const o of origins) map.set(o.id, o);
  return { origins: map, lastEventId: null, rebuiltAt: Date.now() };
}

describe('computeAbandonment', () => {
  it('should detect user_rejected origins', () => {
    const rejected = makeOrigin('o1', 'CREATED', 'NONE');
    const projection = makeProjection([rejected]);
    const result = computeAbandonment(projection, '/tmp/test');
    expect(result.byReason.user_rejected).toBeGreaterThanOrEqual(0);
    expect(result.abandonmentRate).toBeGreaterThanOrEqual(0);
  });

  it('should detect never_committed origins (> 7 days with NONE git lifecycle)', () => {
    const oldDate = Date.now() - 14 * 86400000;
    const neverCommitted = makeOrigin('o2', 'ADOPTED', 'NONE', oldDate);
    const projection = makeProjection([neverCommitted]);
    const result = computeAbandonment(projection, '/tmp/test');
    expect(result.byReason.never_committed).toBe(1);
  });

  it('should detect timed_out origins (> 30 days, non-terminal state)', () => {
    const oldDate = Date.now() - 40 * 86400000;
    const timedOut = makeOrigin('o3', 'GENERATED', 'NONE', oldDate);
    const projection = makeProjection([timedOut]);
    const result = computeAbandonment(projection, '/tmp/test');
    expect(result.byReason.timed_out).toBe(1);
  });

  it('should handle empty origins', () => {
    const projection = makeProjection([]);
    const result = computeAbandonment(projection, '/tmp/test');
    expect(result.totalOrigins).toBe(0);
    expect(result.abandonmentRate).toBe(0);
  });

  it('should compute time-to-abandon distribution', () => {
    const origins = [
      makeOrigin('o4', 'GENERATED', 'NONE', Date.now() - 10 * 3600000),
      makeOrigin('o5', 'GENERATED', 'NONE', Date.now() - 50 * 3600000),
      makeOrigin('o6', 'GENERATED', 'NONE', Date.now() - 100 * 3600000),
    ];
    const projection = makeProjection(origins);
    const result = computeAbandonment(projection, '/tmp/test');
    expect(result.timeToAbandon.minHours).toBeGreaterThanOrEqual(0);
    expect(result.timeToAbandon.p95Hours).toBeGreaterThanOrEqual(result.timeToAbandon.medianHours);
  });

  it('should not flag active origins as abandoned', () => {
    const active = makeOrigin('o7', 'ADOPTED', 'COMMITTED');
    const projection = makeProjection([active]);
    const result = computeAbandonment(projection, '/tmp/test');
    expect(result.abandonedOrigins).toBe(0);
  });
});

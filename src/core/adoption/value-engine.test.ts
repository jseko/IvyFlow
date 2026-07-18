import { describe, it, expect } from 'vitest';
import { computeValueIndex } from './value-engine.js';
import type { OriginProjection, Origin } from '../provenance/types.js';

function makeOrigin(
  id: string,
  filePath: string,
  fingerprint: string,
  aiLifecycle: string = 'GENERATED',
): Origin {
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

describe('computeValueIndex', () => {
  it('should return default valueIndex when origins is empty', async () => {
    const projection = makeProjection([]);
    const result = await computeValueIndex(projection, '/tmp/test', 5);
    expect(result.valueIndex).toBe(0);
    expect(result.businessImpactType).toBe('unknown');
  });

  it('should classify payment path with weight 2.0', async () => {
    const origin = makeOrigin('o1', 'src/payment/checkout.ts', 'abc');
    const projection = makeProjection([origin]);
    const result = await computeValueIndex(projection, '/tmp/test', 5);
    expect(result.businessImpactType).toBe('payment');
    expect(result.businessImpactWeight).toBe(2.0);
  });

  it('should classify security path with weight 2.0', async () => {
    const origin = makeOrigin('o1', 'src/auth/login.ts', 'abc');
    const projection = makeProjection([origin]);
    const result = await computeValueIndex(projection, '/tmp/test', 5);
    expect(result.businessImpactType).toBe('security');
    expect(result.businessImpactWeight).toBe(2.0);
  });

  it('should pick highest weight when multiple patterns match', async () => {
    const o1 = makeOrigin('o1', 'src/payment/billing.ts', 'abc');
    const o2 = makeOrigin('o2', 'src/infra/config.ts', 'def');
    const projection = makeProjection([o1, o2]);
    const result = await computeValueIndex(projection, '/tmp/test', 5);
    expect(result.businessImpactType).toBe('payment');
    expect(result.businessImpactWeight).toBe(2.0);
  });

  it('should default to unknown with weight 1.0 for unmatched path', async () => {
    const origin = makeOrigin('o1', 'src/utils/helper.ts', 'abc');
    const projection = makeProjection([origin]);
    const result = await computeValueIndex(projection, '/tmp/test', 5);
    expect(result.businessImpactType).toBe('unknown');
    expect(result.businessImpactWeight).toBe(1.0);
  });

  it('should compute valueIndex > 0 when origins exist', async () => {
    const origin = makeOrigin('o1', 'src/core/service.ts', 'abc');
    const projection = makeProjection([origin]);
    const result = await computeValueIndex(projection, '/tmp/test', 5);
    expect(result.valueIndex).toBeGreaterThan(0);
    expect(result.qualityFactor).toBeGreaterThanOrEqual(0);
    expect(result.retentionRatio).toBeGreaterThanOrEqual(0);
  });
});

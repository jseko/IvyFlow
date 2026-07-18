import { describe, it, expect } from 'vitest';
import { inferFeedback } from './feedback-loop.js';
import type { OriginProjection, Origin } from '../provenance/types.js';

function makeOrigin(
  id: string,
  filePath: string,
  aiLifecycle: string = 'GENERATED',
  gitLifecycle: string = 'COMMITTED',
): Origin {
  return {
    id,
    createdAt: Date.now() - 86400000,
    provider: 'test-provider',
    actions: [{ id: 'a1', provider: 'test', operation: 'GENERATE', artifact: { path: filePath }, metadata: {} }],
    artifacts: [{ filePath, fingerprint: 'abc' }],
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

describe('inferFeedback', () => {
  it('should return empty summary for empty origins', async () => {
    const projection = makeProjection([]);
    const result = await inferFeedback(projection, '/tmp/test');
    expect(result.entries).toHaveLength(0);
    expect(result.summary.acceptedAndKept).toBe(0);
  });

  it('should return unknown for non-git project', async () => {
    const origin = makeOrigin('o1', 'src/test.ts');
    const projection = makeProjection([origin]);
    const result = await inferFeedback(projection, '/tmp/nonexistent');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].type).toBe('unknown');
  });
});

describe('inferFeedback summary structure', () => {
  it('should have correct summary keys', async () => {
    const origin = makeOrigin('o1', 'src/test.ts');
    const projection = makeProjection([origin]);
    const result = await inferFeedback(projection, '/tmp/nonexistent');
    expect(result.summary).toHaveProperty('acceptedAndKept');
    expect(result.summary).toHaveProperty('acceptedThenModified');
    expect(result.summary).toHaveProperty('acceptedThenDeleted');
    expect(result.summary).toHaveProperty('rejectedOutright');
    expect(result.summary).toHaveProperty('unknown');
  });

  it('should assign confidence to each entry', async () => {
    const origin = makeOrigin('o1', 'src/test.ts');
    const projection = makeProjection([origin]);
    const result = await inferFeedback(projection, '/tmp/nonexistent');
    for (const entry of result.entries) {
      expect(['low', 'medium']).toContain(entry.confidence);
    }
  });

  it('should include commitsSince in each entry', async () => {
    const origin = makeOrigin('o1', 'src/test.ts');
    const projection = makeProjection([origin]);
    const result = await inferFeedback(projection, '/tmp/nonexistent');
    for (const entry of result.entries) {
      expect(typeof entry.commitsSince).toBe('number');
    }
  });
});

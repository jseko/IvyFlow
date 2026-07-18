import { describe, it, expect } from 'vitest';
import { AdoptionEngineV2, type AdoptionProfile } from './adoption-engine.js';
import { JSONLEventStore } from './provenance/event-store-jsonl.js';

describe('AdoptionEngineV2.computeProfile', () => {
  it('should compute profile with all V2 fields from provenance data', async () => {
    const store = new JSONLEventStore('/tmp/nonexistent-v2-test');
    const engine = new AdoptionEngineV2(store);
    const profile = await engine.computeProfile({
      projectPath: '/tmp/nonexistent-v2-test',
      changeName: 'test-change',
      periodDays: 30,
    });

    expect(profile.changeName).toBe('test-change');
    expect(profile.retention).toBeDefined();
    expect(profile.rework).toBeDefined();
    expect(profile.abandonment).toBeDefined();
    expect(profile.lineage).toBeDefined();
    expect(profile.failureIntelligence).toBeDefined();
    expect(profile.funnel.totalChanges).toBe(0);
  });

  it('should default changeName to "all" when not provided', async () => {
    const store = new JSONLEventStore('/tmp/nonexistent-v2-test-2');
    const engine = new AdoptionEngineV2(store);
    const profile = await engine.computeProfile({
      projectPath: '/tmp/nonexistent-v2-test-2',
    });
    expect(profile.changeName).toBe('all');
  });
});

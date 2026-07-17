import { describe, it, expect } from 'vitest';

describe('Core Provenance Types', () => {
  it('AIAction type has required fields', () => {
    const action = {
      id: 'act_001',
      provider: 'claude-code',
      operation: 'GENERATE' as const,
      artifact: { path: 'src/index.ts' },
      metadata: { toolName: 'Write' },
    };
    expect(action.operation).toBe('GENERATE');
    expect(action.artifact.path).toBe('src/index.ts');
    expect(action.provider).toBe('claude-code');
  });

  it('Origin type has required fields', () => {
    const origin = {
      id: 'orig_001',
      createdAt: Date.now(),
      provider: 'claude-code',
      actions: [],
      artifacts: [],
      status: {
        aiLifecycle: 'CREATED' as const,
        gitLifecycle: 'NONE' as const,
        runtimeLifecycle: 'NONE' as const,
      },
    };
    expect(origin.status.aiLifecycle).toBe('CREATED');
    expect(origin.status.gitLifecycle).toBe('NONE');
    expect(origin.status.runtimeLifecycle).toBe('NONE');
  });

  it('OriginEvent type has required fields', () => {
    const event = {
      eventId: 'evt_001',
      type: 'origin_created' as const,
      originId: 'orig_001',
      timestamp: Date.now(),
      payload: {},
    };
    expect(event.type).toBe('origin_created');
    expect(event.originId).toBe('orig_001');
  });

  it('OriginProjection holds current state', () => {
    const projection = {
      origins: new Map(),
      lastEventId: 'evt_001',
      rebuiltAt: Date.now(),
    };
    expect(projection.origins.size).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import { createOrigin, addAction, addArtifact, getStatus, generateOriginId } from './origin.js';
import type { AIAction, CodeArtifact } from './types.js';

describe('Origin Entity', () => {
  it('generateOriginId produces prefixed hex string', () => {
    const id = generateOriginId();
    expect(id).toMatch(/^orig_[0-9a-f]{16}$/);
  });

  it('generateOriginId produces unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateOriginId()));
    expect(ids.size).toBe(100);
  });

  it('createOrigin returns a new Origin with CREATED status', () => {
    const origin = createOrigin('claude-code');
    expect(origin.id).toMatch(/^orig_/);
    expect(origin.provider).toBe('claude-code');
    expect(origin.createdAt).toBeGreaterThan(0);
    expect(origin.actions).toEqual([]);
    expect(origin.artifacts).toEqual([]);
    expect(origin.status.aiLifecycle).toBe('CREATED');
    expect(origin.status.gitLifecycle).toBe('NONE');
    expect(origin.status.runtimeLifecycle).toBe('NONE');
  });

  it('addAction appends an AIAction to the origin', () => {
    const origin = createOrigin('claude-code');
    const action: AIAction = {
      id: 'act_001',
      provider: 'claude-code',
      operation: 'GENERATE',
      artifact: { path: 'src/hello.ts' },
      metadata: {},
    };
    const updated = addAction(origin, action);
    expect(updated.actions.length).toBe(1);
    expect(updated.actions[0].id).toBe('act_001');
  });

  it('addAction does not mutate the original origin', () => {
    const origin = createOrigin('claude-code');
    addAction(origin, {
      id: 'act_001',
      provider: 'claude-code',
      operation: 'GENERATE',
      artifact: { path: 'src/hello.ts' },
      metadata: {},
    });
    expect(origin.actions.length).toBe(0);
  });

  it('addArtifact appends a CodeArtifact to the origin', () => {
    const origin = createOrigin('claude-code');
    const artifact: CodeArtifact = {
      filePath: 'src/hello.ts',
      fingerprint: 'abc123',
    };
    const updated = addArtifact(origin, artifact);
    expect(updated.artifacts.length).toBe(1);
    expect(updated.artifacts[0].filePath).toBe('src/hello.ts');
  });

  it('addArtifact does not mutate the original origin', () => {
    const origin = createOrigin('claude-code');
    addArtifact(origin, {
      filePath: 'src/hello.ts',
      fingerprint: 'abc123',
    });
    expect(origin.artifacts.length).toBe(0);
  });

  it('getStatus returns current OriginStatus', () => {
    const origin = createOrigin('claude-code');
    const status = getStatus(origin);
    expect(status.aiLifecycle).toBe('CREATED');
    expect(status.gitLifecycle).toBe('NONE');
    expect(status.runtimeLifecycle).toBe('NONE');
  });
});

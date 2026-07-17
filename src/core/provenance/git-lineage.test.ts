import { describe, it, expect } from 'vitest';
import { NoopGitLineageResolver } from './git-lineage.js';
import type { CodeArtifact } from './types.js';

describe('GitLineageResolver', () => {
  const resolver = new NoopGitLineageResolver();

  it('resolve returns artifact with undefined git', async () => {
    const artifact: CodeArtifact = {
      filePath: 'src/hello.ts',
      fingerprint: 'abc123',
    };
    const result = await resolver.resolve(artifact);
    expect(result.git).toBeUndefined();
  });

  it('resolve preserves filePath and fingerprint', async () => {
    const artifact: CodeArtifact = {
      filePath: 'src/hello.ts',
      fingerprint: 'abc123',
    };
    const result = await resolver.resolve(artifact);
    expect(result.filePath).toBe('src/hello.ts');
    expect(result.fingerprint).toBe('abc123');
  });
});

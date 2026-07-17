import type { CodeArtifact } from './types.js';

export interface GitLineageResolver {
  resolve(artifact: CodeArtifact): Promise<CodeArtifact>;
}

export class NoopGitLineageResolver implements GitLineageResolver {
  async resolve(artifact: CodeArtifact): Promise<CodeArtifact> {
    return { ...artifact };
  }
}

import type { OriginProjection } from '../provenance/types.js';
import type { LineageMetrics } from '../adoption-engine.js';

export function computeLineage(
  projection: OriginProjection,
  _projectPath: string,
): LineageMetrics {
  const origins = [...projection.origins.values()];
  if (origins.length === 0) {
    return {
      l1FileMatches: 0,
      l2AstMatches: 0,
      l3SemanticMatches: 0,
      totalTrackedOrigins: 0,
      confidence: 'low',
    };
  }

  const fingerprintMap = new Map<string, string[]>();

  for (const origin of origins) {
    for (const artifact of origin.artifacts) {
      const existing = fingerprintMap.get(artifact.fingerprint) ?? [];
      existing.push(artifact.filePath);
      fingerprintMap.set(artifact.fingerprint, existing);
    }
  }

  let l1FileMatches = 0;
  let l2AstMatches = 0;
  let l3SemanticMatches = 0;

  for (const [, paths] of fingerprintMap) {
    if (paths.length > 1) {
      l1FileMatches += paths.length - 1;
    }
  }

  return {
    l1FileMatches,
    l2AstMatches,
    l3SemanticMatches,
    totalTrackedOrigins: origins.length,
    confidence: origins.length >= 5 ? 'medium' : 'low',
  };
}

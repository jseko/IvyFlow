import type { OriginProjection, Origin } from '../provenance/types.js';
import type { FailureMetrics, FailureMode } from '../adoption-engine.js';

interface PhaseCounts {
  total: number;
  failed: number;
}

function isFailed(origin: Origin): boolean {
  const s = origin.status;
  return (
    s.aiLifecycle === 'CREATED' ||
    (s.aiLifecycle === 'GENERATED' && s.gitLifecycle === 'NONE') ||
    (s.aiLifecycle === 'ADOPTED' && s.gitLifecycle === 'NONE')
  );
}

function extractTopFailureModes(failedOrigins: Origin[]): FailureMode[] {
  const providerCounts = new Map<string, number>();
  const fileCounts = new Map<string, number>();

  for (const origin of failedOrigins) {
    const provider = origin.provider;
    providerCounts.set(provider, (providerCounts.get(provider) ?? 0) + 1);

    for (const artifact of origin.artifacts) {
      fileCounts.set(artifact.filePath, (fileCounts.get(artifact.filePath) ?? 0) + 1);
    }
  }

  const modes: FailureMode[] = [];

  const sortedProviders = [...providerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);
  for (const [provider, count] of sortedProviders) {
    modes.push({
      pattern: `Provider: ${provider}`,
      count,
      phase: 'CREATED',
      affectedFiles: [],
    });
  }

  const sortedFiles = [...fileCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 1);
  for (const [file, count] of sortedFiles) {
    modes.push({
      pattern: `File: ${file}`,
      count,
      phase: 'CREATED',
      affectedFiles: [file],
    });
  }

  return modes.slice(0, 3);
}

export function computeFailureIntelligence(
  projection: OriginProjection,
): FailureMetrics {
  const origins = [...projection.origins.values()];
  if (origins.length === 0) {
    return {
      byPhase: {},
      topFailureModes: [],
      confidence: 'low',
    };
  }

  const byPhase = new Map<string, PhaseCounts>();
  const failedOrigins: Origin[] = [];

  for (const origin of origins) {
    const phase = origin.status.aiLifecycle;
    const entry = byPhase.get(phase) ?? { total: 0, failed: 0 };
    entry.total++;

    if (isFailed(origin)) {
      entry.failed++;
      failedOrigins.push(origin);
    }

    byPhase.set(phase, entry);
  }

  const phaseResult: Record<string, { total: number; failed: number; rate: number }> = {};
  for (const [phase, counts] of byPhase) {
    phaseResult[phase] = {
      total: counts.total,
      failed: counts.failed,
      rate: counts.total > 0 ? counts.failed / counts.total : 0,
    };
  }

  const topFailureModes = extractTopFailureModes(failedOrigins);

  return {
    byPhase: phaseResult,
    topFailureModes,
    confidence: origins.length >= 5 ? 'medium' : 'low',
  };
}

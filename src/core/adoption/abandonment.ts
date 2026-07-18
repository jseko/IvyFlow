import type { OriginProjection, Origin } from '../provenance/types.js';
import type { AbandonmentReason, AbandonmentMetrics } from '../adoption-engine.js';

const NEVER_COMMITTED_DAYS = 7;
const TIMED_OUT_DAYS = 30;

function detectAbandonmentReason(origin: Origin, nowMs: number): AbandonmentReason | null {
  const ageMs = nowMs - origin.createdAt;
  const ageDays = ageMs / 86400000;

  if (origin.status.aiLifecycle === 'CREATED') {
    return 'user_rejected';
  }

  if (origin.status.aiLifecycle === 'ADOPTED' && origin.status.gitLifecycle === 'NONE' && ageDays > NEVER_COMMITTED_DAYS) {
    return 'never_committed';
  }

  if (
    origin.status.aiLifecycle !== 'ARCHIVED' &&
    origin.status.gitLifecycle === 'NONE' &&
    origin.status.runtimeLifecycle === 'NONE' &&
    ageDays > TIMED_OUT_DAYS
  ) {
    return 'timed_out';
  }

  return null;
}

function computeTimeToAbandonHours(origins: Origin[], abandoned: Map<string, AbandonmentReason>, nowMs: number): number[] {
  const hours: number[] = [];
  for (const origin of origins) {
    if (abandoned.has(origin.id)) {
      hours.push((nowMs - origin.createdAt) / 3600000);
    }
  }
  return hours.sort((a, b) => a - b);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

export function computeAbandonment(
  projection: OriginProjection,
  _projectPath: string,
): AbandonmentMetrics {
  const origins = [...projection.origins.values()];
  const nowMs = Date.now();
  const abandoned = new Map<string, AbandonmentReason>();

  const byReason: Record<AbandonmentReason, number> = {
    user_rejected: 0,
    never_committed: 0,
    deleted_before_merge: 0,
    reverted: 0,
    refactored_away: 0,
    replaced_by_human: 0,
    timed_out: 0,
    unknown: 0,
  };

  for (const origin of origins) {
    const reason = detectAbandonmentReason(origin, nowMs);
    if (reason) {
      abandoned.set(origin.id, reason);
      byReason[reason]++;
    }
  }

  const abandonedOrigins = abandoned.size;
  const abandonmentRate = origins.length > 0 ? abandonedOrigins / origins.length : 0;
  const hours = computeTimeToAbandonHours(origins, abandoned, nowMs);

  return {
    totalOrigins: origins.length,
    abandonedOrigins,
    abandonmentRate,
    byReason,
    timeToAbandon: {
      minHours: hours.length > 0 ? hours[0] : 0,
      maxHours: hours.length > 0 ? hours[hours.length - 1] : 0,
      medianHours: percentile(hours, 50),
      p95Hours: percentile(hours, 95),
    },
    confidence: origins.length >= 5 ? 'medium' : 'low',
  };
}

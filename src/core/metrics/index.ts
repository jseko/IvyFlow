/**
 * Metric Layer — unified query interface (v0.8).
 *
 * Central entry point for all metric queries. Dispatches to change-metrics
 * or project-metrics based on scope. Read-only — never writes to L1/L2.
 *
 * Consumers (analytics, dashboard, team-insights) import MetricQuery from
 * here instead of reading events.jsonl directly.
 */

import type { MetricQueryInput, MetricResult } from './types.js';
import { queryChangeMetrics } from './change-metrics.js';
import { queryProjectMetrics } from './project-metrics.js';

export type { MetricQueryInput, MetricResult, MetricScope, MetricName } from './types.js';

/**
 * Unified metric query interface.
 * Returns empty array gracefully for no-data projects — never throws.
 */
export async function MetricQuery(input: MetricQueryInput): Promise<MetricResult[]> {
  try {
    if (input.scope === 'change' && input.changeName) {
      return await queryChangeMetrics(
        process.cwd(),
        input.changeName,
        input.metrics,
      );
    }

    if (input.scope === 'project' || input.scope === 'team') {
      return await queryProjectMetrics(
        process.cwd(),
        input.metrics,
      );
    }

    return [];
  } catch {
    // Graceful degradation: no data → empty array
    return [];
  }
}

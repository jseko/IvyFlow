/**
 * Project-level metric queries (v0.8).
 *
 * Aggregates metrics across all changes in a project.
 * Read-only — never writes to L1/L2 or triggers side effects.
 */

import { readRawEvents } from '../sessions.js';
import type { MetricResult, MetricName } from './types.js';

export async function queryProjectMetrics(
  projectPath: string,
  metrics: MetricName[],
): Promise<MetricResult[]> {
  const events: import('../sessions.js').RawEvent[] = [];
  for await (const e of readRawEvents(projectPath)) {
    events.push(e);
  }
  const changeNames: string[] = [...new Set(events.map((e) => e.change))];
  const results: MetricResult[] = [];

  for (const metric of metrics) {
    switch (metric) {
      case 'completion_rate': {
        for (const change of changeNames) {
          const transitions = events.filter((e) => e.change === change && e.event === 'phase_transition');
          const archived = transitions.some((t) => (t.meta?.to as string) === 'archive');
          results.push({
            change,
            phase: 'all',
            metric: 'completion_rate',
            value: archived ? 100 : 0,
            label: archived ? 'completed' : 'active',
          });
        }
        break;
      }

      case 'commit_frequency': {
        const commitCount = events.filter((e) => e.event === 'git_commit').length;
        results.push({
          change: '__project__',
          phase: 'all',
          metric: 'commit_frequency',
          value: commitCount,
          label: `${commitCount} total commits`,
        });
        break;
      }

      case 'active_changes': {
        const phaseEvents = events.filter((e: { event: string }) => e.event === 'phase_transition');
        const archivedChanges = new Set(
          phaseEvents
            .filter((t: { meta?: Record<string, unknown> }) => (t.meta?.to as string) === 'archive')
            .map((t: { change: string }) => t.change),
        );
        const active = changeNames.filter((c: string) => !archivedChanges.has(c));
        const completed = changeNames.filter((c: string) => archivedChanges.has(c));
        results.push({
          change: '__project__',
          phase: 'all',
          metric: 'active_changes',
          value: active.length,
          label: `${active.length} active, ${completed.length} completed`,
        });
        break;
      }

      default:
        break;
    }
  }

  return results;
}

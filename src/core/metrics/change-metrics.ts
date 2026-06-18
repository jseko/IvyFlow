/**
 * Change-level metric queries (v0.8).
 *
 * Computes metrics scoped to a single change by reading events.jsonl.
 * Read-only — never writes to L1/L2 or triggers side effects.
 */

import { readRawEvents } from '../sessions.js';
import type { MetricResult, MetricName } from './types.js';

export async function queryChangeMetrics(
  projectPath: string,
  changeName: string,
  metrics: MetricName[],
): Promise<MetricResult[]> {
  const allEvents: import('../sessions.js').RawEvent[] = [];
  for await (const e of readRawEvents(projectPath)) {
    allEvents.push(e);
  }
  const changeEvents = allEvents.filter((e) => e.change === changeName);
  const results: MetricResult[] = [];

  for (const metric of metrics) {
    switch (metric) {
      case 'phase_durations': {
        const phases = changeEvents
          .filter((e) => e.event === 'phase_transition')
          .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
        for (let i = 1; i < phases.length; i++) {
          const days = (new Date(phases[i].ts).getTime() - new Date(phases[i - 1].ts).getTime()) / 86400000;
          results.push({
            change: changeName,
            phase: phases[i].meta?.toPhase as string ?? 'unknown',
            metric: 'phase_durations',
            value: Math.round(days * 10) / 10,
            label: `${Math.round(days)}d`,
          });
        }
        break;
      }

      case 'commit_frequency': {
        const commits = changeEvents.filter((e) => e.event === 'git_commit');
        results.push({
          change: changeName,
          phase: 'all',
          metric: 'commit_frequency',
          value: commits.length,
          label: `${commits.length} commits`,
        });
        break;
      }

      case 'completion_rate': {
        const transitions = changeEvents.filter((e) => e.event === 'phase_transition');
        const transitionsToArchive = transitions.filter(
          (t) => (t.meta?.to as string) === 'archive',
        );
        results.push({
          change: changeName,
          phase: 'all',
          metric: 'completion_rate',
          value: transitionsToArchive.length > 0 ? 100 : 0,
          label: transitionsToArchive.length > 0 ? 'completed' : 'in_progress',
        });
        break;
      }

      default:
        // Unsupported metric at change scope — skip
        break;
    }
  }

  return results;
}

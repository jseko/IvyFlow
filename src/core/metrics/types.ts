/**
 * Metric Layer — type definitions (v0.8).
 *
 * Shared types for MetricQuery and MetricResult consumed by
 * analytics/dashboard/team-insights through the unified query interface.
 */

export type MetricScope = 'change' | 'project' | 'team';

export type MetricName =
  | 'phase_durations'
  | 'suggestion_acceptance'
  | 'completion_rate'
  | 'commit_frequency'
  | 'active_changes'
  | 'bottleneck_phases';

export interface MetricQueryInput {
  scope: MetricScope;
  changeName?: string;
  timeRange?: { from: Date; to: Date };
  metrics: MetricName[];
}

export interface MetricResult {
  change: string;
  phase: string;
  metric: string;
  value: number;
  label: string;
  metadata?: Record<string, unknown>;
}

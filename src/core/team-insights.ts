/**
 * Team Insights — cross-change aggregation and bottleneck detection (v0.8).
 *
 * Reads L1 raw events directly (not through MetricQuery) and computes
 * team-level metrics: phase durations, bottlenecks, P80 WIP limits, trends.
 *
 * Non-causal annotation: ALL bottleneck comparisons and trend outputs are
 * correlation observations, not causal conclusions. See §9.13.
 */

import { readRawEvents, type RawEvent } from './sessions.js';

// ─── Types ───

export interface TeamInsight {
  /** Absolute path to the project. */
  projectPath: string;
  /** Total number of unique changes seen across all events. */
  totalChanges: number;
  /** Number of changes that have NOT reached the archive phase. */
  activeChanges: number;
  /** Number of changes that have reached the archive phase. */
  completedChanges: number;
  /**
   * Average duration (in days) spent in each phase, computed across all changes
   * that have data for that phase. Correlation observation: these averages
   * describe historical patterns, not causal relationships.
   */
  avgPhaseDurations: Record<string, number>;
  /**
   * Phases where the overall average duration exceeds the baseline.
   * Baseline = avg completed-change duration * 0.75 (or hardcoded default).
   * Correlation observation: slower phases may or may not be actual blockers.
   */
  bottleneckPhases: Array<{
    phase: string;
    avgDuration: number;
    vsBaseline: number;
    affectedChanges: string[];
    severity: 'info' | 'warning' | 'critical';
  }>;
  /** Average calendar days from first event to archive for completed changes. */
  avgCompletionDays: number;
  /**
   * P80 of historical weekly active change counts.
   * Correlation observation: a statistical summary, not a capacity prescription.
   */
  recommendedActiveChanges: number;
  /**
   * Direction of completion rate over the last 4 weeks.
   * Correlation observation: trends describe past patterns, not future guarantees.
   */
  completionTrend: 'improving' | 'stable' | 'declining';
  /**
   * Total number of suggestions generated (currently 0 — suggestion events
   * are not yet captured as L1 raw events).
   */
  totalSuggestions: number;
  /**
   * Fraction of suggestions that were accepted (currently 0 — suggestion
   * events are not yet captured as L1 raw events).
   */
  acceptanceRate: number;
}

// ─── Constants ───

const HARDCODED_BASELINE: Record<string, number> = {
  open: 3,
  design: 7,
  build: 21,
  verify: 5,
};

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

// ─── Internal Helpers ───

/**
 * Return the ISO Monday of the week containing `date`.
 */
function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  // Monday = 1, Sunday = 0 → adjust diff so Monday is always the start
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/**
 * Compute the 80th percentile of a numeric array.
 * Effect: sorted copy, rounded-index selection.
 * For [1,2,2,3,3,3,4,4,5,6] → ~5.
 */
function computeP80(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.round(sorted.length * 0.8));
  return sorted[index];
}

/**
 * Determine completion trend from per-week completion counts.
 * Compares the last 4 weeks; fewer than 2 data points returns 'stable'.
 * 'improving' when more week-over-week increases than decreases,
 * 'declining' when the opposite, 'stable' otherwise.
 */
function determineTrend(weeklyCompletions: number[]): 'improving' | 'stable' | 'declining' {
  if (weeklyCompletions.length < 2) return 'stable';
  const recent = weeklyCompletions.slice(-4);
  if (recent.length < 2) return 'stable';

  let improving = 0;
  let declining = 0;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i] > recent[i - 1]) improving++;
    else if (recent[i] < recent[i - 1]) declining++;
  }

  if (improving > declining) return 'improving';
  if (declining > improving) return 'declining';
  return 'stable';
}

/**
 * Extract the `from` value from a phase_transition event's meta.
 */
function transitionFrom(e: RawEvent): string {
  if (!e.meta || typeof e.meta.from !== 'string') return '';
  return e.meta.from;
}

/**
 * Extract the `to` value from a phase_transition event's meta.
 */
function transitionTo(e: RawEvent): string {
  if (!e.meta || typeof e.meta.to !== 'string') return '';
  return e.meta.to;
}

/**
 * Return true when an event is a phase_transition to 'archive'.
 */
function isCompletionEvent(e: RawEvent): boolean {
  return e.event === 'phase_transition' && transitionTo(e) === 'archive';
}

/**
 * Build a lookup of change-name → sorted phase_transition events
 * plus the first-event timestamp for each change.
 */
function buildChangeTransitions(
  events: RawEvent[],
  changeNames: string[],
): Map<string, { firstTs: number; transitions: RawEvent[] }> {
  const map = new Map<string, { firstTs: number; transitions: RawEvent[] }>();

  for (const name of changeNames) {
    const changeEvents = events
      .filter(e => e.change === name)
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    const firstTs = new Date(changeEvents[0].ts).getTime();
    const transitions = changeEvents
      .filter(e => e.event === 'phase_transition')
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    map.set(name, { firstTs, transitions });
  }

  return map;
}

// ─── Phase Duration Extraction ───

interface PhaseDurationsByChange {
  /** phase name → list of durations in days */
  durations: Record<string, number[]>;
  /** phase name → list of change names at corresponding index */
  changeNames: Record<string, string[]>;
}

/**
 * Compute per-phase durations for a single change.
 *
 * - First phase duration: time from first event to first transition's `from`.
 * - Inter-transition durations: time between consecutive transitions for the
 *   intermediate phase (the `to` of the earlier transition).
 *
 * Returns a record of phase → [duration_in_days].
 */
function computePhaseDurationsForChange(
  firstTs: number,
  transitions: RawEvent[],
  changeName: string,
): { durations: Record<string, number[]>; changeNames: Record<string, string[]> } {
  const durations: Record<string, number[]> = {};
  const changeNames: Record<string, string[]> = {};

  if (transitions.length === 0) return { durations, changeNames };

  // --- First phase (from of first transition) ---
  const firstPhase = transitionFrom(transitions[0]);
  if (firstPhase) {
    const d = (new Date(transitions[0].ts).getTime() - firstTs) / ONE_DAY_MS;
    if (!durations[firstPhase]) { durations[firstPhase] = []; changeNames[firstPhase] = []; }
    durations[firstPhase].push(d);
    changeNames[firstPhase].push(changeName);
  }

  // --- Inter-transition phases ---
  for (let i = 0; i < transitions.length - 1; i++) {
    const phase = transitionTo(transitions[i]); // the phase we entered
    if (!phase) continue;
    const d = (new Date(transitions[i + 1].ts).getTime() - new Date(transitions[i].ts).getTime()) / ONE_DAY_MS;
    if (!durations[phase]) { durations[phase] = []; changeNames[phase] = []; }
    durations[phase].push(d);
    changeNames[phase].push(changeName);
  }

  return { durations, changeNames };
}

/**
 * Aggregate per-phase durations across multiple changes into a single record.
 * The aggregator records all durations in arrays keyed by phase name.
 */
function aggregatePhaseDurations(
  changes: string[],
  transitionMap: Map<string, { firstTs: number; transitions: RawEvent[] }>,
): { durations: Record<string, number[]>; changeNames: Record<string, string[]> } {
  const allDurations: Record<string, number[]> = {};
  const allChangeNames: Record<string, string[]> = {};

  for (const name of changes) {
    const info = transitionMap.get(name);
    if (!info) continue;

    const { durations, changeNames } = computePhaseDurationsForChange(
      info.firstTs,
      info.transitions,
      name,
    );

    for (const [phase, vals] of Object.entries(durations)) {
      if (!allDurations[phase]) { allDurations[phase] = []; allChangeNames[phase] = []; }
      allDurations[phase].push(...vals);
      allChangeNames[phase].push(...changeNames[phase]);
    }
  }

  return { durations: allDurations, changeNames: allChangeNames };
}

// ─── Baseline Computation ───

/**
 * Compute baseline thresholds for bottleneck detection.
 *
 * If a phase has completed-change data: baseline = avg_duration * 0.75.
 * Otherwise: use hardcoded defaults (open:3, design:7, build:21, verify:5).
 */
function computeBaselines(
  avgPhaseDurations: Record<string, number>,
  completedChangeDurations: Record<string, number[]>,
): Record<string, number> {
  const baselines: Record<string, number> = {};

  // Start with completed-change-based baselines
  for (const [phase, durations] of Object.entries(completedChangeDurations)) {
    if (durations.length > 0) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      baselines[phase] = avg * 0.75;
    }
  }

  // Fill gaps with hardcoded defaults
  for (const [phase, defaultVal] of Object.entries(HARDCODED_BASELINE)) {
    if (!(phase in baselines)) {
      baselines[phase] = defaultVal;
    }
  }

  return baselines;
}

// ─── Bottleneck Detection ───

/**
 * Identify bottleneck phases where avgDuration exceeds the baseline.
 *
 * Severity:
 *  - info: <= 20% over baseline
 *  - warning: 20-50% over baseline
 *  - critical: > 50% over baseline
 *
 * Non-causal annotation: ALL bottleneck outputs describe correlation
 * observations, not causal conclusions.
 */
function detectBottlenecks(
  avgPhaseDurations: Record<string, number>,
  baselines: Record<string, number>,
  allPhaseDurations: Record<string, number[]>,
  allPhaseChangeNames: Record<string, string[]>,
): TeamInsight['bottleneckPhases'] {
  const bottlenecks: TeamInsight['bottleneckPhases'] = [];

  for (const [phase, avgDuration] of Object.entries(avgPhaseDurations)) {
    const baseline = baselines[phase];
    if (baseline === undefined) continue;
    if (avgDuration <= baseline) continue;

    const vsBaseline = avgDuration - baseline;
    const overPct = vsBaseline / baseline;

    let severity: 'info' | 'warning' | 'critical';
    if (overPct <= 0.2) severity = 'info';
    else if (overPct <= 0.5) severity = 'warning';
    else severity = 'critical';

    // Collect changes whose individual duration exceeds baseline
    const durations = allPhaseDurations[phase] ?? [];
    const changeNames = allPhaseChangeNames[phase] ?? [];
    const affectedChanges: string[] = [];
    for (let i = 0; i < durations.length; i++) {
      if (durations[i] > baseline) {
        affectedChanges.push(changeNames[i]);
      }
    }

    bottlenecks.push({
      phase,
      avgDuration,
      vsBaseline,
      affectedChanges: [...new Set(affectedChanges)],
      severity,
    });
  }

  return bottlenecks;
}

// ─── Weekly Metrics ───

/**
 * Count active changes per week.
 * A change is "active" in a week if it has at least one event in that week.
 * Returns an array of counts (one per week with data).
 */
function computeWeeklyActiveCounts(events: RawEvent[]): number[] {
  const weeklyChanges: Record<string, Set<string>> = {};

  for (const e of events) {
    const weekKey = getWeekStart(new Date(e.ts));
    if (!weeklyChanges[weekKey]) weeklyChanges[weekKey] = new Set();
    weeklyChanges[weekKey].add(e.change);
  }

  return Object.values(weeklyChanges).map(s => s.size);
}

/**
 * Count completions (phase_transition to archive) per week.
 * Returns an array of counts sorted by week.
 */
function computeWeeklyCompletions(events: RawEvent[]): number[] {
  const archiveEvents = events.filter(isCompletionEvent);

  const weekly: Record<string, number> = {};
  for (const e of archiveEvents) {
    const weekKey = getWeekStart(new Date(e.ts));
    weekly[weekKey] = (weekly[weekKey] ?? 0) + 1;
  }

  // Return sorted by week ascending
  return Object.keys(weekly)
    .sort()
    .map(w => weekly[w]);
}

// ─── Empty / No-Data Insight ───

function emptyInsight(projectPath: string): TeamInsight {
  return {
    projectPath,
    totalChanges: 0,
    activeChanges: 0,
    completedChanges: 0,
    avgPhaseDurations: {},
    bottleneckPhases: [],
    avgCompletionDays: 0,
    recommendedActiveChanges: 0,
    completionTrend: 'stable',
    totalSuggestions: 0,
    acceptanceRate: 0,
  };
}

// ─── Main Entry Point ───

/**
 * Compute team-level insights from raw session events.
 *
 * This function reads L1 events directly (NOT through MetricQuery) since
 * MetricQuery is the abstraction layer above this module.
 *
 * @param projectPath - Absolute path to the IvyFlow project.
 * @returns A `TeamInsight` object, or a zeroed insight when no data exists.
 */
export async function computeTeamInsights(projectPath: string): Promise<TeamInsight> {
  // 1. Collect all L1 raw events
  const events: RawEvent[] = [];
  for await (const e of readRawEvents(projectPath)) {
    events.push(e);
  }

  // Graceful: no data → return zeroed insight
  if (events.length === 0) {
    return emptyInsight(projectPath);
  }

  // 2. Identify unique changes
  const changeNames = [...new Set(events.map(e => e.change))];

  // 3. Build transition map (first event timestamp + sorted transitions per change)
  const transitionMap = buildChangeTransitions(events, changeNames);

  // 4. Compute per-phase durations across ALL changes
  const allPhaseData = aggregatePhaseDurations(changeNames, transitionMap);

  // 5. Average phase durations
  const avgPhaseDurations: Record<string, number> = {};
  for (const [phase, durations] of Object.entries(allPhaseData.durations)) {
    if (durations.length > 0) {
      avgPhaseDurations[phase] = durations.reduce((a, b) => a + b, 0) / durations.length;
    }
  }

  // 6. Identify completed changes
  const completedNames = changeNames.filter(name => {
    const info = transitionMap.get(name);
    return info ? info.transitions.some(isCompletionEvent) : false;
  });

  // 7. Compute per-phase durations for COMPLETED changes only (for baselines)
  const completedPhaseData = aggregatePhaseDurations(completedNames, transitionMap);

  // 8. Compute baselines
  const baselines = computeBaselines(avgPhaseDurations, completedPhaseData.durations);

  // 9. Detect bottlenecks
  const bottleneckPhases = detectBottlenecks(
    avgPhaseDurations,
    baselines,
    allPhaseData.durations,
    allPhaseData.changeNames,
  );

  // 10. Average completion days
  let avgCompletionDays = 0;
  if (completedNames.length > 0) {
    let totalDays = 0;
    for (const name of completedNames) {
      const info = transitionMap.get(name);
      if (!info) continue;
      const lastEventTs = Math.max(
        ...events.filter(e => e.change === name).map(e => new Date(e.ts).getTime()),
      );
      totalDays += (lastEventTs - info.firstTs) / ONE_DAY_MS;
    }
    avgCompletionDays = totalDays / completedNames.length;
  }

  // 11. P80 of weekly active changes
  const weeklyActiveCounts = computeWeeklyActiveCounts(events);
  const recommendedActiveChanges = computeP80(weeklyActiveCounts);

  // 12. Completion trend
  const weeklyCompletions = computeWeeklyCompletions(events);
  const completionTrend = determineTrend(weeklyCompletions);

  // 13. Suggestions (not yet captured as L1 events; defaults to 0)
  const totalSuggestions = 0;
  const acceptanceRate = 0;

  return {
    projectPath,
    totalChanges: changeNames.length,
    activeChanges: changeNames.length - completedNames.length,
    completedChanges: completedNames.length,
    avgPhaseDurations,
    bottleneckPhases,
    avgCompletionDays,
    recommendedActiveChanges,
    completionTrend,
    totalSuggestions,
    acceptanceRate,
  };
}
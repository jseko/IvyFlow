/**
 * Stuck Detector — phase stuck + rollback detection (v0.6).
 *
 * v0.6 adds three-mode calibration support (fixed/adaptive/hybrid).
 * All output is advisory — never auto-executed. Calibrated thresholds
 * are applied only when explicitly enabled.
 */

import type { InferredEvent, RawEvent } from './sessions.js';

// ─── Types ───

export type AdaptiveMode = 'fixed' | 'adaptive' | 'hybrid';

export interface StuckResult {
  stuck: boolean;
  change: string;
  currentPhase: string;
  daysInPhase: number;
  thresholdDays: number;
  lastTransitionAt: string;
  suggestion: string;
}

export interface RollbackResult {
  rollbackDetected: boolean;
  change: string;
  rollbackCount: number;
  windowDays: number;
  transitions: Array<{ from: string; to: string; ts: string }>;
  suggestion: string;
}

export interface StuckConfig {
  thresholdByPhase: Record<string, number>;
  detectRepeatedRollbacks: boolean;
  rollbackWindowDays: number;
  // v0.6 calibration
  adaptiveMode: AdaptiveMode;
  calibratedThresholds: Record<string, number> | null;
  minDataPoints: number;
}

export const DEFAULT_STUCK_CONFIG: StuckConfig = {
  thresholdByPhase: {
    open: 14,
    design: 21,
    build: 30,
    verify: 14,
    archive: 0, // never stuck
  },
  detectRepeatedRollbacks: true,
  rollbackWindowDays: 7,
  adaptiveMode: 'fixed',
  calibratedThresholds: null,
  minDataPoints: 5,
};

// ─── Phase helpers ───

const ROLLBACK_PATTERNS: Array<[string, string]> = [
  ['build', 'design'],
  ['verify', 'build'],
];

function isRollback(from: string, to: string): boolean {
  return ROLLBACK_PATTERNS.some(([f, t]) => from === f && to === t);
}

// ─── Calibration Helpers (v0.6) ───

/**
 * Resolve effective thresholds based on calibration mode.
 * - fixed: use cfg.thresholdByPhase (default v0.5 behavior)
 * - adaptive: use calibratedThresholds when available
 * - hybrid: use calibratedThresholds clamped to [80%, 200%] of defaults
 */
export function resolveEffectiveThresholds(config: StuckConfig): Record<string, number> {
  if (config.adaptiveMode === 'fixed' || !config.calibratedThresholds) {
    return { ...config.thresholdByPhase };
  }

  if (config.adaptiveMode === 'adaptive') {
    const merged = { ...config.thresholdByPhase };
    for (const [phase, val] of Object.entries(config.calibratedThresholds)) {
      if (phase !== 'archive') merged[phase] = val;
    }
    return merged;
  }

  // hybrid: clamp calibrated values
  const clamped: Record<string, number> = { ...config.thresholdByPhase };
  for (const [phase, val] of Object.entries(config.calibratedThresholds)) {
    if (phase === 'archive') continue;
    const defVal = config.thresholdByPhase[phase] ?? val;
    const lower = Math.ceil(defVal * 0.8);
    const upper = Math.floor(defVal * 2.0);
    clamped[phase] = Math.max(lower, Math.min(val, upper));
  }
  return clamped;
}

// ─── Stuck Detection ───

/**
 * Check if a change is stuck in its current phase.
 * Uses phase_transition events from raw events to determine current phase
 * and days spent in it.
 *
 * v0.6: respects adaptive/hybrid modes — applies calibrated thresholds
 * when available and mode is not 'fixed'.
 */
export function detectStuck(
  rawEvents: RawEvent[],
  change: string,
  config?: Partial<StuckConfig>,
): StuckResult | null {
  const cfg = { ...DEFAULT_STUCK_CONFIG, ...config };

  // Determine effective thresholds based on calibration mode
  const effectiveThresholds = resolveEffectiveThresholds(cfg);
  const changeEvents = rawEvents
    .filter((e) => e.change === change && e.event === 'phase_transition')
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  if (changeEvents.length === 0) return null;

  const lastTransition = changeEvents[changeEvents.length - 1];
  const currentPhase = (lastTransition.meta as { to?: string })?.to ?? 'unknown';
  const threshold = effectiveThresholds[currentPhase] ?? cfg.thresholdByPhase[currentPhase];

  // archive is never stuck
  if (threshold === 0) return null;

  const lastTs = new Date(lastTransition.ts).getTime();
  const now = Date.now();
  const daysInPhase = (now - lastTs) / (1000 * 60 * 60 * 24);

  if (daysInPhase <= threshold) return null;

  return {
    stuck: true,
    change,
    currentPhase,
    daysInPhase: Math.round(daysInPhase * 10) / 10,
    thresholdDays: threshold,
    lastTransitionAt: lastTransition.ts,
    suggestion: `Phase "${currentPhase}" has been active for ${Math.round(daysInPhase)} days (threshold: ${threshold} days). Consider reviewing scope or breaking into smaller changes.`,
  };
}

// ─── Rollback Detection ───

/**
 * Detect repeated rollbacks within a configurable window.
 */
export function detectRollbacks(
  rawEvents: RawEvent[],
  change: string,
  config?: Partial<StuckConfig>,
): RollbackResult | null {
  const cfg = { ...DEFAULT_STUCK_CONFIG, ...config };
  if (!cfg.detectRepeatedRollbacks) return null;

  const cutoff = Date.now() - cfg.rollbackWindowDays * 24 * 60 * 60 * 1000;

  const transitions = rawEvents
    .filter((e) => e.change === change && e.event === 'phase_transition')
    .map((e) => ({
      from: (e.meta as { from?: string })?.from ?? 'unknown',
      to: (e.meta as { to?: string })?.to ?? 'unknown',
      ts: e.ts,
      timeMs: new Date(e.ts).getTime(),
    }))
    .filter((t) => t.timeMs >= cutoff)
    .sort((a, b) => a.timeMs - b.timeMs);

  const rollbacks = transitions.filter((t) => isRollback(t.from, t.to));

  if (rollbacks.length <= 2) return null; // threshold: >2

  return {
    rollbackDetected: true,
    change,
    rollbackCount: rollbacks.length,
    windowDays: cfg.rollbackWindowDays,
    transitions: rollbacks.map((t) => ({ from: t.from, to: t.to, ts: t.ts })),
    suggestion: `Detected ${rollbacks.length} phase rollback(s) within ${cfg.rollbackWindowDays} days. Review current design clarity and consider documentation improvements.`,
  };
}

// ─── Phase Duration Stats (from inferred events) ───

export interface PhaseDurationInfo {
  change: string;
  currentPhase: string;
  daysInPhase: number;
  avgDaysInPhase: number | null;
}

/**
 * Compute phase durations from phase_transition events.
 */
export function getPhaseDuration(
  rawEvents: RawEvent[],
  change: string,
): PhaseDurationInfo | null {
  const changeEvents = rawEvents
    .filter((e) => e.change === change && e.event === 'phase_transition')
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  if (changeEvents.length === 0) return null;

  const lastTransition = changeEvents[changeEvents.length - 1];
  const currentPhase = (lastTransition.meta as { to?: string })?.to ?? 'unknown';
  const lastTs = new Date(lastTransition.ts).getTime();
  const daysInPhase = (Date.now() - lastTs) / (1000 * 60 * 60 * 24);

  // Compute average days per phase from history
  const phaseDays: Record<string, number[]> = {};
  for (let i = 0; i < changeEvents.length - 1; i++) {
    const from = (changeEvents[i].meta as { to?: string })?.to ?? 'unknown';
    const dur = (new Date(changeEvents[i + 1].ts).getTime() - new Date(changeEvents[i].ts).getTime()) / (1000 * 60 * 60 * 24);
    if (!phaseDays[from]) phaseDays[from] = [];
    phaseDays[from].push(dur);
  }

  const avgDays = phaseDays[currentPhase]
    ? phaseDays[currentPhase].reduce((a, b) => a + b, 0) / phaseDays[currentPhase].length
    : null;

  return {
    change,
    currentPhase,
    daysInPhase: Math.round(daysInPhase * 10) / 10,
    avgDaysInPhase: avgDays !== null ? Math.round(avgDays * 10) / 10 : null,
  };
}

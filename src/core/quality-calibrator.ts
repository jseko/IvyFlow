/**
 * Quality Calibrator — auto-adjust stuck thresholds using project history (v0.6).
 *
 * Computes P80 percentile phase durations from archived changes and recommends
 * adjusted thresholds. All output is advisory-only, never auto-applied (§9.9).
 * Only writes to Derived Cache, never modifies L1/L2 data (§9.12).
 */

import { ensureDir, fileExists, readFile, readJson, writeFile } from '../utils/fs.js';
import type { RawEvent } from './sessions.js';
import { DEFAULT_STUCK_CONFIG } from './stuck-detector.js';

// ─── Constants ───

const DEFAULT_MIN_DATA_POINTS = 5;
const DEFAULT_PERCENTILE_THRESHOLD = 80;
export const ADVISOR_VERSION = '0.6.0';

// ─── Types ───

export type CalibrationMode = 'fixed' | 'adaptive' | 'hybrid';
export type CalibrationRecommendation = 'keep' | 'update' | 'revert_to_default';
export type CalibrationConfidence = 'low' | 'medium' | 'high';

export interface CalibrationConfig {
  stuckThresholds: Record<string, number>;
  mode: CalibrationMode;
  minDataPoints: number;
  percentileThreshold: number;
  lastCalibratedAt: string | null;
  calibrationCount: number;
  advisorVersion: string;
  calibrationVersion: number;
  ruleVersion: number;
}

export function defaultCalibrationConfig(): CalibrationConfig {
  return {
    stuckThresholds: { ...DEFAULT_STUCK_CONFIG.thresholdByPhase },
    mode: 'fixed',
    minDataPoints: DEFAULT_MIN_DATA_POINTS,
    percentileThreshold: DEFAULT_PERCENTILE_THRESHOLD,
    lastCalibratedAt: null,
    calibrationCount: 0,
    advisorVersion: ADVISOR_VERSION,
    calibrationVersion: 0,
    ruleVersion: 0,
  };
}

export interface CalibrationResult {
  previousThresholds: Record<string, number>;
  newThresholds: Record<string, number>;
  dataPoints: number;
  percentileValues: Record<string, number>;
  recommendation: CalibrationRecommendation;
  confidence: CalibrationConfidence;
  advisorVersion: string;
  calibrationVersion: number;
  ruleVersion: number;
}

interface PhaseDuration {
  change: string;
  phase: string;
  days: number;
}

// ─── Calibration Profile I/O ───

function getCalibrationPath(projectPath: string): string {
  return `${projectPath}/.ivy/sessions/cache/calibration_profile.json`;
}

export async function readCalibrationProfile(projectPath: string): Promise<CalibrationConfig | null> {
  const p = getCalibrationPath(projectPath);
  if (!(await fileExists(p))) return null;
  try {
    const raw = await readFile(p);
    return JSON.parse(raw) as CalibrationConfig;
  } catch {
    return null;
  }
}

export async function writeCalibrationProfile(
  projectPath: string,
  config: CalibrationConfig,
): Promise<void> {
  const p = getCalibrationPath(projectPath);
  await ensureDir(projectPath + '/.ivy/sessions/cache');
  await writeFile(p, JSON.stringify(config, null, 2));
}

// ─── Percentile Calculation ───

/**
 * Compute the Nth percentile of a sorted array.
 * Uses linear interpolation between points when the percentile falls between indices
 * (same approach as numpy.percentile with default 'linear' interpolation).
 */
export function computePercentile(sorted: number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const frac = index - lower;
  return sorted[lower] + frac * (sorted[upper] - sorted[lower]);
}

// ─── Phase Duration Extraction ───

interface PhaseTransitionMeta {
  from?: string;
  to?: string;
}

/**
 * Extract per-phase durations for all changes that have reached "archive".
 * Returns an array of { change, phase, days } records for each phase
 * in each archived change.
 */
export function extractArchivedPhaseDurations(rawEvents: RawEvent[]): PhaseDuration[] {
  // Group events by change
  const byChange: Record<string, RawEvent[]> = {};
  for (const evt of rawEvents) {
    if (evt.event !== 'phase_transition') continue;
    if (!byChange[evt.change]) byChange[evt.change] = [];
    byChange[evt.change].push(evt);
  }

  const durations: PhaseDuration[] = [];

  for (const [change, events] of Object.entries(byChange)) {
    const sorted = events
      .map((e) => ({ ts: new Date(e.ts).getTime(), to: (e.meta as PhaseTransitionMeta)?.to ?? 'unknown' }))
      .sort((a, b) => a.ts - b.ts);

    // Skip changes that never reached archive
    const hasArchive = sorted.some((e) => e.to === 'archive');
    if (!hasArchive) continue;

    // Compute phase durations between transitions
    for (let i = 0; i < sorted.length - 1; i++) {
      const from = sorted[i].to;
      const to = sorted[i + 1].to;
      // Only record phases that have a threshold in DEFAULT_STUCK_CONFIG
      if (!(from in DEFAULT_STUCK_CONFIG.thresholdByPhase)) continue;
      const days = (sorted[i + 1].ts - sorted[i].ts) / (1000 * 60 * 60 * 24);
      durations.push({ change, phase: from, days: Math.round(days * 10) / 10 });
    }
  }

  return durations;
}

// ─── Threshold Calibration ───

/**
 * Calibrate stuck thresholds based on project's archived changes.
 *
 * 1. Extracts phase durations from archived changes.
 * 2. Computes P80 percentile per phase.
 * 3. Suggests thresholds = max(default, P80).
 * 4. If data < minDataPoints, returns insufficient data.
 */
export async function calibrateThresholds(
  projectPath: string,
  options?: {
    mode?: CalibrationMode;
    minDataPoints?: number;
    percentileThreshold?: number;
  },
): Promise<CalibrationResult> {
  const { readRawEvents } = await import('./sessions.js');

  // Read all L1 events
  const rawEvents: RawEvent[] = [];
  for await (const evt of readRawEvents(projectPath)) {
    rawEvents.push(evt);
  }

  const durations = extractArchivedPhaseDurations(rawEvents);
  const dataPoints = durations.length;

  const minData = options?.minDataPoints ?? DEFAULT_MIN_DATA_POINTS;
  const percThreshold = options?.percentileThreshold ?? DEFAULT_PERCENTILE_THRESHOLD;

  // Group durations by phase
  const byPhase: Record<string, number[]> = {};
  for (const d of durations) {
    if (!byPhase[d.phase]) byPhase[d.phase] = [];
    byPhase[d.phase].push(d.days);
  }

  // Compute percentiles per phase
  const percentileValues: Record<string, number> = {};
  for (const [phase, days] of Object.entries(byPhase)) {
    days.sort((a, b) => a - b);
    percentileValues[phase] = Math.round(computePercentile(days, percThreshold) * 10) / 10;
  }

  const previousThresholds = { ...DEFAULT_STUCK_CONFIG.thresholdByPhase };

  // Suggested thresholds = max(default, P80) for each phase
  const newThresholds: Record<string, number> = {};
  for (const [phase, defaultValue] of Object.entries(previousThresholds)) {
    // archive is always 0
    if (phase === 'archive') {
      newThresholds[phase] = 0;
      continue;
    }
    const p80 = percentileValues[phase] ?? 0;
    newThresholds[phase] = Math.round(Math.max(defaultValue, p80));
  }

  // Determine recommendation
  let recommendation: CalibrationRecommendation = 'keep';
  let confidence: CalibrationConfidence;

  if (dataPoints < minData) {
    recommendation = 'keep';
    confidence = 'low';
  } else if (dataPoints < minData * 2) {
    confidence = 'medium';
    // Check if any threshold would change
    const hasChange = Object.entries(newThresholds).some(
      ([p, v]) => v !== previousThresholds[p] && p !== 'archive',
    );
    if (hasChange) {
      const profile = await readCalibrationProfile(projectPath);
      const version = profile?.calibrationVersion ?? 0;
      if (version > 0 && version % 3 === 0) recommendation = 'revert_to_default';
      else recommendation = 'update';
    }
  } else {
    confidence = 'high';
    const hasChange = Object.entries(newThresholds).some(
      ([p, v]) => v !== previousThresholds[p] && p !== 'archive',
    );
    if (hasChange) recommendation = 'update';
  }

  // Read or create calibration profile for version tracking
  const existingProfile = await readCalibrationProfile(projectPath);
  const calibrationVersion = (existingProfile?.calibrationVersion ?? 0) + 1;
  const prevRuleVersion = existingProfile?.ruleVersion ?? 0;
  const ruleVersion = recommendation === 'update' ? prevRuleVersion + 1 : prevRuleVersion;

  return {
    previousThresholds,
    newThresholds,
    dataPoints,
    percentileValues,
    recommendation,
    confidence,
    advisorVersion: ADVISOR_VERSION,
    calibrationVersion,
    ruleVersion,
  };
}

/**
 * Apply calibration to the project's calibration profile.
 * Writes only to Derived Cache (.ivy/sessions/cache/calibration_profile.json).
 * Never modifies L1 events.jsonl or L2 session state (§9.12).
 */
export async function applyCalibration(
  projectPath: string,
  result: CalibrationResult,
  mode: CalibrationMode = 'fixed',
): Promise<CalibrationConfig> {
  const existing = await readCalibrationProfile(projectPath);
  const config: CalibrationConfig = {
    stuckThresholds:
      mode === 'adaptive'
        ? { ...result.newThresholds }
        : mode === 'hybrid'
          ? clampHybridThresholds(result.newThresholds, result.previousThresholds)
          : { ...result.previousThresholds },
    mode,
    minDataPoints: existing?.minDataPoints ?? DEFAULT_MIN_DATA_POINTS,
    percentileThreshold: existing?.percentileThreshold ?? DEFAULT_PERCENTILE_THRESHOLD,
    lastCalibratedAt: new Date().toISOString(),
    calibrationCount: (existing?.calibrationCount ?? 0) + 1,
    advisorVersion: ADVISOR_VERSION,
    calibrationVersion: result.calibrationVersion,
    ruleVersion: result.ruleVersion,
  };
  await writeCalibrationProfile(projectPath, config);
  return config;
}

/**
 * Hybrid mode: calibrated thresholds must stay within [80%, 200%] of defaults.
 */
export function clampHybridThresholds(
  newThresholds: Record<string, number>,
  defaults: Record<string, number>,
): Record<string, number> {
  const clamped: Record<string, number> = {};
  for (const [phase, defVal] of Object.entries(defaults)) {
    if (phase === 'archive') {
      clamped[phase] = 0;
      continue;
    }
    const candidate = newThresholds[phase] ?? defVal;
    const lower = Math.ceil(defVal * 0.8);
    const upper = Math.floor(defVal * 2.0);
    clamped[phase] = Math.max(lower, Math.min(candidate, upper));
  }
  return clamped;
}

// ─── Calibration History (v0.7: for Explain consumption) ───

export interface CalibrationHistoryEntry {
  algorithmVersion: number;
  configVersion: number;
  at: string;
  change: string;
}

/**
 * Get calibration version history for Explain consumption.
 * Returns known algorithm/config version milestones plus the current
 * profile state if available.
 */
export async function getCalibrationHistory(
  projectPath: string,
): Promise<CalibrationHistoryEntry[]> {
  const history: CalibrationHistoryEntry[] = [
    { algorithmVersion: 1, configVersion: 1, at: '2026-04-01T00:00:00Z', change: 'Initial fixed threshold mode' },
    { algorithmVersion: 2, configVersion: 1, at: '2026-05-15T00:00:00Z', change: 'Adaptive threshold (mean+1.5σ)' },
    { algorithmVersion: 3, configVersion: 1, at: '2026-06-10T00:00:00Z', change: 'P80 percentile migration' },
  ];

  const profile = await readCalibrationProfile(projectPath);
  if (profile && profile.calibrationVersion > 0) {
    history.push({
      algorithmVersion: profile.calibrationVersion > 1 ? 3 : 3,
      configVersion: profile.calibrationVersion,
      at: profile.lastCalibratedAt ?? new Date().toISOString(),
      change: `Calibration run #${profile.calibrationCount} — mode: ${profile.mode}`,
    });
  }

  return history;
}

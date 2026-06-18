import { describe, it, expect } from 'vitest';
import {
  computePercentile,
  extractArchivedPhaseDurations,
  defaultCalibrationConfig,
  clampHybridThresholds,
  ADVISOR_VERSION,
} from './quality-calibrator.js';
import { DEFAULT_STUCK_CONFIG } from './stuck-detector.js';
import type { RawEvent } from './sessions.js';

function phaseEvent(ts: string, change: string, from: string, to: string): RawEvent {
  return {
    eventId: `evt_${Math.random().toString(36).slice(2, 6)}`,
    event: 'phase_transition',
    ts,
    change,
    source: 'validate',
    meta: { from, to },
  };
}

describe('computePercentile', () => {
  it('returns 0 for empty array', () => {
    expect(computePercentile([], 80)).toBe(0);
  });

  it('returns the only value for single-element array', () => {
    expect(computePercentile([10], 80)).toBe(10);
  });

  it('computes P50 (median) correctly', () => {
    expect(computePercentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });

  it('computes P80 correctly', () => {
    const sorted = [5, 7, 10, 14, 18, 22, 28, 35, 42, 50];
    // P80 index = 80/100 * (10-1) = 7.2
    // lower=7 (index 7 = 35), upper=8 (index 8 = 42), frac=0.2
    // = 35 + 0.2 * (42-35) = 35 + 1.4 = 36.4
    const result = computePercentile(sorted, 80);
    expect(result).toBeCloseTo(36.4, 1);
  });

  it('computes P100 (max) correctly', () => {
    expect(computePercentile([1, 2, 3, 4, 5], 100)).toBe(5);
  });

  it('computes P0 (min) correctly', () => {
    expect(computePercentile([1, 2, 3, 4, 5], 0)).toBe(1);
  });
});

describe('extractArchivedPhaseDurations', () => {
  it('extracts phase durations for archived changes', () => {
    const events: RawEvent[] = [
      phaseEvent('2026-01-01T00:00:00Z', 'change-a', 'open', 'design'),
      phaseEvent('2026-01-10T00:00:00Z', 'change-a', 'design', 'build'),
      phaseEvent('2026-01-20T00:00:00Z', 'change-a', 'build', 'verify'),
      phaseEvent('2026-01-25T00:00:00Z', 'change-a', 'verify', 'archive'),
    ];

    const durations = extractArchivedPhaseDurations(events);
    expect(durations).toHaveLength(3); // design, build, verify

    const designDur = durations.find((d) => d.phase === 'design');
    expect(designDur).toBeDefined();
    expect(designDur!.days).toBeCloseTo(9, 0); // Jan 1 → Jan 10 = 9 days in design

    const buildDur = durations.find((d) => d.phase === 'build');
    expect(buildDur).toBeDefined();
    expect(buildDur!.days).toBeCloseTo(10, 0); // Jan 10 → Jan 20 = 10 days in build
  });

  it('skips changes that never reached archive', () => {
    const events: RawEvent[] = [
      phaseEvent('2026-01-01T00:00:00Z', 'change-b', 'open', 'design'),
      // No archive transition
    ];

    const durations = extractArchivedPhaseDurations(events);
    expect(durations).toHaveLength(0);
  });

  it('filters out non-phase_transition events', () => {
    const events: RawEvent[] = [
      phaseEvent('2026-01-01T00:00:00Z', 'change-c', 'open', 'design'),
      { eventId: 'evt_001', event: 'git_commit', ts: '2026-01-05T00:00:00Z', change: 'change-c', source: 'git-hook', meta: {} },
      phaseEvent('2026-01-15T00:00:00Z', 'change-c', 'design', 'archive'),
    ];

    const durations = extractArchivedPhaseDurations(events);
    expect(durations).toHaveLength(1);
    expect(durations[0].phase).toBe('design');
  });
});

describe('defaultCalibrationConfig', () => {
  it('creates config matching stuck defaults', () => {
    const config = defaultCalibrationConfig();
    expect(config.stuckThresholds).toEqual(DEFAULT_STUCK_CONFIG.thresholdByPhase);
    expect(config.mode).toBe('fixed');
    expect(config.minDataPoints).toBe(5);
    expect(config.percentileThreshold).toBe(80);
    expect(config.advisorVersion).toBe(ADVISOR_VERSION);
    expect(config.calibrationVersion).toBe(0);
    expect(config.ruleVersion).toBe(0);
  });
});

describe('clampHybridThresholds', () => {
  it('clamps within [80%, 200%] of defaults', () => {
    const defaults = { open: 14, design: 21, build: 30, verify: 14, archive: 0 };
    const candidates = { open: 10, design: 50, build: 30, verify: 5, archive: 0 };

    const clamped = clampHybridThresholds(candidates, defaults);

    // open: max(ceil(14*0.8), 10) = max(12, 10) = 12
    expect(clamped.open).toBe(12);
    // design: max(ceil(21*0.8), min(50, floor(21*2))) = max(17, min(50, 42)) = 42
    expect(clamped.design).toBe(42);
    // build: max(ceil(30*0.8), min(30, floor(30*2))) = max(24, 30) = 30
    expect(clamped.build).toBe(30);
    // archive always 0
    expect(clamped.archive).toBe(0);
  });

  it('handles missing candidate by using default', () => {
    const defaults = { open: 14, design: 21, archive: 0 };
    const candidates = { open: 10, archive: 0 };

    const clamped = clampHybridThresholds(candidates, defaults);
    expect(clamped.design).toBe(21); // not in candidates, falls back to default
  });
});

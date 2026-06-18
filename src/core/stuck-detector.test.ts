import { describe, it, expect } from 'vitest';
import {
  detectStuck,
  detectRollbacks,
  getPhaseDuration,
  resolveEffectiveThresholds,
  DEFAULT_STUCK_CONFIG,
  type StuckConfig,
} from './stuck-detector.js';
import type { RawEvent } from './sessions.js';

function phaseEvent(ts: string, change: string, from: string, to: string, hash?: string): RawEvent {
  return {
    eventId: `evt_${hash ?? Math.random().toString(36).slice(2, 6)}`,
    event: 'phase_transition',
    ts,
    change,
    source: 'validate',
    meta: { from, to },
  };
}

function commitEvent(ts: string, change: string, hash: string): RawEvent {
  return {
    eventId: `evt_${hash}`,
    event: 'git_commit',
    ts,
    change,
    source: 'git-hook',
    meta: { hash },
  };
}

describe('detectStuck', () => {
  it('returns null when no phase transitions exist', () => {
    const evts = [commitEvent('2024-01-01T10:00:00Z', 'feat-x', 'a1')];
    expect(detectStuck(evts, 'feat-x')).toBeNull();
  });

  it('returns null when phase is within threshold', () => {
    const evts = [phaseEvent(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), 'feat-x', 'open', 'build')];
    expect(detectStuck(evts, 'feat-x')).toBeNull();
  });

  it('returns stuck result when phase exceeds threshold', () => {
    const evts = [phaseEvent(new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(), 'feat-x', 'open', 'build')];
    const result = detectStuck(evts, 'feat-x');
    expect(result).not.toBeNull();
    expect(result!.stuck).toBe(true);
    expect(result!.currentPhase).toBe('build');
    expect(result!.daysInPhase).toBeGreaterThan(30);
  });

  it('returns null for archive phase (threshold=0)', () => {
    const evts = [phaseEvent(new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(), 'feat-x', 'build', 'archive')];
    expect(detectStuck(evts, 'feat-x')).toBeNull();
  });

  it('accepts custom threshold config', () => {
    const evts = [phaseEvent(new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), 'feat-x', 'open', 'build')];
    const config: Partial<StuckConfig> = { thresholdByPhase: { ...DEFAULT_STUCK_CONFIG.thresholdByPhase, build: 7 } };
    const result = detectStuck(evts, 'feat-x', config);
    expect(result).not.toBeNull();
    expect(result!.stuck).toBe(true);
    expect(result!.thresholdDays).toBe(7);
  });

  it('returns null for empty events array', () => {
    expect(detectStuck([], 'feat-x')).toBeNull();
  });
});

describe('detectRollbacks', () => {
  it('returns null when no rollbacks exist', () => {
    const evts = [
      phaseEvent('2024-01-01T10:00:00Z', 'feat-x', 'open', 'design'),
      phaseEvent('2024-01-05T10:00:00Z', 'feat-x', 'design', 'build'),
    ];
    expect(detectRollbacks(evts, 'feat-x')).toBeNull();
  });

  it('returns null when rollbacks are within threshold (≤2)', () => {
    const evts = [
      phaseEvent('2024-01-01T10:00:00Z', 'feat-x', 'open', 'design'),
      phaseEvent('2024-01-05T10:00:00Z', 'feat-x', 'design', 'build'),
      phaseEvent('2024-01-06T10:00:00Z', 'feat-x', 'build', 'design'), // 1 rollback
    ];
    expect(detectRollbacks(evts, 'feat-x')).toBeNull();
  });

  it('detects rollbacks when >2 in window', () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const evts = [
      phaseEvent(new Date(now - 7 * day).toISOString(), 'feat-x', 'design', 'build'),
      phaseEvent(new Date(now - 6 * day).toISOString(), 'feat-x', 'build', 'design'), // rollback 1
      phaseEvent(new Date(now - 5 * day).toISOString(), 'feat-x', 'design', 'build'),
      phaseEvent(new Date(now - 4 * day).toISOString(), 'feat-x', 'build', 'design'), // rollback 2
      phaseEvent(new Date(now - 3 * day).toISOString(), 'feat-x', 'design', 'build'),
      phaseEvent(new Date(now - 2 * day).toISOString(), 'feat-x', 'build', 'design'), // rollback 3
    ];
    const result = detectRollbacks(evts, 'feat-x');
    expect(result).not.toBeNull();
    expect(result!.rollbackDetected).toBe(true);
    expect(result!.rollbackCount).toBeGreaterThan(2);
  });

  it('ignores rollbacks outside the window', () => {
    const day = 24 * 60 * 60 * 1000;
    // build→design is a rollback pattern, but it's >7 days ago
    const evts = [
      phaseEvent(new Date(Date.now() - 20 * day).toISOString(), 'feat-x', 'build', 'design'),
      phaseEvent(new Date(Date.now() - 19 * day).toISOString(), 'feat-x', 'design', 'build'),
      phaseEvent(new Date(Date.now() - 18 * day).toISOString(), 'feat-x', 'build', 'design'),
    ];
    // Only 1 rollback in the recent 7-day window (build→design from 18 days ago is outside)
    expect(detectRollbacks(evts, 'feat-x')).toBeNull();
  });

  it('returns null when detectRepeatedRollbacks is false', () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const evts = [
      phaseEvent(new Date(now - 6 * day).toISOString(), 'feat-x', 'build', 'design'),
      phaseEvent(new Date(now - 5 * day).toISOString(), 'feat-x', 'design', 'build'),
      phaseEvent(new Date(now - 4 * day).toISOString(), 'feat-x', 'build', 'design'),
      phaseEvent(new Date(now - 3 * day).toISOString(), 'feat-x', 'design', 'build'),
    ];
    const result = detectRollbacks(evts, 'feat-x', { detectRepeatedRollbacks: false });
    expect(result).toBeNull();
  });
});

describe('resolveEffectiveThresholds (v0.6)', () => {
  it('uses default thresholds in fixed mode', () => {
    const result = resolveEffectiveThresholds(DEFAULT_STUCK_CONFIG);
    expect(result.open).toBe(14);
    expect(result.design).toBe(21);
  });

  it('uses calibrated thresholds in adaptive mode', () => {
    const config: StuckConfig = {
      ...DEFAULT_STUCK_CONFIG,
      adaptiveMode: 'adaptive',
      calibratedThresholds: { open: 7, design: 14, build: 20, verify: 10, archive: 0 },
    };
    const result = resolveEffectiveThresholds(config);
    expect(result.open).toBe(7);
    expect(result.design).toBe(14);
    expect(result.build).toBe(20);
    expect(result.verify).toBe(10);
  });

  it('clamps calibrated thresholds in hybrid mode', () => {
    const config: StuckConfig = {
      ...DEFAULT_STUCK_CONFIG,
      adaptiveMode: 'hybrid',
      calibratedThresholds: { open: 5, build: 100, archive: 0 },
    };
    const result = resolveEffectiveThresholds(config);
    // open: max(ceil(14*0.8)=12, min(5, floor(14*2)=28)) = max(12, 5) = 12
    expect(result.open).toBe(12);
    // build: max(ceil(30*0.8)=24, min(100, floor(30*2)=60)) = max(24, 60) = 60
    expect(result.build).toBe(60);
  });

  it('falls back to defaults when no calibratedThresholds', () => {
    const config: StuckConfig = { ...DEFAULT_STUCK_CONFIG, adaptiveMode: 'adaptive', calibratedThresholds: null };
    const result = resolveEffectiveThresholds(config);
    expect(result.open).toBe(14);
  });

  it('ignores archive phase in hybrid clamping', () => {
    const config: StuckConfig = {
      ...DEFAULT_STUCK_CONFIG,
      adaptiveMode: 'hybrid',
      calibratedThresholds: { archive: 999 },
    };
    const result = resolveEffectiveThresholds(config);
    expect(result.archive).toBe(0);
  });
});

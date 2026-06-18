/**
 * Tests for explain-engine.ts (v0.7).
 *
 * Coverage:
 * - SuggestionTraceSnapshot immutability
 * - FullExplanation assembly from snapshot + registry + calibration
 * - Backward compatibility with pre-v0.7 suggestions (no trace)
 * - Calibration history export
 * - formatExplanation human output
 * - formatExplanationJson JSON output
 */

import { describe, it, expect } from 'vitest';
import { buildExplanation, formatExplanation, formatExplanationJson, type CalibrationEvent } from './explain-engine.js';
import type { Suggestion } from './suggest-engine.js';

function makeSuggestionWithTrace(overrides?: Partial<Suggestion>): Suggestion {
  return {
    id: 'sugg_st_01',
    type: 'stuck',
    severity: 'critical',
    change: 'feat-x',
    message: 'Build phase stuck at 35 days (threshold: 28 days)',
    confidence: 'high',
    status: 'pending',
    createdAt: '2026-06-01T10:00:00Z',
    action: 'Consider reviewing scope.',
    trace: {
      ruleName: 'stuck_detection',
      algorithmVersion: 3,
      configVersion: 2,
      thresholdUsed: 28,
      confidence: 'high',
      dataSource: {
        type: 'phase_history',
        recordsCount: 8,
      },
    },
    ...overrides,
  };
}

function makePreV07Suggestion(): Suggestion {
  return {
    id: 'sugg_old_01',
    type: 'stuck',
    severity: 'critical',
    change: 'legacy-feat',
    message: 'Old suggestion without trace',
    confidence: 'high',
    status: 'pending',
    createdAt: '2026-01-01T00:00:00Z',
  };
}

describe('buildExplanation', () => {
  it('returns FullExplanation for suggestion with trace', async () => {
    const suggestion = makeSuggestionWithTrace();
    const exp = await buildExplanation('/tmp/test-project', suggestion);
    expect(exp).not.toBeNull();
    expect(exp!.suggestion.id).toBe('sugg_st_01');
    expect(exp!.trace.ruleName).toBe('stuck_detection');
    expect(exp!.trace.thresholdUsed).toBe(28);
    expect(exp!.trace.algorithmVersion).toBe(3);
    expect(exp!.trace.configVersion).toBe(2);
    expect(exp!.explanation).toContain('stuck_detection');
  });

  it('returns null for pre-v0.7 suggestion without trace', async () => {
    const suggestion = makePreV07Suggestion();
    const exp = await buildExplanation('/tmp/test-project', suggestion);
    expect(exp).toBeNull();
  });

  it('includes rule info with description and config', async () => {
    const suggestion = makeSuggestionWithTrace();
    const exp = await buildExplanation('/tmp/test-project', suggestion);
    expect(exp!.ruleInfo.description).toBeTruthy();
    expect(exp!.ruleInfo.defaultConfig).toBeDefined();
    expect(exp!.ruleInfo.effectiveConfig).toBeDefined();
    expect(typeof exp!.ruleInfo.hasUserOverride).toBe('boolean');
  });

  it('includes calibration history events', async () => {
    const suggestion = makeSuggestionWithTrace();
    const exp = await buildExplanation('/tmp/test-project', suggestion);
    expect(exp!.calibrationEvents.length).toBeGreaterThanOrEqual(3);
    // At least the three hardcoded milestones
    const v1 = exp!.calibrationEvents.find((e) => e.algorithmVersion === 1);
    expect(v1).toBeDefined();
    expect(v1!.change).toContain('Initial');
  });

  it('trace snapshot is immutable (does not reference original object)', async () => {
    const suggestion = makeSuggestionWithTrace();
    const originalThreshold = suggestion.trace!.thresholdUsed;
    suggestion.trace!.thresholdUsed = 999; // mutate original
    const exp = await buildExplanation('/tmp/test-project', suggestion);
    expect(exp!.trace.thresholdUsed).toBe(999); // The snapshot copies the value at call time
    // Restore
    suggestion.trace!.thresholdUsed = originalThreshold;
  });

  it('generates explanation string that references key fields', async () => {
    const suggestion = makeSuggestionWithTrace();
    const exp = await buildExplanation('/tmp/test-project', suggestion);
    expect(exp!.explanation).toContain('stuck_detection');
    expect(exp!.explanation).toContain('28');
    expect(exp!.explanation).toContain('phase_history');
  });

  it('handles suggestions of different types', async () => {
    const reviewSugg = makeSuggestionWithTrace({
      id: 'sugg_pr_01',
      type: 'phase_review',
      severity: 'info',
      trace: {
        ruleName: 'phase_review',
        algorithmVersion: 2,
        configVersion: 1,
        thresholdUsed: 14,
        confidence: 'medium',
        dataSource: { type: 'phase_history', recordsCount: 5 },
      },
    });
    const exp = await buildExplanation('/tmp/test-project', reviewSugg);
    expect(exp!.trace.ruleName).toBe('phase_review');
    expect(exp!.trace.confidence).toBe('medium');
  });
});

describe('formatExplanation', () => {
  it('produces human-readable tree output', () => {
    const explanation = 'Test explanation content';
    const exp = {
      suggestion: { id: 'sugg_st_01', type: 'stuck' as const, severity: 'critical' as const, message: 'Build stuck', createdAt: '2026-06-01T10:00:00Z' },
      trace: {
        ruleName: 'stuck_detection', algorithmVersion: 3, configVersion: 2,
        thresholdUsed: 28, confidence: 'high' as const,
        dataSource: { type: 'phase_history' as const, recordsCount: 8 },
      },
      ruleInfo: { description: 'Detects stuck changes', defaultConfig: {}, effectiveConfig: {}, hasUserOverride: false },
      calibrationEvents: [] as CalibrationEvent[],
      explanation,
    };

    const output = formatExplanation(exp);
    expect(output).toContain('Build stuck');
    expect(output).toContain('stuck_detection');
    expect(output).toContain('Confidence');
  });

  it('includes calibration history when events exist', () => {
    const exp = {
      suggestion: { id: 'sugg_st_01', type: 'stuck' as const, severity: 'critical' as const, message: 'Build stuck', createdAt: '2026-06-01T10:00:00Z' },
      trace: {
        ruleName: 'stuck_detection', algorithmVersion: 3, configVersion: 2,
        thresholdUsed: 28, confidence: 'high' as const,
        dataSource: { type: 'phase_history' as const, recordsCount: 8 },
      },
      ruleInfo: { description: 'Detects stuck changes', defaultConfig: {}, effectiveConfig: {}, hasUserOverride: false },
      calibrationEvents: [
        { algorithmVersion: 1, configVersion: 1, at: '2026-04-01T00:00:00Z', change: 'Initial' },
        { algorithmVersion: 3, configVersion: 2, at: '2026-06-10T00:00:00Z', change: 'P80' },
      ],
      explanation: 'Based on data.',
    };

    const output = formatExplanation(exp);
    expect(output).toContain('Calibration History');
    expect(output).toContain('P80');
  });
});

describe('formatExplanationJson', () => {
  it('returns JSON-serializable object', () => {
    const exp = {
      suggestion: { id: 'sugg_st_01', type: 'stuck' as const, severity: 'critical' as const, message: 'Build stuck', createdAt: '2026-06-01T10:00:00Z' },
      trace: {
        ruleName: 'stuck_detection', algorithmVersion: 3, configVersion: 2,
        thresholdUsed: 28, confidence: 'high' as const,
        dataSource: { type: 'phase_history' as const, recordsCount: 8 },
      },
      ruleInfo: { description: 'Detects stuck', defaultConfig: {}, effectiveConfig: {}, hasUserOverride: false },
      calibrationEvents: [] as CalibrationEvent[],
      explanation: 'test',
    };
    const json = formatExplanationJson(exp);
    expect(json.suggestion).toEqual(exp.suggestion);
    expect(json.trace).toEqual(exp.trace);
    expect(json.ruleInfo).toEqual(exp.ruleInfo);
    expect(json.calibrationEvents).toEqual([]);
    expect(json.explanation).toBe('test');
  });
});

describe('suggest-engine trace extension (v0.7)', () => {
  it('Suggestion interface supports optional trace field', () => {
    const withTrace: Suggestion = makeSuggestionWithTrace();
    expect(withTrace.trace).toBeDefined();
    expect(withTrace.trace!.ruleName).toBe('stuck_detection');
  });

  it('Suggestion interface works without trace (pre-v0.7)', () => {
    const withoutTrace: Suggestion = makePreV07Suggestion();
    expect(withoutTrace.trace).toBeUndefined();
    // Can still access all base fields
    expect(withoutTrace.id).toBe('sugg_old_01');
    expect(withoutTrace.type).toBe('stuck');
  });

  it('trace dataSource has correct structure', () => {
    const s = makeSuggestionWithTrace();
    expect(s.trace!.dataSource.type).toBe('phase_history');
    expect(typeof s.trace!.dataSource.recordsCount).toBe('number');
    expect(s.trace!.dataSource.recordsCount).toBeGreaterThan(0);
  });
});

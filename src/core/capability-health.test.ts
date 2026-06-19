import { describe, it, expect } from 'vitest';
import {
  assessCoverage,
  assessDrift,
  assessRisk,
  generateHealthReport,
} from './capability-health.js';

describe('capability-health', () => {
  // ─── Coverage ───

  describe('assessCoverage', () => {
    it('TC-22: full coverage when all expected are actual', () => {
      const result = assessCoverage(['react', 'nextjs'], ['react', 'nextjs']);
      expect(result.ratio).toBe(1);
      expect(result.gaps).toHaveLength(0);
    });

    it('TC-23: missing rule shown as coverage gap with severity high', () => {
      const result = assessCoverage(
        ['react', 'nextjs', 'e2e-playwright'],
        ['react', 'nextjs']
      );
      expect(result.ratio).toBeLessThan(1);
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]).toEqual(
        expect.objectContaining({
          type: 'rule',
          expectedItem: 'e2e-playwright',
          severity: 'high',
        })
      );
    });

    it('TC-24: missing skill shown as coverage gap with actionability', () => {
      const result = assessCoverage(
        ['react', 'code-reviewer'],
        ['react']
      );
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]).toEqual(
        expect.objectContaining({
          type: 'skill',
          actionability: 'suggestion_only',
        })
      );
    });

    it('TC-25: missing verification shown as coverage gap', () => {
      const result = assessCoverage(
        ['react', 'verify-unit-test'],
        ['react']
      );
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]).toEqual(
        expect.objectContaining({
          type: 'verification',
          actionability: 'manual_required',
        })
      );
    });

    it('returns ratio 0 when no actual capabilities', () => {
      const result = assessCoverage(['react'], []);
      expect(result.ratio).toBe(0);
    });

    it('returns ratio 1 when no expected capabilities', () => {
      const result = assessCoverage([], []);
      expect(result.ratio).toBe(1);
    });
  });

  // ─── Drift ───

  describe('assessDrift', () => {
    it('TC-26: stable tech stack shows zero drift', () => {
      const result = assessDrift(['react', 'nextjs'], ['react', 'nextjs']);
      expect(result.rate).toBe(0);
      expect(result.changes).toHaveLength(0);
    });

    it('TC-27: tech stack change shows drift', () => {
      const result = assessDrift(
        ['react', 'nextjs'],
        ['react', 'nextjs', 'express']
      );
      expect(result.rate).toBeGreaterThan(0);
      expect(result.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'added', item: 'express' }),
        ])
      );
    });

    it('detects removed items', () => {
      const result = assessDrift(
        ['react', 'nextjs', 'express'],
        ['react', 'nextjs']
      );
      expect(result.changes).toContainEqual(
        expect.objectContaining({ type: 'removed', item: 'express' })
      );
    });

    it('returns rate 0 when previous is empty', () => {
      const result = assessDrift([], ['react']);
      expect(result.rate).toBe(0);
    });
  });

  // ─── Risk ───

  describe('assessRisk', () => {
    it('TC-28: stale rule flagged as risk', () => {
      const result = assessRisk(['express'], ['react', 'nextjs'], []);
      expect(result.flags).toContainEqual(
        expect.objectContaining({
          type: 'stale',
          items: ['express'],
        })
      );
    });

    it('TC-29: rule conflict flagged as risk', () => {
      const result = assessRisk(
        ['react'],
        ['react'],
        [{ ruleA: 'rule-a', ruleB: 'rule-b' }]
      );
      expect(result.flags).toContainEqual(
        expect.objectContaining({
          type: 'conflict',
          items: ['rule-a', 'rule-b'],
        })
      );
    });

    it('returns no flags when no stale or conflicts', () => {
      const result = assessRisk(['react'], ['react'], []);
      expect(result.flags).toHaveLength(0);
    });
  });

  // ─── Orchestrator ───

  describe('generateHealthReport', () => {
    it('TC-30: health report has no aggregate status', () => {
      const report = generateHealthReport(
        ['react'],
        ['react'],
        ['react'],
        ['react'],
        []
      );
      expect(report).not.toHaveProperty('status');
      expect(report).not.toHaveProperty('score');
      expect(report).not.toHaveProperty('overallHealth');
    });

    it('TC-31: gaps include actionability levels', () => {
      const report = generateHealthReport(
        ['react', 'express'],
        ['react'],
        [],
        ['react'],
        []
      );
      expect(report.coverage.gaps).toHaveLength(1);
      expect(report.coverage.gaps[0]).toHaveProperty('actionability');
      expect(['auto_fixable', 'suggestion_only', 'manual_required']).toContain(
        report.coverage.gaps[0].actionability
      );
    });

    it('includes all three dimensions', () => {
      const report = generateHealthReport(
        ['react'],
        ['react'],
        [],
        ['react'],
        []
      );
      expect(report).toHaveProperty('coverage');
      expect(report).toHaveProperty('drift');
      expect(report).toHaveProperty('risk');
      expect(report).toHaveProperty('timestamp');
    });

    it('consistent results across runs', () => {
      const report1 = generateHealthReport(
        ['react'],
        ['react'],
        [],
        ['react'],
        []
      );
      const report2 = generateHealthReport(
        ['react'],
        ['react'],
        [],
        ['react'],
        []
      );
      expect(report1.coverage.ratio).toBe(report2.coverage.ratio);
      expect(report1.drift.rate).toBe(report2.drift.rate);
      expect(report1.risk.flags).toEqual(report2.risk.flags);
    });
  });
});

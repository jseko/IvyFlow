/**
 * Tests for workflow-evidence.ts — transition rationale + refs + archive check.
 *
 * v0.13: Governed Execution — Workflow Evidence.
 * Covers: TC-21, TC-23 through TC-26.
 */

import { describe, it, expect } from 'vitest';

import {
  buildWorkflowEvidenceReport,
  checkArchiveReadiness,
  type WorkflowEvidenceEntry,
} from './workflow-evidence.js';

describe('workflow-evidence', () => {
  function sampleEntries(): WorkflowEvidenceEntry[] {
    return [
      {
        transition: 'open→design',
        rationale: 'All proposal artifacts created',
        refs: ['ev-001', 'ev-002'],
        timestamp: '2026-06-18T10:00:00.000Z',
      },
      {
        transition: 'design→build',
        rationale: 'Design approved by team',
        refs: ['ev-003'],
        timestamp: '2026-06-18T11:00:00.000Z',
      },
    ];
  }

  // TC-21: Transition records rationale + refs
  describe('transition records (TC-21)', () => {
    it('should build report with entries', () => {
      const entries = sampleEntries();
      const report = buildWorkflowEvidenceReport('test-change', entries);
      expect(report.changeName).toBe('test-change');
      expect(report.entries).toHaveLength(2);
      expect(report.totalTransitions).toBe(2);
      expect(report.documentedTransitions).toBe(2);
    });

    it('should store rationale text in entry', () => {
      const entries = sampleEntries();
      expect(entries[0].rationale).toBe('All proposal artifacts created');
      expect(entries[0].refs).toEqual(['ev-001', 'ev-002']);
    });

    it('should store refs array in entry', () => {
      const entries = sampleEntries();
      expect(entries[1].refs).toEqual(['ev-003']);
    });
  });

  // TC-23: Missing rationale
  describe('missing rationale (TC-23)', () => {
    it('should count transitions with empty rationale as undocumented', () => {
      const entries: WorkflowEvidenceEntry[] = [
        {
          transition: 'open→design',
          rationale: '',
          refs: [],
          timestamp: '2026-06-18T10:00:00.000Z',
        },
      ];
      const report = buildWorkflowEvidenceReport('test', entries);
      expect(report.totalTransitions).toBe(1);
      expect(report.documentedTransitions).toBe(0);
    });

    it('should count transitions with whitespace-only rationale as undocumented', () => {
      const entries: WorkflowEvidenceEntry[] = [
        {
          transition: 'open→design',
          rationale: '   ',
          refs: [],
          timestamp: '2026-06-18T10:00:00.000Z',
        },
      ];
      const report = buildWorkflowEvidenceReport('test', entries);
      expect(report.documentedTransitions).toBe(0);
    });
  });

  // TC-24: Archive check pass
  describe('archive check pass (TC-24)', () => {
    it('should pass when all transitions have rationale and refs', () => {
      const entries = sampleEntries();
      const report = buildWorkflowEvidenceReport('test', entries);
      const result = checkArchiveReadiness(report);
      expect(result.ready).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  // TC-25: Archive check fail
  describe('archive check fail (TC-25)', () => {
    it('should fail when a transition has no rationale', () => {
      const entries: WorkflowEvidenceEntry[] = [
        {
          transition: 'open→design',
          rationale: '',
          refs: ['ev-001'],
          timestamp: '2026-06-18T10:00:00.000Z',
        },
      ];
      const report = buildWorkflowEvidenceReport('test', entries);
      const result = checkArchiveReadiness(report);
      expect(result.ready).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toContain('open→design');
      expect(result.issues[0]).toContain('no rationale');
    });

    it('should fail when a transition has no refs', () => {
      const entries: WorkflowEvidenceEntry[] = [
        {
          transition: 'open→design',
          rationale: 'All good',
          refs: [],
          timestamp: '2026-06-18T10:00:00.000Z',
        },
      ];
      const report = buildWorkflowEvidenceReport('test', entries);
      const result = checkArchiveReadiness(report);
      expect(result.ready).toBe(false);
      expect(result.issues[0]).toContain('no evidence refs');
    });

    it('should list multiple issues when multiple transitions fail', () => {
      const entries: WorkflowEvidenceEntry[] = [
        {
          transition: 'open→design',
          rationale: '',
          refs: [],
          timestamp: '2026-06-18T10:00:00.000Z',
        },
        {
          transition: 'design→build',
          rationale: 'ok',
          refs: [],
          timestamp: '2026-06-18T11:00:00.000Z',
        },
      ];
      const report = buildWorkflowEvidenceReport('test', entries);
      const result = checkArchiveReadiness(report);
      expect(result.ready).toBe(false);
      expect(result.issues.length).toBeGreaterThanOrEqual(2);
    });
  });

  // TC-26: JSON export (test report structure is JSON-serializable)
  describe('JSON export readiness (TC-26)', () => {
    it('should produce JSON-serializable report', () => {
      const entries = sampleEntries();
      const report = buildWorkflowEvidenceReport('json-test', entries);
      const json = JSON.stringify(report);
      const parsed = JSON.parse(json);
      expect(parsed.changeName).toBe('json-test');
      expect(parsed.entries).toHaveLength(2);
      expect(parsed.totalTransitions).toBe(2);
      expect(parsed.documentedTransitions).toBe(2);
    });
  });

  // TC-22: Complete workflow evidence chain
  describe('complete evidence chain (TC-22)', () => {
    function fullCycleEntries(): WorkflowEvidenceEntry[] {
      return [
        {
          transition: '(start)→open',
          rationale: 'New change created',
          refs: ['ev-init'],
          timestamp: '2026-06-17T10:00:00.000Z',
        },
        {
          transition: 'open→design',
          rationale: 'All artifacts created',
          refs: ['ev-001'],
          timestamp: '2026-06-17T14:00:00.000Z',
        },
        {
          transition: 'design→build',
          rationale: 'Design approved and brainstorming confirmed',
          refs: ['ev-015', 'decision_confirmed:dp-3'],
          timestamp: '2026-06-18T11:15:00.000Z',
        },
        {
          transition: 'build→verify',
          rationale: 'Build complete, all tests pass',
          refs: ['ev-022', 'ev-023'],
          timestamp: '2026-06-19T09:00:00.000Z',
        },
        {
          transition: 'verify→archive',
          rationale: 'Evidence Gate passed, all reviews complete',
          refs: ['ev-030'],
          timestamp: '2026-06-20T16:00:00.000Z',
        },
      ];
    }

    it('should report all 5 transitions in order', () => {
      const entries = fullCycleEntries();
      const report = buildWorkflowEvidenceReport('full-cycle-test', entries);
      expect(report.totalTransitions).toBe(5);
      expect(report.entries[0].transition).toBe('(start)→open');
      expect(report.entries[4].transition).toBe('verify→archive');
    });

    it('should count all transitions as documented with rationale', () => {
      const entries = fullCycleEntries();
      const report = buildWorkflowEvidenceReport('full-cycle-test', entries);
      expect(report.documentedTransitions).toBe(5);
    });

    it('should pass archive readiness check with complete chain', () => {
      const entries = fullCycleEntries();
      const report = buildWorkflowEvidenceReport('full-cycle-test', entries);
      const readiness = checkArchiveReadiness(report);
      expect(readiness.ready).toBe(true);
      expect(readiness.issues).toHaveLength(0);
    });

    it('should include decision protocol references in refs', () => {
      const entries = fullCycleEntries();
      const designToBuild = entries[2];
      expect(designToBuild.refs).toContain('decision_confirmed:dp-3');
    });
  });
});

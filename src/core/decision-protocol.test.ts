/**
 * Tests for decision-protocol.ts — DP-1/DP-3/DP-4/DP-8 + event hooks.
 *
 * v0.13: Governed Execution — Decision Protocol.
 * Covers: TC-10 through TC-13.
 */

import { describe, it, expect } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import {
  DEFAULT_DECISION_PROTOCOL,
  DECISION_POINT_CHECKPOINTS,
  getDecisionPointsForCheckpoint,
  canProceedWithTransition,
  readDecisionProtocolConfig,
  type DecisionProtocolConfig,
} from './decision-protocol.js';

describe('decision-protocol', () => {
  // TC-10: Decision point triggers at right checkpoint
  describe('decision point triggers (TC-10)', () => {
    it('should trigger DP-1 at open checkpoint', () => {
      const points = getDecisionPointsForCheckpoint('open', DEFAULT_DECISION_PROTOCOL);
      expect(points).toHaveLength(1);
      expect(points[0].id).toBe('DP-1');
      expect(points[0].point).toBe('requirements_confirmed');
      expect(points[0].checkpoint).toBe('open');
    });

    it('should trigger DP-3 at design checkpoint', () => {
      const points = getDecisionPointsForCheckpoint('design', DEFAULT_DECISION_PROTOCOL);
      expect(points).toHaveLength(1);
      expect(points[0].id).toBe('DP-3');
      expect(points[0].point).toBe('design_approved');
    });

    it('should trigger DP-4 at build checkpoint', () => {
      const points = getDecisionPointsForCheckpoint('build', DEFAULT_DECISION_PROTOCOL);
      expect(points).toHaveLength(1);
      expect(points[0].id).toBe('DP-4');
      expect(points[0].point).toBe('implementation_ready');
    });

    it('should trigger DP-8 at archive checkpoint', () => {
      const points = getDecisionPointsForCheckpoint('archive', DEFAULT_DECISION_PROTOCOL);
      expect(points).toHaveLength(1);
      expect(points[0].id).toBe('DP-8');
      expect(points[0].point).toBe('archive_confirmed');
    });

    it('should return no points for verify checkpoint', () => {
      const points = getDecisionPointsForCheckpoint('verify', DEFAULT_DECISION_PROTOCOL);
      expect(points).toHaveLength(0);
    });
  });

  // TC-11: Decision point blocks
  describe('decision point blocks (TC-11)', () => {
    it('should block transition when required point is pending', () => {
      const { allowed, pendingPoints } = canProceedWithTransition('open', 'open', DEFAULT_DECISION_PROTOCOL);
      expect(allowed).toBe(false);
      expect(pendingPoints.length).toBeGreaterThan(0);
    });

    it('should allow transition when disabled', () => {
      const disabledConfig: DecisionProtocolConfig = { ...DEFAULT_DECISION_PROTOCOL, enabled: false };
      const { allowed, pendingPoints } = canProceedWithTransition('open', 'open', disabledConfig);
      expect(allowed).toBe(true);
      expect(pendingPoints).toHaveLength(0);
    });
  });

  // TC-12: Auto-approve
  describe('auto-approve (TC-12)', () => {
    it('should auto-approve failure_strategy hook by default', () => {
      expect(DEFAULT_DECISION_PROTOCOL.autoApproveHooks).toContain('failure_strategy');
    });

    it('should mark decision point as approved when auto-approved', () => {
      const config: DecisionProtocolConfig = {
        ...DEFAULT_DECISION_PROTOCOL,
        autoApprovePoints: ['requirements_confirmed'],
      };
      const points = getDecisionPointsForCheckpoint('open', config);
      const dp1 = points.find((p) => p.id === 'DP-1');
      expect(dp1).toBeDefined();
      expect(dp1!.status).toBe('approved');
    });

    it('should allow transition with all points auto-approved', () => {
      const config: DecisionProtocolConfig = {
        ...DEFAULT_DECISION_PROTOCOL,
        autoApprovePoints: ['requirements_confirmed', 'design_approved', 'implementation_ready', 'archive_confirmed'],
      };
      const { allowed } = canProceedWithTransition('open', 'open', config);
      expect(allowed).toBe(true);
    });
  });

  // TC-13: Config from project.yaml
  describe('config read/write (TC-13)', () => {
    it('should return disabled config when no project.yaml', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-dp-config-'));
      const config = await readDecisionProtocolConfig(tmpDir);
      expect(config.enabled).toBe(false);
    });

    it('should return default config when no decision_protocol section', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-dp-config-'));
      await fs.mkdir(path.join(tmpDir, '.ivy'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, '.ivy', 'project.yaml'), 'version: 0.13.0\n');
      const config = await readDecisionProtocolConfig(tmpDir);
      expect(config.enabled).toBe(true);
    });

    it('should merge custom config with defaults', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-dp-config-'));
      await fs.mkdir(path.join(tmpDir, '.ivy'), { recursive: true });
      await fs.writeFile(
        path.join(tmpDir, '.ivy', 'project.yaml'),
        'workflow:\n  decision_protocol:\n    enabled: true\n    autoApprovePoints:\n      - requirements_confirmed\n'
      );
      const config = await readDecisionProtocolConfig(tmpDir);
      expect(config.enabled).toBe(true);
      expect(config.autoApprovePoints).toContain('requirements_confirmed');
      // Default required points should still be present
      expect(config.requiredPoints).toContain('design_approved');
      expect(config.requiredPoints).toContain('implementation_ready');
    });
  });

  // TC-14: Decision point ↔ lifecycle integration
  describe('decision point ↔ lifecycle (TC-14)', () => {
    it('should block design transition when DP-1 is pending', () => {
      const config: DecisionProtocolConfig = { ...DEFAULT_DECISION_PROTOCOL, autoApprovePoints: [] };
      const { allowed, pendingPoints } = canProceedWithTransition('open', 'open', config);
      expect(allowed).toBe(false);
      expect(pendingPoints.some((p) => p.id === 'DP-1')).toBe(true);
    });

    it('should allow open→build when all open DPs are auto-approved', () => {
      const config: DecisionProtocolConfig = {
        ...DEFAULT_DECISION_PROTOCOL,
        autoApprovePoints: ['requirements_confirmed'],
      };
      const { allowed } = canProceedWithTransition('open', 'open', config);
      expect(allowed).toBe(true);
    });

    it('should block build→verify when DP-4 is pending', () => {
      const { allowed, pendingPoints } = canProceedWithTransition('build', 'build', DEFAULT_DECISION_PROTOCOL);
      expect(allowed).toBe(false);
      expect(pendingPoints.some((p) => p.id === 'DP-4')).toBe(true);
    });

    it('should block archive when DP-8 is pending', () => {
      const { allowed } = canProceedWithTransition('archive', 'archive', DEFAULT_DECISION_PROTOCOL);
      expect(allowed).toBe(false);
    });
  });
});

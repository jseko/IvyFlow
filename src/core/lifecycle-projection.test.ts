/**
 * Tests for lifecycle-projection.ts — L1 checkpoint model.
 *
 * v0.13: Governed Execution — Lifecycle Projection.
 * Covers: TC-1 through TC-9.
 */

import { describe, it, expect } from 'vitest';
import path from 'path';
import os from 'os';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';

import {
  createInitialState,
  applyTransition,
  isBackwardTransition,
  readState,
  writeState,
  runGuardChecks,
  runCapabilityGuards,
  validateVerifyProfile,
  checkRuleCompliance,
  runFullGuardChecks,
  type StateYaml,
  type LifecycleCheckpoint,
  type CapabilityGuardResult,
  type GuardPreset,
  type VerifyProfile,
} from './lifecycle-projection.js';
import { IvyPhase } from './phase-machine.js';

function makeTestState(overrides?: Partial<StateYaml>): StateYaml {
  return {
    changeName: 'test-change',
    checkpoint: 'open' as LifecycleCheckpoint,
    enteredAt: '2026-06-18T10:00:00.000Z',
    lastTransitionAt: '2026-06-18T10:00:00.000Z',
    transitionHistory: [
      { from: null, to: 'open' as LifecycleCheckpoint, timestamp: '2026-06-18T10:00:00.000Z' },
    ],
    ...overrides,
  };
}

describe('lifecycle-projection', () => {
  // TC-1: Checkpoint file read/write
  describe('state file read/write (TC-1)', () => {
    it('should write and read state yaml correctly', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-lc-test-'));
      const state = makeTestState({ changeName: 'tc-1-change' });
      await writeState(tmpDir, state, 'tc-1-change');

      const read = await readState(tmpDir, 'tc-1-change');
      expect(read).not.toBeNull();
      expect(read!.changeName).toBe('tc-1-change');
      expect(read!.checkpoint).toBe('open');
      expect(read!.transitionHistory).toHaveLength(1);
      expect(read!.transitionHistory[0].from).toBeNull();
      expect(read!.transitionHistory[0].to).toBe('open');
    });

    it('should return null for non-existent state file', async () => {
      const result = await readState('/tmp/nonexistent-ivy-dir');
      expect(result).toBeNull();
    });
  });

  // TC-2: Forward transition
  describe('forward transition (TC-2)', () => {
    it('should transition open → design', () => {
      const state = makeTestState();
      const result = applyTransition(state, IvyPhase.DESIGN as LifecycleCheckpoint, 'All artifacts created');
      expect(result.checkpoint).toBe('design');
      expect(result.transitionHistory).toHaveLength(2);
      expect(result.transitionHistory[0].from).toBe('open');
      expect(result.transitionHistory[0].to).toBe('design');
      expect(result.transitionHistory[0].rationale).toBe('All artifacts created');
    });

    it('should transition design → build', () => {
      const state = makeTestState({ checkpoint: 'design' as LifecycleCheckpoint });
      const result = applyTransition(state, IvyPhase.BUILD as LifecycleCheckpoint, 'Design approved');
      expect(result.checkpoint).toBe('build');
    });

    it('should transition build → verify', () => {
      const state = makeTestState({ checkpoint: 'build' as LifecycleCheckpoint });
      const result = applyTransition(state, IvyPhase.VERIFY as LifecycleCheckpoint, 'Build complete');
      expect(result.checkpoint).toBe('verify');
    });

    it('should transition verify → archive', () => {
      const state = makeTestState({ checkpoint: 'verify' as LifecycleCheckpoint });
      const result = applyTransition(state, IvyPhase.ARCHIVE as LifecycleCheckpoint, 'Everything passed');
      expect(result.checkpoint).toBe('archive');
    });
  });

  // TC-3: Backward transitions
  describe('backward transitions (TC-3)', () => {
    it('should allow build → design without force', () => {
      const state = makeTestState({ checkpoint: 'build' as LifecycleCheckpoint });
      const result = applyTransition(state, IvyPhase.DESIGN as LifecycleCheckpoint, 'Spec revision needed');
      expect(result.checkpoint).toBe('design');
    });

    it('should allow verify → build without force', () => {
      const state = makeTestState({ checkpoint: 'verify' as LifecycleCheckpoint });
      const result = applyTransition(state, IvyPhase.BUILD as LifecycleCheckpoint, 'Fixing failing tests');
      expect(result.checkpoint).toBe('build');
    });
  });

  // TC-4: Guard check passes
  describe('guard checks (TC-4, TC-5)', () => {
    it('should pass guard when artifacts exist (TC-4)', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-lc-guard-'));
      const changeDir = path.join(tmpDir, 'openspec', 'changes', 'guard-test');
      await fs.mkdir(changeDir, { recursive: true });
      await fs.writeFile(path.join(changeDir, 'proposal.md'), '# Proposal');
      await fs.writeFile(path.join(changeDir, 'design.md'), '# Design');
      await fs.mkdir(path.join(changeDir, 'specs'), { recursive: true });
      await fs.writeFile(path.join(changeDir, 'tasks.md'), '# Tasks');

      const results = await runGuardChecks(tmpDir, 'design' as LifecycleCheckpoint, 'build' as LifecycleCheckpoint, 'guard-test');
      expect(results.every((r) => r.passed)).toBe(true);
    });

    it('should fail guard when artifacts missing (TC-5)', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-lc-guard-fail-'));
      const changeDir = path.join(tmpDir, 'openspec', 'changes', 'guard-fail');
      await fs.mkdir(changeDir, { recursive: true });

      const results = await runGuardChecks(tmpDir, 'design' as LifecycleCheckpoint, 'build' as LifecycleCheckpoint, 'guard-fail');
      expect(results.some((r) => !r.passed)).toBe(true);
    });
  });

  // TC-6: Transition history
  describe('transition history (TC-6)', () => {
    it('should record each transition in order', () => {
      let state = makeTestState();
      expect(state.transitionHistory).toHaveLength(1);

      state = applyTransition(state, IvyPhase.DESIGN as LifecycleCheckpoint, 'Artifacts ready');
      expect(state.transitionHistory).toHaveLength(2);

      state = applyTransition(state, IvyPhase.BUILD as LifecycleCheckpoint, 'Design approved');
      expect(state.transitionHistory).toHaveLength(3);

      // Most recent first
      expect(state.transitionHistory[0].from).toBe('design');
      expect(state.transitionHistory[0].to).toBe('build');
      expect(state.transitionHistory[2].from).toBeNull();
      expect(state.transitionHistory[2].to).toBe('open');
    });

    it('should store refs when provided', () => {
      const state = makeTestState();
      const result = applyTransition(state, IvyPhase.DESIGN as LifecycleCheckpoint, 'Done', ['ev-001', 'ev-002']);
      expect(result.transitionHistory[0].refs).toEqual(['ev-001', 'ev-002']);
    });
  });

  // TC-8: Recover (test via creation + readState)
  describe('recover (TC-8)', () => {
    it('should preserve state across write/read cycle', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-lc-recover-'));
      const original = makeTestState({ changeName: 'recover-test', checkpoint: 'build' as LifecycleCheckpoint });
      await writeState(tmpDir, original, 'recover-test');

      const recovered = await readState(tmpDir, 'recover-test');
      expect(recovered).not.toBeNull();
      expect(recovered!.changeName).toBe('recover-test');
      expect(recovered!.checkpoint).toBe('build');
      expect(recovered!.enteredAt).toBe(original.enteredAt);
      expect(recovered!.lastTransitionAt).toBe(original.lastTransitionAt);
    });
  });

  // TC-9: History cap at 10
  describe('history cap at 10 (TC-9)', () => {
    it('should cap transition history at 10 entries', () => {
      let state = makeTestState();
      const phases = [
        IvyPhase.DESIGN, IvyPhase.BUILD, IvyPhase.VERIFY, IvyPhase.BUILD, IvyPhase.DESIGN, IvyPhase.BUILD,
        IvyPhase.VERIFY, IvyPhase.BUILD, IvyPhase.DESIGN, IvyPhase.BUILD, IvyPhase.VERIFY,
      ] as const;

      for (const p of phases) {
        state = applyTransition(state, p as LifecycleCheckpoint);
      }

      expect(state.transitionHistory.length).toBeLessThanOrEqual(10);
      // Most recent 10 stored, oldest dropped
      expect(state.transitionHistory.length).toBe(10);
    });
  });

  describe('isBackwardTransition', () => {
    it('should detect backward transitions correctly', () => {
      expect(isBackwardTransition('build' as LifecycleCheckpoint, 'design' as LifecycleCheckpoint)).toBe(true);
      expect(isBackwardTransition('verify' as LifecycleCheckpoint, 'build' as LifecycleCheckpoint)).toBe(true);
      expect(isBackwardTransition('verify' as LifecycleCheckpoint, 'design' as LifecycleCheckpoint)).toBe(true);
      expect(isBackwardTransition('open' as LifecycleCheckpoint, 'design' as LifecycleCheckpoint)).toBe(false);
      expect(isBackwardTransition('design' as LifecycleCheckpoint, 'build' as LifecycleCheckpoint)).toBe(false);
      expect(isBackwardTransition('archive' as LifecycleCheckpoint, 'verify' as LifecycleCheckpoint)).toBe(true);
    });
  });

  // ─── Sprint 15.4: Capability Guards (TC-18~TC-21) ───

  describe('Sprint 15.4: Capability Guards', () => {
    // TC-18: Verify integration — capability gaps display as advisory and do NOT block
    describe('TC-18: Capability gaps are advisory (warn-level) and non-blocking', () => {
      it('capability guards have severity field (warning or advisory)', async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-cap-guard-'));
        await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({
          name: 'test',
          dependencies: { react: '^18.0.0' },
        }));

        const results = await runCapabilityGuards(tmpDir, 'test-change', 'full');

        for (const r of results) {
          expect(r).toHaveProperty('severity');
          expect(['warning', 'advisory']).toContain((r as CapabilityGuardResult).severity);
        }
      });

      it('verify checkpoint includes capability guards in full guard checks', async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-full-guard-'));
        const changeDir = path.join(tmpDir, 'openspec', 'changes', 'test-change');
        await fs.mkdir(changeDir, { recursive: true });
        await fs.writeFile(path.join(changeDir, 'proposal.md'), '# Proposal');
        await fs.writeFile(path.join(changeDir, 'design.md'), '# Design');
        await fs.mkdir(path.join(changeDir, 'specs'), { recursive: true });
        await fs.writeFile(path.join(changeDir, 'tasks.md'), '# Tasks');

        // Create .ivy directory with verify.yaml and rules.yaml so capability checks pass
        const ivyDir = path.join(tmpDir, '.ivy');
        await fs.mkdir(ivyDir, { recursive: true });
        await fs.writeFile(path.join(ivyDir, 'verify.yaml'), 'compile: true\nunitTest: true\nintegrationTest: true\ne2e: true\nlint: true\ncoverage: 80\n');
        await fs.writeFile(path.join(ivyDir, 'rules.yaml'), 'rules:\n  - id: test-rule\n    tier: context\n    tech_stack_trigger: []\n');

        const { standard, capability } = await runFullGuardChecks(
          tmpDir,
          'build' as LifecycleCheckpoint,
          'verify' as LifecycleCheckpoint,
          'test-change',
          'full' as GuardPreset
        );

        // Standard checks pass (artifacts exist + capability checks pass)
        expect(standard.every(r => r.passed)).toBe(true);
        // Capability guards present
        expect(capability).toBeDefined();
        expect(capability.length).toBeGreaterThan(0);
      });
    });

    // TC-19: Hotfix skip — rule generation skipped
    describe('TC-19: Preset system skips checks appropriately', () => {
      it('hotfix preset skips capability detection', async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-hotfix-'));
        const results = await runCapabilityGuards(tmpDir, 'test-change', 'hotfix');
        expect(results).toHaveLength(1);
        expect(results[0].check).toBe('Capability detection');
        expect(results[0].message).toContain('Skipped (preset: hotfix)');
      });

      it('tweak preset skips capability detection', async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-tweak-'));
        const results = await runCapabilityGuards(tmpDir, 'test-change', 'tweak');
        expect(results).toHaveLength(1);
        expect(results[0].message).toContain('Skipped (preset: tweak)');
      });

      it('full preset runs capability detection', async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-full-'));
        await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({
          name: 'test',
          dependencies: { react: '^18.0.0' },
        }));
        const results = await runCapabilityGuards(tmpDir, 'test-change', 'full');
        // Should have results from detection (not just skip message)
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].message).toBeDefined();
      });
    });

    // TC-20: Manual verify profile validation
    describe('TC-20: Verify profile validation', () => {
      it('empty profile returns advisory pass', async () => {
        const result = await validateVerifyProfile('/tmp', null);
        expect(result.passed).toBe(true);
        expect(result.severity).toBe('advisory');
        expect(result.message).toContain('No verify profile');
      });

      it('profile with missing gates returns warning', async () => {
        const profile: VerifyProfile = { compile: true, unitTest: false };
        const result = await validateVerifyProfile('/tmp', profile);
        expect(result.passed).toBe(false);
        expect(result.severity).toBe('warning');
        expect(result.message).toContain('unit test');
      });

      it('complete profile returns advisory pass', async () => {
        const profile: VerifyProfile = {
          compile: true,
          unitTest: true,
          integrationTest: true,
          e2e: true,
          lint: true,
          coverage: 80,
        };
        const result = await validateVerifyProfile('/tmp', profile);
        expect(result.passed).toBe(true);
        expect(result.severity).toBe('advisory');
      });
    });

    // TC-21: Rule compliance check
    describe('TC-21: Rule compliance', () => {
      it('returns compliant with no violations', async () => {
        const result = await checkRuleCompliance('/tmp', 'test-change');
        expect(result.compliant).toBe(true);
        expect(result.violations).toHaveLength(0);
      });
    });
  });
});

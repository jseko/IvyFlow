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
  type StateYaml,
  type LifecycleCheckpoint,
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
      await writeState(tmpDir, state);

      const read = await readState(tmpDir);
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
      await writeState(tmpDir, original);

      const recovered = await readState(tmpDir);
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

  // TC-18: Verify integration — guard checks include capability checks on build→verify
  describe('verify integration with capability checks (TC-18)', () => {
    it('should add capability checks for build→verify transition', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-lc-cap-verify-'));
      const changeDir = path.join(tmpDir, 'openspec', 'changes', 'cap-test');
      await fs.mkdir(changeDir, { recursive: true });
      await fs.writeFile(path.join(changeDir, 'proposal.md'), '# Proposal');
      await fs.writeFile(path.join(changeDir, 'design.md'), '# Design');
      await fs.writeFile(path.join(changeDir, 'tasks.md'), '# Tasks');

      const results = await runGuardChecks(tmpDir, 'build' as LifecycleCheckpoint, 'verify' as LifecycleCheckpoint, 'cap-test');

      // Standard checks still pass
      expect(results.some((r) => r.check === 'proposal.md exists' && r.passed)).toBe(true);
      expect(results.some((r) => r.check === 'design.md exists' && r.passed)).toBe(true);
      expect(results.some((r) => r.check === 'tasks.md exists' && r.passed)).toBe(true);

      // Capability checks are present (may be advisory-only)
      const capChecks = results.filter((r) => r.check.startsWith('Verify profile') || r.check.startsWith('Rules deployed') || r.check.startsWith('Capability gap'));
      expect(capChecks.length).toBeGreaterThanOrEqual(1);
    });

    it('should mark capability checks as warning severity (non-blocking)', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-lc-cap-warn-'));
      const changeDir = path.join(tmpDir, 'openspec', 'changes', 'cap-warn');
      await fs.mkdir(changeDir, { recursive: true });
      await fs.writeFile(path.join(changeDir, 'proposal.md'), '# Proposal');
      await fs.writeFile(path.join(changeDir, 'design.md'), '# Design');
      await fs.writeFile(path.join(changeDir, 'tasks.md'), '# Tasks');

      const results = await runGuardChecks(tmpDir, 'build' as LifecycleCheckpoint, 'verify' as LifecycleCheckpoint, 'cap-warn');

      // Capability-related checks should be warning severity
      for (const r of results) {
        if (r.check.startsWith('Verify profile') || r.check.startsWith('Rules deployed') || r.check.startsWith('Capability gap')) {
          expect(r.severity).toBe('warning');
        }
      }
    });
  });

  // TC-19: Capability gaps do not block transitions
  describe('capability gaps non-blocking (TC-19)', () => {
    it('should allow build→verify transition even without capability artifacts', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-lc-cap-nonblock-'));
      const changeDir = path.join(tmpDir, 'openspec', 'changes', 'cap-nonblock');
      await fs.mkdir(changeDir, { recursive: true });
      await fs.writeFile(path.join(changeDir, 'proposal.md'), '# Proposal');
      await fs.writeFile(path.join(changeDir, 'design.md'), '# Design');
      await fs.writeFile(path.join(changeDir, 'tasks.md'), '# Tasks');

      // This should not throw — capability gaps are warnings, not errors
      const results = await runGuardChecks(tmpDir, 'build' as LifecycleCheckpoint, 'verify' as LifecycleCheckpoint, 'cap-nonblock');

      // Standard artifact checks pass
      const stdChecks = results.filter((r) => !r.check.startsWith('Verify') && !r.check.startsWith('Rules') && !r.check.startsWith('Capability'));
      expect(stdChecks.every((r) => r.passed)).toBe(true);

      // Transition itself should work
      const state = makeTestState({ checkpoint: 'build' as LifecycleCheckpoint });
      const result = applyTransition(state, IvyPhase.VERIFY as LifecycleCheckpoint, 'Build complete');
      expect(result.checkpoint).toBe('verify');
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { transitionAILifecycle, transitionGitLifecycle, transitionRuntimeLifecycle } from './lifecycle.js';
import { createOrigin } from './origin.js';
import type { Origin } from './types.js';

describe('Lifecycle Transitions', () => {
  describe('AI Lifecycle', () => {
    let origin: Origin;
    beforeEach(() => {
      origin = createOrigin('claude-code');
    });

    it('CREATED → GENERATED is valid', () => {
      const updated = transitionAILifecycle(origin, 'GENERATED');
      expect(updated.status.aiLifecycle).toBe('GENERATED');
    });

    it('GENERATED → ADOPTED is valid', () => {
      const updated = transitionAILifecycle(
        { ...origin, status: { ...origin.status, aiLifecycle: 'GENERATED' } },
        'ADOPTED',
      );
      expect(updated.status.aiLifecycle).toBe('ADOPTED');
    });

    it('ADOPTED → MODIFIED is valid', () => {
      const updated = transitionAILifecycle(
        { ...origin, status: { ...origin.status, aiLifecycle: 'ADOPTED' } },
        'MODIFIED',
      );
      expect(updated.status.aiLifecycle).toBe('MODIFIED');
    });

    it('MODIFIED → ARCHIVED is valid', () => {
      const updated = transitionAILifecycle(
        { ...origin, status: { ...origin.status, aiLifecycle: 'MODIFIED' } },
        'ARCHIVED',
      );
      expect(updated.status.aiLifecycle).toBe('ARCHIVED');
    });

    it('ADOPTED → CREATED is invalid (backward transition)', () => {
      expect(() =>
        transitionAILifecycle(
          { ...origin, status: { ...origin.status, aiLifecycle: 'ADOPTED' } },
          'CREATED',
        ),
      ).toThrow(/invalid/i);
    });

    it('same-state transition is allowed', () => {
      const updated = transitionAILifecycle(origin, 'CREATED');
      expect(updated.status.aiLifecycle).toBe('CREATED');
    });

    it('does not mutate original origin', () => {
      const updated = transitionAILifecycle(origin, 'GENERATED');
      expect(updated.status.aiLifecycle).toBe('GENERATED');
      expect(origin.status.aiLifecycle).toBe('CREATED');
    });
  });

  describe('Git Lifecycle', () => {
    let origin: Origin;
    beforeEach(() => {
      origin = createOrigin('claude-code');
    });

    it('NONE → COMMITTED is valid', () => {
      const updated = transitionGitLifecycle(origin, 'COMMITTED');
      expect(updated.status.gitLifecycle).toBe('COMMITTED');
    });

    it('COMMITTED → PR_CREATED is valid', () => {
      const updated = transitionGitLifecycle(
        { ...origin, status: { ...origin.status, gitLifecycle: 'COMMITTED' } },
        'PR_CREATED',
      );
      expect(updated.status.gitLifecycle).toBe('PR_CREATED');
    });

    it('PR_CREATED → MERGED is valid', () => {
      const updated = transitionGitLifecycle(
        { ...origin, status: { ...origin.status, gitLifecycle: 'PR_CREATED' } },
        'MERGED',
      );
      expect(updated.status.gitLifecycle).toBe('MERGED');
    });

    it('NONE → MERGED is invalid (skip states)', () => {
      expect(() => transitionGitLifecycle(origin, 'MERGED')).toThrow(/invalid/i);
    });

    it('independent from AI lifecycle', () => {
      const withAI = transitionAILifecycle(origin, 'GENERATED');
      const withGit = transitionGitLifecycle(withAI, 'COMMITTED');
      expect(withGit.status.aiLifecycle).toBe('GENERATED');
      expect(withGit.status.gitLifecycle).toBe('COMMITTED');
    });
  });

  describe('Runtime Lifecycle', () => {
    let origin: Origin;
    beforeEach(() => {
      origin = createOrigin('claude-code');
    });

    it('NONE → DEPLOYED is valid', () => {
      const updated = transitionRuntimeLifecycle(origin, 'DEPLOYED');
      expect(updated.status.runtimeLifecycle).toBe('DEPLOYED');
    });

    it('DEPLOYED → STABLE is valid', () => {
      const updated = transitionRuntimeLifecycle(
        { ...origin, status: { ...origin.status, runtimeLifecycle: 'DEPLOYED' } },
        'STABLE',
      );
      expect(updated.status.runtimeLifecycle).toBe('STABLE');
    });

    it('DEPLOYED → FAILED is valid', () => {
      const updated = transitionRuntimeLifecycle(
        { ...origin, status: { ...origin.status, runtimeLifecycle: 'DEPLOYED' } },
        'FAILED',
      );
      expect(updated.status.runtimeLifecycle).toBe('FAILED');
    });

    it('STABLE → FAILED is valid', () => {
      const updated = transitionRuntimeLifecycle(
        { ...origin, status: { ...origin.status, runtimeLifecycle: 'STABLE' } },
        'FAILED',
      );
      expect(updated.status.runtimeLifecycle).toBe('FAILED');
    });

    it('FAILED → ROLLED_BACK is valid', () => {
      const updated = transitionRuntimeLifecycle(
        { ...origin, status: { ...origin.status, runtimeLifecycle: 'FAILED' } },
        'ROLLED_BACK',
      );
      expect(updated.status.runtimeLifecycle).toBe('ROLLED_BACK');
    });

    it('NONE → STABLE is invalid (skip states)', () => {
      expect(() => transitionRuntimeLifecycle(origin, 'STABLE')).toThrow(/invalid/i);
    });
  });
});

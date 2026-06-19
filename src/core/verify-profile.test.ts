/**
 * Tests for verify-profile.ts — verification gate profiles.
 *
 * v0.15: Sprint 15.3 — Skill Registry & Profile.
 * Covers: TC-13, TC-14, TC-15.
 */

import { describe, it, expect } from 'vitest';
import {
  getDefaultProfile,
  mergeTechStackOverrides,
  generateProfile,
} from './verify-profile.js';

describe('verify-profile', () => {
  // TC-13: Generate verify profile from tech stack
  describe('TC-13: Profile generation', () => {
    it('should generate prototype profile with minimal gates', () => {
      const profile = getDefaultProfile('prototype');
      expect(profile.compile).toBe('required');
      expect(profile.unitTest).toBe('optional');
      expect(profile.integrationTest).toBe('none');
      expect(profile.e2e).toBe('none');
    });

    it('should generate development profile with standard gates', () => {
      const profile = getDefaultProfile('development');
      expect(profile.compile).toBe('required');
      expect(profile.unitTest).toBe('required');
      expect(profile.lint).toBe('required');
    });

    it('should generate production profile with full gates', () => {
      const profile = getDefaultProfile('production');
      expect(profile.compile).toBe('required');
      expect(profile.unitTest).toBe('required');
      expect(profile.coverage).toBe('required');
      expect(profile.integrationTest).toBe('required');
      expect(profile.e2e).toBe('required');
    });
  });

  // TC-14: Mixed stack profile merging
  describe('TC-14: Mixed stack merging', () => {
    it('should set e2e=required for nextjs+playwright', () => {
      const profile = generateProfile('development', ['nextjs', 'playwright']);
      expect(profile.e2e).toBe('required');
    });

    it('should set integrationTest=required for springboot+junit', () => {
      const profile = generateProfile('development', ['springboot', 'junit']);
      expect(profile.integrationTest).toBe('required');
    });

    it('should set lint=required and unitTest=required for go', () => {
      const profile = generateProfile('development', ['go']);
      expect(profile.unitTest).toBe('required');
      expect(profile.lint).toBe('required');
    });
  });

  // TC-15: Manual profile override
  describe('TC-15: Manual override handling', () => {
    it('should not apply overrides for unrelated tech stacks', () => {
      const profile = generateProfile('development', ['react']);
      expect(profile.e2e).toBe('none');
    });

    it('should preserve base profile values when no override matches', () => {
      const profile = generateProfile('development', ['react']);
      expect(profile.compile).toBe('required');
      expect(profile.unitTest).toBe('required');
    });
  });
});

import { describe, it, expect } from 'vitest';
import { generateVerifyProfile, supportsManualOverride } from './verify-profile.js';
import type { TechStack } from './capability-model.js';

const reactPlaywrightTs: TechStack = {
  frontend: ['react'],
  testFramework: ['playwright'],
  language: ['typescript'],
};

const emptyTs: TechStack = {};

describe('verify-profile', () => {
  describe('generateVerifyProfile', () => {
    it('TC-13: generates development maturity profile', async () => {
      const profile = await generateVerifyProfile(emptyTs, 'development');
      expect(profile.compile).toBe('required');
      expect(profile.unitTest).toBe('required');
      expect(profile.lint).toBe('required');
      expect(profile.e2e).toBe('none');
    });

    it('TC-32: prototype maturity has minimal gates', async () => {
      const profile = await generateVerifyProfile(emptyTs, 'prototype');
      expect(profile.compile).toBe('required');
      expect(profile.unitTest).toBe('optional');
      expect(profile.integrationTest).toBe('none');
      expect(profile.e2e).toBe('none');
      expect(profile.coverage).toBe('none');
    });

    it('TC-32: production maturity requires all gates', async () => {
      const profile = await generateVerifyProfile(emptyTs, 'production');
      expect(profile.compile).toBe('required');
      expect(profile.unitTest).toBe('required');
      expect(profile.e2e).toBe('required');
      expect(profile.coverage).toBe('required');
    });

    it('TC-14: applies tech-stack-specific overrides', async () => {
      const profile = await generateVerifyProfile(reactPlaywrightTs, 'development');
      // playwright should bump e2e from none to required
      expect(profile.e2e).toBe('required');
    });

    it('TC-27: api-only intent removes e2e', async () => {
      const profile = await generateVerifyProfile(reactPlaywrightTs, 'production', 'api-only');
      expect(profile.e2e).toBe('none');
    });
  });

  describe('supportsManualOverride', () => {
    it('TC-15: detects manual override config', () => {
      expect(supportsManualOverride({ verification: { profile: 'manual' } })).toBe(true);
      expect(supportsManualOverride({})).toBe(false);
      expect(supportsManualOverride({ verification: { profile: 'auto' } })).toBe(false);
    });
  });
});

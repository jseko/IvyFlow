/**
 * Tests for skill-registry.ts — skill catalog and recommendation engine.
 *
 * v0.15: Sprint 15.3 — Skill Registry & Profile.
 * Covers: TC-16, TC-17.
 */

import { describe, it, expect } from 'vitest';
import {
  BUILTIN_SKILLS,
  listSkills,
  getRecommendedSkills,
  getAutoInstallSkills,
  getSkillsByCategory,
} from './skill-registry.js';

describe('skill-registry', () => {
  // TC-16: Skill recommendation list
  describe('TC-16: Skill recommendation', () => {
    it('should recommend _always skills for any tech stack', () => {
      const skills = getRecommendedSkills(['nonexistent']);
      const ids = skills.map(s => s.id);
      expect(ids).toContain('code-reviewer');
      expect(ids).toContain('security-review');
    });

    it('should recommend playwright-e2e for playwright tech stack', () => {
      const skills = getRecommendedSkills(['playwright']);
      const ids = skills.map(s => s.id);
      expect(ids).toContain('playwright-e2e');
    });

    it('should recommend frontend-patterns for nextjs', () => {
      const skills = getRecommendedSkills(['nextjs']);
      const ids = skills.map(s => s.id);
      expect(ids).toContain('frontend-patterns');
    });

    it('should not recommend playwright-e2e when playwright not detected', () => {
      const skills = getRecommendedSkills(['react']);
      const ids = skills.map(s => s.id);
      expect(ids).not.toContain('playwright-e2e');
    });
  });

  // TC-17: Missing tech stack
  describe('TC-17: Missing tech stack', () => {
    it('should return only _always skills for unknown tech stack', () => {
      const skills = getRecommendedSkills(['unknown-framework']);
      expect(skills.length).toBe(2);
      expect(skills.every(s => s.techStackTrigger.includes('_always'))).toBe(true);
    });

    it('should return empty auto-install for unknown stack', () => {
      const auto = getAutoInstallSkills(['unknown']);
      expect(auto).toHaveLength(0);
    });
  });

  // Install modes
  describe('install modes', () => {
    it('should have 4 built-in skills', () => {
      expect(BUILTIN_SKILLS).toHaveLength(4);
    });

    it('should return auto-install only skills with mode=auto', () => {
      const auto = getAutoInstallSkills(['playwright']);
      expect(auto.every(s => s.installMode === 'auto')).toBe(true);
      expect(auto.some(s => s.id === 'playwright-e2e')).toBe(true);
    });

    it('should filter by category', () => {
      const review = getSkillsByCategory('review');
      expect(review.some(s => s.id === 'code-reviewer')).toBe(true);
    });
  });
});

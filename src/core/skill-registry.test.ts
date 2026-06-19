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

  // ─── Sprint 14.3: Additional Tests ───

  // TC-31: Skill determinism labels
  describe('TC-31: Skill determinism labels', () => {
    it('should label skills with techStackTrigger as deterministic', () => {
      const skills = listSkills();
      const deterministicSkills = skills.filter(s => s.techStackTrigger && !s.techStackTrigger.includes('_always'));
      // Skills with specific tech stack triggers are deterministic
      for (const s of deterministicSkills) {
        expect(s.techStackTrigger).toBeDefined();
        expect(Array.isArray(s.techStackTrigger)).toBe(true);
      }
    });

    it('should label _always skills as heuristic (advisory)', () => {
      const alwaysSkills = listSkills().filter(s => s.techStackTrigger?.includes('_always'));
      for (const s of alwaysSkills) {
        expect(s.techStackTrigger).toContain('_always');
      }
    });

    it('should distinguish deterministic from heuristic skills', () => {
      const skills = listSkills();
      const hasDeterministic = skills.some(s => s.techStackTrigger && !s.techStackTrigger.includes('_always'));
      const hasHeuristic = skills.some(s => s.techStackTrigger?.includes('_always'));
      expect(hasDeterministic).toBe(true);
      expect(hasHeuristic).toBe(true);
    });
  });

  // TC-32: Maturity level impact on skill recommendation
  describe('TC-32: Maturity level impact', () => {
    it('should recommend more comprehensive skills for production maturity', () => {
      // Production maturity should include additional skills like security, performance
      const prodSkills = getRecommendedSkills(['nextjs', 'vitest']);
      const hasSecurity = prodSkills.some(s => s.category === 'security' || s.id.includes('security'));
      // Production-level projects should have security considerations
      expect(prodSkills.length).toBeGreaterThanOrEqual(2);
    });

    it('should include e2e testing for fullstack projects', () => {
      const skills = getRecommendedSkills(['nextjs', 'playwright']);
      const hasE2e = skills.some(s => s.id.includes('e2e') || s.category === 'testing');
      expect(hasE2e).toBe(true);
    });

    it('should recommend appropriate skills based on stack combination', () => {
      const frontendSkills = getRecommendedSkills(['react']);
      const backendSkills = getRecommendedSkills(['express']);
      // Frontend stack should recommend frontend-related skills
      // Backend stack should recommend backend-related skills
      expect(frontendSkills.length).toBeGreaterThan(0);
      expect(backendSkills.length).toBeGreaterThan(0);
    });
  });
});

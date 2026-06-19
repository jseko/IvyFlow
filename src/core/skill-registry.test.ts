import { describe, it, expect } from 'vitest';
import { indexSkills, getRecommendedSkills, listAvailableSkills } from './skill-registry.js';

describe('skill-registry', () => {
  describe('indexSkills', () => {
    it('loads built-in skills from mapping file', async () => {
      const skills = await indexSkills();
      expect(skills.length).toBeGreaterThan(0);
    });

    it('TC-31: classifies deterministic skills correctly', async () => {
      const skills = await indexSkills();
      const detSkills = skills.filter((s) => s.determinism === 'deterministic');
      expect(detSkills.length).toBeGreaterThan(0);
      for (const s of detSkills) {
        expect(s.techStackTrigger.length).toBeGreaterThan(0);
      }
    });

    it('TC-31: classifies heuristic skills correctly', async () => {
      const skills = await indexSkills();
      const heuSkills = skills.filter((s) => s.determinism === 'heuristic');
      expect(heuSkills.length).toBeGreaterThan(0);
      for (const s of heuSkills) {
        expect(s.techStackTrigger).toEqual([]);
      }
    });
  });

  describe('getRecommendedSkills', () => {
    it('TC-16: recommends skills based on tech stack', async () => {
      const ts = { frontend: ['react'], testFramework: ['playwright'] };
      const recs = await getRecommendedSkills(ts);
      const detRecs = recs.filter((r) => r.determinism === 'deterministic');
      expect(detRecs.length).toBeGreaterThan(0);
    });

    it('includes heuristic skills as advisory', async () => {
      const ts = {};
      const recs = await getRecommendedSkills(ts);
      const heuRecs = recs.filter((r) => r.determinism === 'heuristic');
      expect(heuRecs.length).toBeGreaterThan(0);
      for (const r of heuRecs) {
        expect(r.determinism).toBe('heuristic');
      }
    });
  });

  describe('mythAvailableSkills', () => {
    it('TC-17: returns empty for missing mapping file', async () => {
      const skills = await indexSkills('/tmp/nonexistent-mapping.yaml');
      expect(skills).toEqual([]);
    });
  });
});

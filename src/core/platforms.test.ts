import { describe, it, expect } from 'vitest';

import {
  PLATFORMS,
  getPlatformById,
  getPlatformSkillsDir,
  type Platform,
} from './platforms.js';

describe('platforms', () => {
  describe('PLATFORMS invariants (v0.2)', () => {
    it('ships exactly 7 platforms', () => {
      expect(PLATFORMS).toHaveLength(7);
    });

    it('contains all v0.2 platform ids exactly once', () => {
      const ids = PLATFORMS.map((p) => p.id).sort();
      expect(ids).toEqual([
        'claude',
        'codebuddy',
        'cursor',
        'github-copilot',
        'qoder',
        'trae',
        'windsurf',
      ]);
    });

    it('every platform has a non-empty skillsDir and rulesFormat', () => {
      for (const p of PLATFORMS) {
        expect(p.skillsDir.length).toBeGreaterThan(0);
        expect(p.rulesFormat).toBeTruthy();
      }
    });

    it('claude entry retains v0.1 contract (md rules + claude tool id)', () => {
      const claude = PLATFORMS.find((p) => p.id === 'claude');
      expect(claude?.skillsDir).toBe('.claude');
      expect(claude?.rulesDir).toBe('rules');
      expect(claude?.rulesFormat).toBe('md');
      expect(claude?.openspecToolId).toBe('claude');
    });

    it('cursor uses mdc rule format', () => {
      expect(PLATFORMS.find((p) => p.id === 'cursor')?.rulesFormat).toBe('mdc');
    });

    it('github-copilot uses copilot rule format', () => {
      expect(PLATFORMS.find((p) => p.id === 'github-copilot')?.rulesFormat).toBe('copilot');
    });

    it('windsurf supports hooks via windsurf-json format', () => {
      const w = PLATFORMS.find((p) => p.id === 'windsurf');
      expect(w?.supportsHooks).toBe(true);
      expect(w?.hookFormat).toBe('windsurf-json');
      expect(w?.hookPath).toBe('hooks/ivy-phase-guard.json');
    });

    it('trae / qoder / codebuddy are md-only same-shape platforms (D8 validation)', () => {
      const sameShape = PLATFORMS.filter((p) =>
        ['trae', 'qoder', 'codebuddy'].includes(p.id),
      );
      expect(sameShape).toHaveLength(3);
      for (const p of sameShape) {
        expect(p.rulesFormat).toBe('md');
        expect(p.rulesDir).toBe('rules');
        expect(p.supportsHooks).toBeFalsy();
      }
    });
  });

  describe('getPlatformById', () => {
    it('returns the matching platform for each known id', () => {
      for (const id of ['claude', 'cursor', 'github-copilot', 'windsurf', 'codebuddy', 'trae', 'qoder']) {
        expect(getPlatformById(id)?.id).toBe(id);
      }
    });

    it('returns undefined for unknown id', () => {
      expect(getPlatformById('unknown')).toBeUndefined();
    });
  });

  describe('getPlatformSkillsDir', () => {
    const withGlobal: Platform = {
      id: 'x',
      name: 'X',
      skillsDir: '.x-project',
      globalSkillsDir: '.x-global',
      openspecToolId: 'x',
    };
    const withoutGlobal: Platform = {
      id: 'y',
      name: 'Y',
      skillsDir: '.y-project',
      openspecToolId: 'y',
    };

    it('returns project dir for project scope', () => {
      expect(getPlatformSkillsDir(withGlobal, 'project')).toBe('.x-project');
    });

    it('returns global dir for global scope when defined', () => {
      expect(getPlatformSkillsDir(withGlobal, 'global')).toBe('.x-global');
    });

    it('falls back to project dir when global is undefined', () => {
      expect(getPlatformSkillsDir(withoutGlobal, 'global')).toBe('.y-project');
    });
  });
});

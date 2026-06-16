import { describe, it, expect } from 'vitest';

import {
  PLATFORMS,
  getPlatformById,
  getPlatformSkillsDir,
  type Platform,
} from './platforms.js';

describe('platforms', () => {
  describe('PLATFORMS invariants', () => {
    it('ships exactly one platform in v0.1', () => {
      expect(PLATFORMS).toHaveLength(1);
      expect(PLATFORMS[0].id).toBe('claude');
    });

    it('claude entry uses .claude as skills dir and md rules', () => {
      const claude = PLATFORMS[0];
      expect(claude.skillsDir).toBe('.claude');
      expect(claude.rulesDir).toBe('rules');
      expect(claude.rulesFormat).toBe('md');
      expect(claude.openspecToolId).toBe('claude');
    });
  });

  describe('getPlatformById', () => {
    it('returns the matching platform', () => {
      expect(getPlatformById('claude')?.id).toBe('claude');
    });

    it('returns undefined for unknown id', () => {
      expect(getPlatformById('cursor')).toBeUndefined();
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

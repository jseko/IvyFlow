import { describe, it, expect } from 'vitest';

import {
  PLATFORMS,
  getPlatformById,
  getPlatformLifecycle,
  getPlatformsByLifecycle,
  getPlatformSkillsDir,
  type Platform,
} from './platforms.js';

describe('platforms', () => {
  describe('PLATFORMS invariants (v0.8)', () => {
    it('ships exactly 29 platforms (11 Certified + 18 Experimental)', () => {
      expect(PLATFORMS).toHaveLength(29);
    });

    it('contains all v0.18 platform ids exactly once', () => {
      const ids = PLATFORMS.map((p) => p.id).sort();
      expect(ids).toEqual([
        'amazon-q',
        'antigravity',
        'auggie',
        'bob',
        'claude',
        'cline',
        'codebuddy',
        'codex',
        'continue',
        'costrict',
        'crush',
        'cursor',
        'factory',
        'forgecode',
        'gemini-cli',
        'github-copilot',
        'iflow',
        'junie',
        'kilocode',
        'kimi-code',
        'kiro',
        'lingma',
        'opencode',
        'pi',
        'qoder',
        'qwen',
        'roocode',
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

    it('trae / qoder / codebuddy / cline / amazon-q are md-only same-shape platforms (D8 validation)', () => {
      const sameShape = PLATFORMS.filter((p) =>
        ['trae', 'qoder', 'codebuddy', 'cline', 'amazon-q'].includes(p.id),
      );
      expect(sameShape).toHaveLength(5);
      for (const p of sameShape) {
        expect(p.rulesFormat).toBe('md');
        expect(p.rulesDir).toBe('rules');
        expect(p.supportsHooks).toBeFalsy();
      }
    });

    it('all platforms have detectionPaths populated (v0.7)', () => {
      for (const p of PLATFORMS) {
        expect(p.detectionPaths).toBeDefined();
        expect(p.detectionPaths!.length).toBeGreaterThan(0);
      }
    });

    it('all platforms have certification field (v0.8)', () => {
      const certified = PLATFORMS.filter((p) => p.certification === 'certified');
      const experimental = PLATFORMS.filter((p) => p.certification === 'experimental');
      expect(certified.length).toBe(11);
      expect(experimental.length).toBe(18);
    });

    it('claude detectionPaths matches documented paths', () => {
      const claude = PLATFORMS.find((p) => p.id === 'claude');
      expect(claude?.detectionPaths).toEqual([
        { rel: '.claude/settings.json', confidence: 1.0 },
        { rel: '.claude/settings.local.json', confidence: 1.0 },
        { rel: '.claude/skills', confidence: 0.8 },
        { rel: '.claude', confidence: 0.6 },
      ]);
    });
  });

  describe('getPlatformById', () => {
    it('returns the matching platform for each known id', () => {
      for (const id of ['claude', 'cursor', 'github-copilot', 'windsurf', 'codebuddy', 'trae', 'qoder', 'cline', 'amazon-q']) {
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
      certification: 'certified',
      tier: 3,
    };
    const withoutGlobal: Platform = {
      id: 'y',
      name: 'Y',
      skillsDir: '.y-project',
      openspecToolId: 'y',
      certification: 'certified',
      tier: 3,
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

describe('v0.18 platform expansion', () => {
  // TC-1: Platform list contains 29+ platforms
  it('should have 29+ platforms (TC-1)', () => {
    expect(PLATFORMS.length).toBeGreaterThanOrEqual(29);
  });

  // TC-2: New platforms have experimental lifecycle
  it('should have experimental lifecycle for new platforms (TC-2)', () => {
    const newPlatforms = ['codex', 'opencode', 'qwen', 'kiro', 'junie', 'costrict', 'crush', 'factory', 'iflow', 'pi', 'antigravity', 'bob', 'forgecode'];
    for (const id of newPlatforms) {
      expect(getPlatformLifecycle(id)).toBe('experimental');
    }
  });

  // TC-6: Unknown platform ID returns undefined
  it('should return undefined for unknown platform ID (TC-6)', () => {
    expect(getPlatformById('non-existent-platform')).toBeUndefined();
  });

  // TC-10: Platform row count does not exceed hard limit
  it('should not exceed hard limit of 60 platforms (TC-10)', () => {
    expect(PLATFORMS.length).toBeLessThanOrEqual(60);
  });

  // TC-10a: getPlatformsByLifecycle returns correct groups
  it('should group platforms by lifecycle state', () => {
    const groups = getPlatformsByLifecycle();
    expect(groups.certified.length).toBeGreaterThan(0);
    expect(groups.experimental.length).toBeGreaterThan(0);
    const totalFromGroups = Object.values(groups).reduce((sum, arr) => sum + arr.length, 0);
    expect(totalFromGroups).toBe(PLATFORMS.length);
  });
});

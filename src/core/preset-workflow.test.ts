/**
 * Tests for preset-workflow.ts — full/hotfix/tweak + upgrade detection.
 *
 * v0.13: Governed Execution — Preset Workflows.
 * Covers: TC-15 through TC-18, TC-20.
 */

import { describe, it, expect } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import {
  BUILTIN_PRESETS,
  detectPreset,
  readPresetConfig,
} from './preset-workflow.js';

describe('preset-workflow', () => {
  // TC-15: Full preset
  describe('full preset (TC-15)', () => {
    it('should detect full for large changes', () => {
      const result = detectPreset('add-user-auth', 10);
      expect(result.preset).toBe('full');
      expect(result.reason).toContain('Standard change');
      expect(result.upgrade).toBeNull();
    });

    it('should detect full for non-matching names', () => {
      const result = detectPreset('new-feature-x', 6);
      expect(result.preset).toBe('full');
    });
  });

  // TC-16: Hotfix
  describe('hotfix preset (TC-16)', () => {
    it('should detect hotfix for fix in name', () => {
      const result = detectPreset('fix-login-bug', 5);
      expect(result.preset).toBe('hotfix');
      expect(result.reason).toContain('Bug fix');
    });

    it('should detect hotfix for ≤3 files', () => {
      const result = detectPreset('update-config', 2);
      expect(result.preset).toBe('hotfix');
    });

    it('should detect hotfix for hotfix in name', () => {
      const result = detectPreset('hotfix-prod-crash', 1);
      expect(result.preset).toBe('hotfix');
    });
  });

  // TC-17: Tweak
  describe('tweak preset (TC-17)', () => {
    it('should detect tweak for ≤5 files', () => {
      const result = detectPreset('refactor-helper', 4);
      expect(result.preset).toBe('tweak');
      expect(result.reason).toContain('Small change');
    });

    it('should detect tweak for bump/chore in name', () => {
      expect(detectPreset('bump-deps', 4).preset).toBe('tweak');
      expect(detectPreset('chore-ci', 4).preset).toBe('tweak');
    });

    it('should respect maxTasks from presets', () => {
      expect(BUILTIN_PRESETS.tweak.maxTasks).toBe(5);
    });
  });

  // TC-18: Auto-upgrade
  describe('auto-upgrade (TC-18)', () => {
    it('should suggest upgrade when hotfix exceeds 3 files', () => {
      const result = detectPreset('fix-something', 5);
      expect(result.preset).toBe('hotfix');
      expect(result.upgrade).not.toBeNull();
      expect(result.upgrade!.currentPreset).toBe('hotfix');
      expect(result.upgrade!.suggestedUpgrade).toBe('full');
      expect(result.upgrade!.fileCount).toBe(5);
    });

    it('should suggest upgrade when tweak exceeds 5 files', () => {
      const result = detectPreset('tweak-ui', 7);
      expect(result.preset).toBe('tweak');
      expect(result.upgrade).not.toBeNull();
      expect(result.upgrade!.currentPreset).toBe('tweak');
      expect(result.upgrade!.suggestedUpgrade).toBe('full');
    });

    it('should not suggest upgrade for full preset', () => {
      const result = detectPreset('full-feature', 10);
      expect(result.preset).toBe('full');
      expect(result.upgrade).toBeNull();
    });

    it('should not suggest upgrade when file count is within threshold', () => {
      const result = detectPreset('fix-small', 2);
      expect(result.preset).toBe('hotfix');
      expect(result.upgrade).toBeNull();
    });
  });

  // TC-20: Preset config
  describe('preset config (TC-20)', () => {
    it('should have correct full preset config', () => {
      const config = BUILTIN_PRESETS.full;
      expect(config.skipBrainstorming).toBe(false);
      expect(config.skipOutlineDesign).toBe(false);
      expect(config.maxTasks).toBeNull();
      expect(config.maxFiles).toBeNull();
      expect(config.upgradeThreshold).toBeNull();
    });

    it('should have correct hotfix preset config', () => {
      const config = BUILTIN_PRESETS.hotfix;
      expect(config.skipBrainstorming).toBe(true);
      expect(config.skipOutlineDesign).toBe(true);
      expect(config.maxTasks).toBe(3);
      expect(config.maxFiles).toBe(3);
      expect(config.upgradeThreshold).toBe(3);
    });

    it('should have correct tweak preset config', () => {
      const config = BUILTIN_PRESETS.tweak;
      expect(config.skipBrainstorming).toBe(true);
      expect(config.skipOutlineDesign).toBe(true);
      expect(config.maxTasks).toBe(5);
      expect(config.maxFiles).toBe(5);
      expect(config.upgradeThreshold).toBe(5);
    });
  });

  // TC-19: Upgrade confirmation + moduleAffectedThreshold + readPresetConfig
  describe('upgrade detection and config (TC-19)', () => {
    it('should accept optional moduleCount parameter', () => {
      const result = detectPreset('fix-something', 5, 3);
      expect(result.preset).toBe('hotfix');
      expect(result.reason).toContain('3 modules');
    });

    it('should include moduleAffectedThreshold in upgrade condition', () => {
      const result = detectPreset('fix-something', 6, 3);
      expect(result.upgrade).not.toBeNull();
      expect(result.upgrade!.moduleAffectedThreshold).toBe(3);
    });

    it('should read preset config from project.yaml', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-preset-config-'));
      await fs.mkdir(path.join(tmpDir, '.ivy'), { recursive: true });
      await fs.writeFile(
        path.join(tmpDir, '.ivy', 'project.yaml'),
        'workflow:\n  presets:\n    hotfix:\n      max_files: 5\n      max_tasks: 5\n'
      );
      const config = await readPresetConfig(tmpDir);
      expect(config.hotfix.maxFiles).toBe(5);      // user override
      expect(config.hotfix.maxTasks).toBe(5);        // user override
      expect(config.hotfix.skipBrainstorming).toBe(true);  // default preserved
      expect(config.tweak.maxTasks).toBe(5);                // default preserved
    });

    it('should return defaults when no project.yaml exists', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-preset-no-config-'));
      const config = await readPresetConfig(tmpDir);
      expect(config.hotfix.maxFiles).toBe(3);
      expect(config.tweak.maxTasks).toBe(5);
      expect(config.full.skipBrainstorming).toBe(false);
    });

    it('should return defaults when no presets section exists', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-preset-no-section-'));
      await fs.mkdir(path.join(tmpDir, '.ivy'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, '.ivy', 'project.yaml'), 'version: 0.13.0\n');
      const config = await readPresetConfig(tmpDir);
      expect(config.hotfix.maxFiles).toBe(3);
      expect(config.tweak.maxTasks).toBe(5);
    });
  });
});

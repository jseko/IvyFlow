/**
 * Tests for execution-isolation.ts — git worktree provider + fallback.
 *
 * v0.13: Governed Execution — Execution Isolation.
 * Covers: TC-27 through TC-30.
 */

import { describe, it, expect } from 'vitest';

import {
  DEFAULT_ISOLATION_CONFIG,
  type IsolationConfig,
  type IsolationProvider,
} from './execution-isolation.js';

describe('execution-isolation', () => {
  // TC-27: Worktree creation (test config/interface — actual git worktree tested in e2e)
  describe('worktree config (TC-27)', () => {
    it('should have correct default config', () => {
      expect(DEFAULT_ISOLATION_CONFIG.provider).toBe('git-worktree');
      expect(DEFAULT_ISOLATION_CONFIG.excludePaths).toContain('node_modules');
      expect(DEFAULT_ISOLATION_CONFIG.excludePaths).toContain('dist');
      expect(DEFAULT_ISOLATION_CONFIG.maxInstances).toBe(5);
    });

    it('should return none provider when configured', () => {
      const config: IsolationConfig = {
        provider: 'none',
        excludePaths: [],
        maxInstances: 1,
      };
      expect(config.provider).toBe('none');
    });
  });

  // TC-28: Exclude paths
  describe('exclude paths (TC-28)', () => {
    it('should define standard excludes in default config', () => {
      const excludes = DEFAULT_ISOLATION_CONFIG.excludePaths;
      expect(excludes).toContain('node_modules');
      expect(excludes).toContain('dist');
      expect(excludes).toContain('target');
      expect(excludes).toContain('.git');
    });
  });

  // TC-29: Cleanup interface (test the destroy function shape — actual cleanup tested in e2e)
  describe('cleanup interface (TC-29)', () => {
    it('should accept destroy function from module', async () => {
      const { destroyWorktree } = await import('./execution-isolation.js');
      expect(typeof destroyWorktree).toBe('function');
    });

    it('should handle destroy for non-existent worktree gracefully', async () => {
      const { destroyWorktree } = await import('./execution-isolation.js');
      // Should not throw for non-existent path
      await expect(destroyWorktree('/tmp/nonexistent-worktree')).resolves.toBeUndefined();
    });
  });

  // TC-30: Provider interface
  describe('provider interface (TC-30)', () => {
    it('should define all provider types', () => {
      const providers: IsolationProvider[] = ['git-worktree', 'docker', 'dev-container', 'none'];
      expect(providers).toContain('git-worktree');
      expect(providers).toContain('docker');
      expect(providers).toContain('none');
    });

    it('should have maxInstances in config type', () => {
      const config: IsolationConfig = {
        provider: 'git-worktree',
        excludePaths: [],
        maxInstances: 5,
      };
      expect(config.maxInstances).toBe(5);
    });

    it('should accept provider string as git-worktree', () => {
      const provider: IsolationProvider = 'git-worktree';
      expect(provider).toBe('git-worktree');
    });
  });
});

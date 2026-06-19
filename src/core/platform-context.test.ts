/**
 * Tests for platform-context.ts — capability declarations for 16 platforms.
 *
 * v0.15: Sprint 15.6 — Runtime Governance.
 * Covers: TC-27, TC-28.
 */

import { describe, it, expect } from 'vitest';
import {
  PLATFORM_CAPABILITIES,
  getPlatformCapabilities,
  getPlatformContext,
} from './platform-context.js';

// The actual 16 platform IDs from platforms.ts
const PLATFORM_IDS = [
  'claude', 'cursor', 'github-copilot', 'windsurf', 'codebuddy',
  'trae', 'qoder', 'cline', 'amazon-q', 'gemini-cli', 'roocode',
  'continue', 'kilocode', 'auggie', 'kimi-code', 'lingma',
];

describe('platform-context', () => {
  // TC-27: resolveEnforcementLevel covers all 16 platforms
  describe('TC-27: 16-platform coverage', () => {
    it('should have entries for all 16 platforms', () => {
      for (const id of PLATFORM_IDS) {
        expect(PLATFORM_CAPABILITIES[id]).toBeDefined();
      }
    });

    it('should return expected capabilities for known platforms', () => {
      expect(PLATFORM_CAPABILITIES['windsurf']).toEqual({
        runtimeIntercept: 'full', gitHookInstall: 'full', structuredRuleFile: 'full',
      });
      expect(PLATFORM_CAPABILITIES['cursor']).toEqual({
        runtimeIntercept: 'none', gitHookInstall: 'full', structuredRuleFile: 'full',
      });
      expect(PLATFORM_CAPABILITIES['claude']).toEqual({
        runtimeIntercept: 'full', gitHookInstall: 'full', structuredRuleFile: 'full',
      });
    });

    it('should default unknown platforms to all none', () => {
      const caps = getPlatformCapabilities('unknown-platform');
      expect(caps).toEqual({ runtimeIntercept: 'none', gitHookInstall: 'none', structuredRuleFile: 'none' });
    });

    it('should return platform context', () => {
      const ctx = getPlatformContext('windsurf');
      expect(ctx.platformId).toBe('windsurf');
      expect(ctx.capabilities.runtimeIntercept).toBe('full');
    });
  });

  // TC-28: PlatformContext consistency with platforms.ts
  describe('TC-28: PlatformContext consistency', () => {
    it('should have entry for every known platform ID', () => {
      for (const id of PLATFORM_IDS) {
        const entry = PLATFORM_CAPABILITIES[id];
        expect(entry).toBeDefined();
        expect(['full', 'partial', 'none']).toContain(entry.runtimeIntercept);
        expect(['full', 'partial', 'none']).toContain(entry.gitHookInstall);
        expect(['full', 'partial', 'none']).toContain(entry.structuredRuleFile);
      }
    });
  });
});

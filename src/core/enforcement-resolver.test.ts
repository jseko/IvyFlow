/**
 * Tests for enforcement-resolver.ts — pure function enforcement level.
 *
 * v0.15: Sprint 15.6 — Runtime Governance.
 */

import { describe, it, expect } from 'vitest';
import { resolveEnforcementLevel } from './enforcement-resolver.js';
import type { PlatformCapabilities } from './platform-context.js';

describe('enforcement-resolver', () => {
  const full: PlatformCapabilities = { runtimeIntercept: 'full', gitHookInstall: 'full', structuredRuleFile: 'full' };
  const partial: PlatformCapabilities = { runtimeIntercept: 'partial', gitHookInstall: 'full', structuredRuleFile: 'full' };
  const none: PlatformCapabilities = { runtimeIntercept: 'none', gitHookInstall: 'none', structuredRuleFile: 'none' };

  // Block + full → hard
  it('should return hard for block+full', () => {
    expect(resolveEnforcementLevel('block', full)).toBe('hard');
  });

  // Block + partial → soft
  it('should return soft for block+partial', () => {
    expect(resolveEnforcementLevel('block', partial)).toBe('soft');
  });

  // Block + none → soft
  it('should return soft for block+none', () => {
    expect(resolveEnforcementLevel('block', none)).toBe('soft');
  });

  // Warn → soft (always)
  it('should return soft for warn regardless of capabilities', () => {
    expect(resolveEnforcementLevel('warn', full)).toBe('soft');
    expect(resolveEnforcementLevel('warn', partial)).toBe('soft');
    expect(resolveEnforcementLevel('warn', none)).toBe('soft');
  });

  // Allow → advisory (always)
  it('should return advisory for allow regardless of capabilities', () => {
    expect(resolveEnforcementLevel('allow', full)).toBe('advisory');
    expect(resolveEnforcementLevel('allow', partial)).toBe('advisory');
    expect(resolveEnforcementLevel('allow', none)).toBe('advisory');
  });

  // Pure function: same inputs = same outputs
  it('should be a pure function (deterministic)', () => {
    const r1 = resolveEnforcementLevel('block', full);
    const r2 = resolveEnforcementLevel('block', full);
    expect(r1).toBe(r2);
  });
});

import { describe, it, expect } from 'vitest';
import { runHardGuard, formatGuardResult } from '../core/guard-engine.js';
import { resolveNextSkill, formatNextResult } from '../core/skill-router.js';
import { createInitialState, applyTransition, type StateYaml } from '../core/lifecycle-projection.js';
import { IvyPhase } from '../core/phase-machine.js';
import { detectPreset, BUILTIN_PRESETS } from '../core/preset-workflow.js';

describe('guard-engine', () => {
  function makeState(overrides: Record<string, unknown> = {}): StateYaml {
    const state = createInitialState('test-change');
    return { ...state, ...overrides } as StateYaml;
  }

  it('guard open returns passed=false when artifacts are missing', async () => {
    const result = await runHardGuard('/nonexistent', IvyPhase.OPEN, 'test-change', makeState());
    expect(result.passed).toBe(false);
    expect(result.checks.some((c) => c.name === 'proposal.md' && !c.passed)).toBe(true);
  });

  it('guard design fails without handoff_context', async () => {
    const state = makeState();
    const result = await runHardGuard('/nonexistent', IvyPhase.DESIGN, 'test-change', state);
    expect(result.passed).toBe(false);
    expect(result.checks.some((c) => c.name === 'handoff_context' && !c.passed)).toBe(true);
  });

  it('guard build fails when isolation is not set', async () => {
    const state = makeState();
    const result = await runHardGuard('/nonexistent', IvyPhase.BUILD, 'test-change', state);
    expect(result.passed).toBe(false);
    expect(result.checks.some((c) => c.name === 'isolation' && !c.passed)).toBe(true);
  });

  it('guard build fails when build_mode is not set', async () => {
    const state = makeState({ isolation: 'branch' });
    const result = await runHardGuard('/nonexistent', IvyPhase.BUILD, 'test-change', state);
    expect(result.passed).toBe(false);
    expect(result.checks.some((c) => c.name === 'build_mode' && !c.passed)).toBe(true);
  });

  it('guard verify fails without verification_report', async () => {
    const state = makeState();
    const result = await runHardGuard('/nonexistent', IvyPhase.VERIFY, 'test-change', state);
    expect(result.passed).toBe(false);
    expect(result.checks.some((c) => c.name === 'verification_report' && !c.passed)).toBe(true);
  });

  it('guard verify fails when branch_status is not handled', async () => {
    const state = makeState({ verification_report: '/tmp/test.md' });
    const result = await runHardGuard('/nonexistent', IvyPhase.VERIFY, 'test-change', state);
    expect(result.passed).toBe(false);
    expect(result.checks.some((c) => c.name === 'branch_status' && !c.passed)).toBe(true);
  });

  it('guard archive fails without archived flag', async () => {
    const state = makeState();
    const result = await runHardGuard('/nonexistent', IvyPhase.ARCHIVE, 'test-change', state);
    expect(result.passed).toBe(false);
    expect(result.checks.some((c) => c.name === 'archived' && !c.passed)).toBe(true);
  });

  it('guard archive passes with archived flag', async () => {
    const state = makeState({ archived: true });
    const result = await runHardGuard('/nonexistent', IvyPhase.ARCHIVE, 'test-change', state);
    expect(result.checks.some((c) => c.name === 'archived' && c.passed)).toBe(true);
  });

  it('formatGuardResult shows PASS for passed guards', () => {
    const result = { phase: 'archive', passed: true, checks: [{ name: 'test', passed: true, message: 'OK' }] };
    expect(formatGuardResult(result)).toContain('PASS');
  });

  it('formatGuardResult shows FAIL for failed guards', () => {
    const result = { phase: 'open', passed: false, checks: [{ name: 'test', passed: false, message: 'fail' }] };
    expect(formatGuardResult(result)).toContain('FAIL');
  });

  it('formatGuardResult includes NEXT for passed with nextSkill', () => {
    const result = { phase: 'open', passed: true, checks: [], nextSkill: 'ivy-design' };
    expect(formatGuardResult(result)).toContain('NEXT: auto, SKILL: ivy-design');
  });
});

describe('skill-router', () => {
  function makeState(checkpoint: string, overrides: Record<string, unknown> = {}): StateYaml {
    const state = createInitialState('test-change');
    const ext = { ...state, ...overrides, checkpoint } as StateYaml;
    return ext;
  }

  it('routes open to ivy-design for full workflow', () => {
    const result = resolveNextSkill(makeState('open', { workflow: 'full' }));
    expect(result.action).toBe('auto');
    expect(result.skill).toBe('ivy-design');
  });

  it('routes design to ivy-build', () => {
    const result = resolveNextSkill(makeState('design'));
    expect(result.action).toBe('auto');
    expect(result.skill).toBe('ivy-build');
  });

  it('routes build to ivy-verify', () => {
    const result = resolveNextSkill(makeState('build'));
    expect(result.skill).toBe('ivy-verify');
  });

  it('routes verify to ivy-archive', () => {
    const result = resolveNextSkill(makeState('verify'));
    expect(result.skill).toBe('ivy-archive');
  });

  it('routes archive to done', () => {
    const result = resolveNextSkill(makeState('archive'));
    expect(result.action).toBe('done');
  });

  it('routes hotfix open to ivy-build', () => {
    const result = resolveNextSkill(makeState('open', { workflow: 'hotfix' }));
    expect(result.skill).toBe('ivy-build');
  });

  it('routes tweak open to ivy-build', () => {
    const result = resolveNextSkill(makeState('open', { workflow: 'tweak' }));
    expect(result.skill).toBe('ivy-build');
  });

  it('returns manual when auto_transition is false', () => {
    const result = resolveNextSkill(makeState('design', { auto_transition: false }));
    expect(result.action).toBe('manual');
    expect(result.skill).toBe('ivy-build');
    expect(result.hint).toBeTruthy();
  });

  it('formatNextResult for auto', () => {
    expect(formatNextResult({ action: 'auto', skill: 'ivy-build' })).toBe('NEXT: auto, SKILL: ivy-build');
  });

  it('formatNextResult for manual', () => {
    const result = formatNextResult({ action: 'manual', skill: 'ivy-build', hint: 'Run manually' });
    expect(result).toContain('NEXT: manual');
    expect(result).toContain('ivy-build');
  });

  it('formatNextResult for done', () => {
    expect(formatNextResult({ action: 'done' })).toBe('NEXT: done');
  });
});

describe('preset-workflow upgrade signals', () => {
  it('hotfix upgrades on dbSchemaChange signal', () => {
    const result = detectPreset('fix-bug', 2, undefined, { dbSchemaChange: true });
    expect(result.preset).toBe('hotfix');
    expect(result.upgrade).not.toBeNull();
    expect(result.upgrade!.triggeredConditions).toContain('DB schema changes');
  });

  it('hotfix upgrades on architectureChange signal', () => {
    const result = detectPreset('fix-bug', 2, undefined, { architectureChange: true });
    expect(result.upgrade).not.toBeNull();
    expect(result.upgrade!.triggeredConditions).toContain('architecture changes');
  });

  it('tweak upgrades on crossModule signal', () => {
    const result = detectPreset('tweak-ui', 4, undefined, { crossModule: true });
    expect(result.preset).toBe('tweak');
    expect(result.upgrade).not.toBeNull();
    expect(result.upgrade!.triggeredConditions).toContain('cross-module coordination');
  });

  it('tweak upgrades on newCapability signal', () => {
    const result = detectPreset('tweak-ui', 4, undefined, { newCapability: true });
    expect(result.upgrade).not.toBeNull();
    expect(result.upgrade!.triggeredConditions).toContain('new capability needed');
  });

  it('tweak upgrades on 5+ new tests signal', () => {
    const result = detectPreset('tweak-ui', 4, undefined, { newTestCount: 7 });
    expect(result.upgrade).not.toBeNull();
    expect(result.upgrade!.triggeredConditions).toContain('7 new test cases');
  });

  it('tweak does not upgrade on 4 new tests', () => {
    const result = detectPreset('tweak-ui', 4, undefined, { newTestCount: 4 });
    expect(result.upgrade).toBeNull();
  });

  it('full workflow never triggers upgrade', () => {
    const result = detectPreset('big-feature', 10, undefined, { architectureChange: true });
    expect(result.preset).toBe('full');
    expect(result.upgrade).toBeNull();
  });

  it('BUILTIN_PRESETS have upgradeConditions', () => {
    expect(BUILTIN_PRESETS.hotfix.upgradeConditions.length).toBeGreaterThan(0);
    expect(BUILTIN_PRESETS.tweak.upgradeConditions.length).toBeGreaterThan(0);
    expect(BUILTIN_PRESETS.full.upgradeConditions).toEqual([]);
  });

  it('BUILTIN_PRESETS have skipDeltaSpecChecklist', () => {
    expect(BUILTIN_PRESETS.hotfix.skipDeltaSpecChecklist).toBe(true);
    expect(BUILTIN_PRESETS.tweak.skipDeltaSpecChecklist).toBe(true);
    expect(BUILTIN_PRESETS.full.skipDeltaSpecChecklist).toBe(false);
  });
});

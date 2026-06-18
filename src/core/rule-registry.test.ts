/**
 * Tests for rule-registry.ts (v0.7).
 *
 * Coverage:
 * - 5 built-in rules with correct metadata
 * - Effective config merge with overrides
 * - Override validation (allowed vs disallowed paths)
 * - Override application and removal
 * - Rule manifest read/write
 * - Nonexistent rule handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import {
  getRuleDefinitions,
  getRuleDefinition,
  getEffectiveConfig,
  applyOverride,
  removeOverride,
  readRuleManifest,
  writeRuleManifest,
  buildRuleManifest,
  validateOverride,
  type RuleManifest,
} from './rule-registry.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-rules-'));
}

describe('getRuleDefinitions', () => {
  it('returns 5 built-in rules', () => {
    const rules = getRuleDefinitions();
    expect(rules).toHaveLength(5);
  });

  it('includes stuck_detection with correct type', () => {
    const rules = getRuleDefinitions();
    const stuck = rules.find((r) => r.name === 'stuck_detection');
    expect(stuck).toBeDefined();
    expect(stuck!.type).toBe('threshold');
    expect(stuck!.algorithmVersion).toBe(3);
    expect(stuck!.configVersion).toBe(2);
    expect(stuck!.source).toBe('builtin');
    expect(stuck!.allowedOverrides).toContain('build');
  });

  it('includes all expected rule names', () => {
    const names = getRuleDefinitions().map((r) => r.name);
    expect(names).toEqual([
      'stuck_detection',
      'phase_review',
      'rollback_detection',
      'visibility_adjust',
      'calibration',
    ]);
  });

  it('each rule has allowedOverrides array', () => {
    for (const rule of getRuleDefinitions()) {
      expect(Array.isArray(rule.allowedOverrides)).toBe(true);
      expect(rule.description).toBeTruthy();
    }
  });
});

describe('getRuleDefinition', () => {
  it('finds rule by name', () => {
    const rule = getRuleDefinition('stuck_detection');
    expect(rule).toBeDefined();
    expect(rule!.name).toBe('stuck_detection');
  });

  it('returns undefined for nonexistent rule', () => {
    const rule = getRuleDefinition('nonexistent');
    expect(rule).toBeUndefined();
  });
});

describe('validateOverride', () => {
  it('allows valid override path', () => {
    const result = validateOverride('stuck_detection', 'build');
    expect(result.valid).toBe(true);
  });

  it('rejects invalid override path', () => {
    const result = validateOverride('stuck_detection', 'invalid_param');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not allowed');
  });

  it('rejects nonexistent rule', () => {
    const result = validateOverride('nonexistent', 'param');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not found');
  });
});

describe('applyOverride and removeOverride', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  });

  it('applies override and persists to manifest', async () => {
    await applyOverride(tmp, 'stuck_detection', 'build', 25, 'Team is faster');

    const manifest = await readRuleManifest(tmp);
    expect(manifest).not.toBeNull();
    const ruleEntry = manifest!.rules.find((r) => r.name === 'stuck_detection');
    expect(ruleEntry).toBeDefined();
    expect(ruleEntry!.overrides).toHaveLength(1);
    expect(ruleEntry!.overrides[0].path).toBe('build');
    expect(ruleEntry!.overrides[0].value).toBe(25);
    expect(ruleEntry!.overrides[0].reason).toBe('Team is faster');
  });

  it('override changes effective config', async () => {
    await applyOverride(tmp, 'stuck_detection', 'build', 25);

    const effective = await getEffectiveConfig(tmp, 'stuck_detection');
    const thresholds = effective.thresholdByPhase as Record<string, number>;
    expect(thresholds.build).toBe(25);
    // Other thresholds unchanged
    expect(thresholds.open).toBe(14);
    expect(thresholds.design).toBe(21);
  });

  it('removes override and restores default', async () => {
    await applyOverride(tmp, 'stuck_detection', 'build', 25);
    const removed = await removeOverride(tmp, 'stuck_detection', 'build');
    expect(removed).toBe(true);

    const effective = await getEffectiveConfig(tmp, 'stuck_detection');
    const thresholds = effective.thresholdByPhase as Record<string, number>;
    expect(thresholds.build).toBe(30); // default restored
  });

  it('returns false when removing nonexistent override', async () => {
    const removed = await removeOverride(tmp, 'stuck_detection', 'build');
    expect(removed).toBe(false);
  });

  it('throws on invalid override path', async () => {
    await expect(
      applyOverride(tmp, 'stuck_detection', 'invalid_param', 10),
    ).rejects.toThrow('not allowed');
  });

  it('throws on nonexistent rule', async () => {
    await expect(
      applyOverride(tmp, 'nonexistent', 'param', 10),
    ).rejects.toThrow('not found');
  });

  it('handles direct config overrides (non-threshold rules)', async () => {
    await applyOverride(tmp, 'phase_review', 'enabled', false);

    const effective = await getEffectiveConfig(tmp, 'phase_review');
    expect(effective.enabled).toBe(false);
  });

  it('buildRuleManifest returns correct effective config after override', async () => {
    await applyOverride(tmp, 'stuck_detection', 'build', 25);
    await applyOverride(tmp, 'stuck_detection', 'open', 10);

    const manifest = await buildRuleManifest(tmp);
    const stuck = manifest.rules.find((r) => r.name === 'stuck_detection');
    expect(stuck).toBeDefined();
    expect(stuck!.overrides).toHaveLength(2);

    const thresholds = stuck!.effectiveConfig.thresholdByPhase as Record<string, number>;
    expect(thresholds.build).toBe(25);
    expect(thresholds.open).toBe(10);
    expect(thresholds.design).toBe(21); // unchanged
  });
});

describe('readRuleManifest and writeRuleManifest', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  });

  it('returns null when no manifest exists', async () => {
    const manifest = await readRuleManifest(tmp);
    expect(manifest).toBeNull();
  });

  it('persists and reads manifest correctly', async () => {
    const testManifest: RuleManifest = {
      version: 1,
      rules: [
        {
          name: 'stuck_detection',
          configVersion: 2,
          effectiveConfig: { thresholdByPhase: { open: 14, build: 25 } },
          overrides: [{ at: '2026-06-17T00:00:00Z', path: 'build', value: 25 }],
        },
      ],
    };

    await writeRuleManifest(tmp, testManifest);
    const read = await readRuleManifest(tmp);
    expect(read).not.toBeNull();
    expect(read!.rules).toHaveLength(1);
    expect(read!.rules[0].name).toBe('stuck_detection');
  });
});

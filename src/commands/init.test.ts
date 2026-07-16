import { describe, it, expect } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import { annotateChoice, selectPlatformsQuick, selectAllDetected, installForOnePlatform } from '../core/installers/platform.js';
import { PLATFORMS } from '../core/platforms.js';

// ── helpers ──

function makeResult(platformId: string, detected: boolean, confidence: 1.0 | 0.8 | 0.6) {
  const platform = PLATFORMS.find((p) => p.id === platformId);
  if (!platform) throw new Error(`unknown platform: ${platformId}`);
  return { platform, detected, confidence, matchedPath: detected ? `.${platformId}/settings.json` : '' };
}

// ── selectPlatformsQuick ──

describe('selectPlatformsQuick', () => {
  const detected = [
    makeResult('claude', true, 1.0),
    makeResult('cursor', true, 0.8),
    makeResult('windsurf', false, 0.6),
    makeResult('trae', true, 0.6),
  ];

  it('quick mode returns platforms with confidence >= 0.8', async () => {
    const picks = await selectPlatformsQuick(detected);
    const ids = picks.map((p) => p.id);
    expect(ids).toContain('claude');
    expect(ids).toContain('cursor');
    expect(ids).not.toContain('trae');
    expect(ids).not.toContain('windsurf');
  });

  it('quick mode falls back to claude when nothing >=0.8 detected', async () => {
    const lowConf = [
      makeResult('windsurf', true, 0.6),
      makeResult('codebuddy', false, 0.6),
    ];
    const picks = await selectPlatformsQuick(lowConf);
    expect(picks).toHaveLength(1);
    expect(picks[0].id).toBe('claude');
  });

  it('quick mode with all undetected returns claude fallback', async () => {
    const allFalse = detected.map((r) => ({ ...r, detected: false, confidence: 0.6 as const, matchedPath: '' }));
    const picks = await selectPlatformsQuick(allFalse);
    expect(picks).toHaveLength(1);
    expect(picks[0].id).toBe('claude');
  });
});

// ── annotateChoice ──

describe('annotateChoice', () => {
  it('confidence 1.0: name includes "(detected)", checked = true', () => {
    const r = makeResult('claude', true, 1.0);
    const c = annotateChoice(r);
    expect(c.name).toContain('(detected)');
    expect(c.checked).toBe(true);
    expect(c.value).toBe('claude');
  });

  it('confidence 0.8: name includes "(rules dir)", checked = true', () => {
    const r = makeResult('cursor', true, 0.8);
    const c = annotateChoice(r);
    expect(c.name).toContain('(rules dir)');
    expect(c.checked).toBe(true);
  });

  it('confidence 0.6 detected: name includes "(low confidence)", checked = false', () => {
    const r = makeResult('trae', true, 0.6);
    const c = annotateChoice(r);
    expect(c.name).toContain('(low confidence');
    expect(c.checked).toBe(false);
  });

  it('not detected: name has no suffix, checked = false', () => {
    const r = makeResult('windsurf', false, 0.6);
    const c = annotateChoice(r);
    expect(c.name).toBe('Windsurf');
    expect(c.checked).toBe(false);
  });
});

// ── installForOnePlatform ──

describe('installForOnePlatform', () => {
  const claude = PLATFORMS.find((p) => p.id === 'claude')!;

  it('returns ok:true when all steps succeed', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-install-'));
    try {
      const report = await installForOnePlatform(tmp, claude, true, 'project');
      expect(report.id).toBe('claude');
      expect(report.ok).toBe(true);
      expect(report.error).toBeUndefined();
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it('returns ok:false with error message on failure (invalid dir)', async () => {
    const report = await installForOnePlatform('/nonexistent-ivyflow-test', claude, true, 'project');
    expect(report.ok).toBe(false);
    expect(report.error).toBeDefined();
    expect(typeof report.error).toBe('string');
  });
});

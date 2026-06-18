import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import { detectPlatform, detectPlatforms } from './detect.js';

describe('detectPlatform (v0.1 compat)', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-detect-'));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns claude with detected=false when .claude is absent', async () => {
    const { platform, detected } = await detectPlatform(tmp);
    expect(platform.id).toBe('claude');
    expect(detected).toBe(false);
  });

  it('returns claude with detected=true when .claude exists', async () => {
    await fs.mkdir(path.join(tmp, '.claude'), { recursive: true });
    const { platform, detected } = await detectPlatform(tmp);
    expect(platform.id).toBe('claude');
    expect(detected).toBe(true);
  });
});

describe('detectPlatforms (v0.2)', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-detect2-'));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns 16 entries, all undetected on a clean dir', async () => {
    const results = await detectPlatforms(tmp);
    expect(results).toHaveLength(16);
    expect(results.every((r) => r.detected === false)).toBe(true);
  });

  it('config file hit -> confidence 1.0 (claude)', async () => {
    await fs.mkdir(path.join(tmp, '.claude'), { recursive: true });
    await fs.writeFile(path.join(tmp, '.claude/settings.json'), '{}');
    const claude = (await detectPlatforms(tmp)).find((r) => r.platform.id === 'claude');
    expect(claude?.detected).toBe(true);
    expect(claude?.confidence).toBe(1.0);
    expect(claude?.matchedPath).toBe('.claude/settings.json');
  });

  it('rules dir hit -> confidence 0.8 (cursor)', async () => {
    await fs.mkdir(path.join(tmp, '.cursor/rules'), { recursive: true });
    const cursor = (await detectPlatforms(tmp)).find((r) => r.platform.id === 'cursor');
    expect(cursor?.detected).toBe(true);
    expect(cursor?.confidence).toBe(0.8);
    expect(cursor?.matchedPath).toBe('.cursor/rules');
  });

  it('generic dir hit -> confidence 0.6 (github-copilot via .github/)', async () => {
    await fs.mkdir(path.join(tmp, '.github'), { recursive: true });
    const copilot = (await detectPlatforms(tmp)).find((r) => r.platform.id === 'github-copilot');
    expect(copilot?.detected).toBe(true);
    expect(copilot?.confidence).toBe(0.6);
    expect(copilot?.matchedPath).toBe('.github');
  });

  it('multiple platforms detected concurrently', async () => {
    await fs.mkdir(path.join(tmp, '.claude'), { recursive: true });
    await fs.writeFile(path.join(tmp, '.claude/settings.json'), '{}');
    await fs.mkdir(path.join(tmp, '.cursor/rules'), { recursive: true });
    await fs.mkdir(path.join(tmp, '.trae/rules'), { recursive: true });

    const results = await detectPlatforms(tmp);
    const detectedIds = results.filter((r) => r.detected).map((r) => r.platform.id).sort();
    expect(detectedIds).toEqual(['claude', 'cursor', 'trae']);
    expect(results.find((r) => r.platform.id === 'trae')?.confidence).toBe(0.8);
  });

  it('priority: settings.json wins over rules/ dir', async () => {
    await fs.mkdir(path.join(tmp, '.claude/skills'), { recursive: true });
    await fs.writeFile(path.join(tmp, '.claude/settings.json'), '{}');
    const claude = (await detectPlatforms(tmp)).find((r) => r.platform.id === 'claude');
    expect(claude?.confidence).toBe(1.0);
    expect(claude?.matchedPath).toBe('.claude/settings.json');
  });

  it('detects cline via settings.json (confidence 1.0)', async () => {
    await fs.mkdir(path.join(tmp, '.cline'), { recursive: true });
    await fs.writeFile(path.join(tmp, '.cline/settings.json'), '{}');
    const cline = (await detectPlatforms(tmp)).find((r) => r.platform.id === 'cline');
    expect(cline?.detected).toBe(true);
    expect(cline?.confidence).toBe(1.0);
    expect(cline?.matchedPath).toBe('.cline/settings.json');
  });

  it('detects cline via rules dir (confidence 0.8)', async () => {
    await fs.mkdir(path.join(tmp, '.cline/rules'), { recursive: true });
    const cline = (await detectPlatforms(tmp)).find((r) => r.platform.id === 'cline');
    expect(cline?.detected).toBe(true);
    expect(cline?.confidence).toBe(0.8);
    expect(cline?.matchedPath).toBe('.cline/rules');
  });

  it('detects amazon-q via rules dir (confidence 0.8)', async () => {
    await fs.mkdir(path.join(tmp, '.amazonq/rules'), { recursive: true });
    const amazonq = (await detectPlatforms(tmp)).find((r) => r.platform.id === 'amazon-q');
    expect(amazonq?.detected).toBe(true);
    expect(amazonq?.confidence).toBe(0.8);
    expect(amazonq?.matchedPath).toBe('.amazonq/rules');
  });

  it('detects amazon-q via generic dir (confidence 0.6)', async () => {
    await fs.mkdir(path.join(tmp, '.amazonq'), { recursive: true });
    const amazonq = (await detectPlatforms(tmp)).find((r) => r.platform.id === 'amazon-q');
    expect(amazonq?.detected).toBe(true);
    expect(amazonq?.confidence).toBe(0.6);
    expect(amazonq?.matchedPath).toBe('.amazonq');
  });

  it('uses detectionPaths from Platform interface (v0.8 single source)', async () => {
    // All platforms now have detectionPaths populated. Verify they are used
    // by checking detection works (both sources have identical data).
    await fs.mkdir(path.join(tmp, '.claude/skills'), { recursive: true });
    const claude = (await detectPlatforms(tmp)).find((r) => r.platform.id === 'claude');
    expect(claude?.detected).toBe(true);
    expect(claude?.confidence).toBe(0.8);
  });

});

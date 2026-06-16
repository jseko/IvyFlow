import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import {
  copyIvySkillsForPlatform,
  copyIvyRulesForPlatform,
  getManifestSkills,
  getAssetsDir,
} from './skills.js';
import { PLATFORMS } from './platforms.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-test-'));
}

describe('skills.ts — assets/manifest.json', () => {
  it('manifest lists at least one skill', async () => {
    const skills = await getManifestSkills();
    expect(skills.length).toBeGreaterThan(0);
    expect(skills).toContain('ivy/SKILL.md');
  });

  it('getAssetsDir resolves to a real directory', async () => {
    const stat = await fs.stat(getAssetsDir());
    expect(stat.isDirectory()).toBe(true);
  });
});

describe('copyIvySkillsForPlatform', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('copies all manifest skills into the platform skills dir', async () => {
    const claude = PLATFORMS[0];
    const result = await copyIvySkillsForPlatform(tmp, claude, true, 'project');

    expect(result.skipped).toBe(0);
    expect(result.copied).toBeGreaterThan(0);

    const skillFile = path.join(tmp, claude.skillsDir, 'skills', 'ivy', 'SKILL.md');
    const stat = await fs.stat(skillFile);
    expect(stat.isFile()).toBe(true);
  });

  it('overwrite=false skips files that already exist', async () => {
    const claude = PLATFORMS[0];
    await copyIvySkillsForPlatform(tmp, claude, true, 'project');
    const second = await copyIvySkillsForPlatform(tmp, claude, false, 'project');

    expect(second.copied).toBe(0);
    expect(second.skipped).toBeGreaterThan(0);
  });

  it('overwrite=true rewrites existing files', async () => {
    const claude = PLATFORMS[0];
    await copyIvySkillsForPlatform(tmp, claude, true, 'project');
    const dest = path.join(tmp, claude.skillsDir, 'skills', 'ivy', 'SKILL.md');
    await fs.writeFile(dest, 'tampered\n', 'utf-8');

    await copyIvySkillsForPlatform(tmp, claude, true, 'project');
    const content = await fs.readFile(dest, 'utf-8');
    expect(content).not.toBe('tampered\n');
  });
});

describe('copyIvyRulesForPlatform', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('copies rule files to <skillsDir>/<rulesDir>/', async () => {
    const claude = PLATFORMS[0];
    const result = await copyIvyRulesForPlatform(tmp, claude, true, 'project');

    expect(result.copied).toBeGreaterThan(0);
    const ruleFile = path.join(tmp, claude.skillsDir, 'rules', 'ivy-phase-guard.md');
    const stat = await fs.stat(ruleFile);
    expect(stat.isFile()).toBe(true);
  });

  it('overwrite=false skips existing rule files', async () => {
    const claude = PLATFORMS[0];
    await copyIvyRulesForPlatform(tmp, claude, true, 'project');
    const second = await copyIvyRulesForPlatform(tmp, claude, false, 'project');

    expect(second.copied).toBe(0);
    expect(second.skipped).toBeGreaterThan(0);
  });

  it('returns zeros when platform has no rulesDir', async () => {
    const platformNoRules = { ...PLATFORMS[0], rulesDir: undefined, rulesFormat: undefined };
    const result = await copyIvyRulesForPlatform(tmp, platformNoRules, true, 'project');
    expect(result).toEqual({ copied: 0, skipped: 0 });
  });
});

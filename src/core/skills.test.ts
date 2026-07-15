import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import {
  copyIvySkillsForPlatform,
  copyIvyRulesForPlatform,
  installIvyHookForPlatform,
  getManifestSkills,
  getAssetsDir,
  getPlatformRulesDir,
} from './skills.js';
import { PLATFORMS, getPlatformById } from './platforms.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-test-'));
}

describe('skills.ts — assets/manifest.json (v0.2)', () => {
  it('manifest lists all v0.2 skill assets', async () => {
    const skills = await getManifestSkills();
    expect(skills).toContain('roles/developer/skills/ivy/SKILL.md');
    expect(skills).toContain('roles/developer/skills/ivy/references/phase-state-machine.md');
    expect(skills).toContain('roles/developer/skills/ivy/references/cross-cutting.md');
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

  it('copies skills for non-claude md-only platforms (trae)', async () => {
    const trae = getPlatformById('trae')!;
    const result = await copyIvySkillsForPlatform(tmp, trae, true, 'project');
    expect(result.copied).toBeGreaterThan(0);
    const f = path.join(tmp, '.trae', 'skills', 'ivy', 'SKILL.md');
    expect((await fs.stat(f)).isFile()).toBe(true);
  });
});

describe('copyIvyRulesForPlatform — per-platform rendering', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('claude (md): byte-identical to source', async () => {
    const claude = getPlatformById('claude')!;
    const result = await copyIvyRulesForPlatform(tmp, claude, true, 'project');
    expect(result.copied).toBeGreaterThan(0);

    const src = path.join(getAssetsDir(), 'roles', 'developer', 'rules', 'ivy-phase-guard.md');
    const dest = path.join(tmp, '.claude', 'rules', 'ivy-phase-guard.md');
    expect(await fs.readFile(dest, 'utf-8')).toBe(await fs.readFile(src, 'utf-8'));
  });

  it('cursor (mdc): writes .mdc file with frontmatter', async () => {
    const cursor = getPlatformById('cursor')!;
    await copyIvyRulesForPlatform(tmp, cursor, true, 'project');
    const dest = path.join(tmp, '.cursor', 'rules', 'ivy-phase-guard.mdc');
    const content = await fs.readFile(dest, 'utf-8');
    expect(content.startsWith('---')).toBe(true);
    expect(content).toContain('alwaysApply: true');
  });

  it('github-copilot: writes .github/copilot-instructions.md', async () => {
    const copilot = getPlatformById('github-copilot')!;
    await copyIvyRulesForPlatform(tmp, copilot, true, 'project');
    const dest = path.join(tmp, '.github', 'copilot-instructions.md');
    const content = await fs.readFile(dest, 'utf-8');
    expect(content).toContain('## DO');
    expect(content).toContain('## DO NOT');
  });

  it('overwrite=false skips existing rule files', async () => {
    const claude = PLATFORMS[0];
    await copyIvyRulesForPlatform(tmp, claude, true, 'project');
    const second = await copyIvyRulesForPlatform(tmp, claude, false, 'project');
    expect(second.copied).toBe(0);
    expect(second.skipped).toBeGreaterThan(0);
  });

  it('returns zeros when platform has no rulesFormat', async () => {
    const stub = { ...PLATFORMS[0], rulesFormat: undefined };
    const result = await copyIvyRulesForPlatform(tmp, stub, true, 'project');
    expect(result).toEqual({ copied: 0, skipped: 0 });
  });
});

describe('installIvyHookForPlatform — windsurf + cursor', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('writes valid JSON for windsurf', async () => {
    const windsurf = getPlatformById('windsurf')!;
    const result = await installIvyHookForPlatform(tmp, windsurf, true, 'project');
    expect(result.installed).toBe(true);

    const content = await fs.readFile(path.join(tmp, '.windsurf', 'hooks', 'ivy-phase-guard.json'), 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.event).toBe('PreToolUse');
  });

  it('no-op for platforms without rendered hooks', async () => {
    const trae = getPlatformById('trae')!;
    const result = await installIvyHookForPlatform(tmp, trae, true, 'project');
    expect(result.installed).toBe(false);
    expect(result.reason).toBe('platform-has-no-hook-format');
  });

  it('writes valid hooks.json for cursor', async () => {
    const cursor = getPlatformById('cursor')!;
    const result = await installIvyHookForPlatform(tmp, cursor, true, 'project');
    expect(result.installed).toBe(true);

    const content = await fs.readFile(path.join(tmp, '.cursor', 'hooks.json'), 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.hooks.preToolUse).toBeDefined();
    expect(parsed.hooks.preToolUse[0].command).toContain('ivy-phase-guard.sh');

    const guardScript = path.join(tmp, '.cursor', 'hooks', 'ivy-phase-guard.sh');
    const scriptExists = await fs.stat(guardScript).then(() => true).catch(() => false);
    expect(scriptExists).toBe(true);
  });

  it('skips when file exists and overwrite=false', async () => {
    const windsurf = getPlatformById('windsurf')!;
    await installIvyHookForPlatform(tmp, windsurf, true, 'project');
    const second = await installIvyHookForPlatform(tmp, windsurf, false, 'project');
    expect(second.installed).toBe(false);
    expect(second.reason).toBe('exists');
  });
});

describe('getPlatformRulesDir — rulesBaseDir support (v0.8)', () => {
  it('returns rulesBaseDir when set', () => {
    const platform = getPlatformById('claude')!;
    const withBaseDir = { ...platform, rulesBaseDir: '.clinerules' };
    const result = getPlatformRulesDir(withBaseDir, '/tmp/test', 'project');
    expect(result).toBe('/tmp/test/.clinerules');
  });

  it('falls back to skillsDir when rulesBaseDir is not set', () => {
    const claude = getPlatformById('claude')!;
    const result = getPlatformRulesDir(claude, '/tmp/test', 'project');
    expect(result).toBe('/tmp/test/.claude/rules');
  });
});

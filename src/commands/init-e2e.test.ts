import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import { runInit } from './init.js';
import { PLATFORMS } from '../core/platforms.js';
import { readYaml } from '../utils/yaml.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-e2e-'));
}

interface ProjectYaml {
  version?: string;
  platforms?: string[];
  detected_platforms?: Array<{ id: string; confidence: number }>;
  scope?: string;
  analytics_enabled?: boolean;
}

describe('end-to-end init — all 7 platforms (v0.2)', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  for (const p of PLATFORMS) {
    it(`installs cleanly for ${p.id}`, async () => {
      const code = await runInit({
        mode: 'quick',
        cwd: tmp,
        skipOpenSpec: true,
        platforms: [p.id],
      });
      expect(code).toBe(0);

      // SKILL.md must land in the platform's skillsDir/skills/ivy/.
      const skill = path.join(tmp, p.skillsDir, 'skills', 'ivy', 'SKILL.md');
      expect((await fs.stat(skill)).isFile()).toBe(true);

      // Rule must be rendered to its platform-specific path.
      if (p.rulesFormat === 'copilot') {
        const dest = path.join(tmp, p.skillsDir, 'copilot-instructions.md');
        expect((await fs.stat(dest)).isFile()).toBe(true);
      } else if (p.rulesFormat) {
        const ext = p.rulesFormat === 'mdc' ? '.mdc' : '.md';
        const dest = path.join(tmp, p.skillsDir, p.rulesDir ?? 'rules', `ivy-phase-guard${ext}`);
        expect((await fs.stat(dest)).isFile()).toBe(true);
        // Security rule must also be installed.
        const secDest = path.join(tmp, p.skillsDir, p.rulesDir ?? 'rules', `ivy-security${ext}`);
        expect((await fs.stat(secDest)).isFile()).toBe(true);
      }

      // Hook check (only windsurf renders one).
      if (p.hookFormat === 'windsurf-json' && p.hookPath) {
        const hookFile = path.join(tmp, p.skillsDir, p.hookPath);
        expect((await fs.stat(hookFile)).isFile()).toBe(true);
      }

      // project.yaml schema v0.3.
      const data = await readYaml<ProjectYaml>(path.join(tmp, '.ivy', 'project.yaml'));
      expect(data?.version).toBe('0.3.0');
      expect(data?.platforms).toEqual([p.id]);
      expect(data?.analytics_enabled).toBe(false);
    });
  }
});

describe('multi-platform install', () => {
  let tmp: string;
  beforeEach(async () => { tmp = await mkTmpDir(); });
  afterEach(async () => { await fs.rm(tmp, { recursive: true, force: true }); });

  it('installs into 3 platforms in parallel without conflict', async () => {
    const code = await runInit({
      mode: 'quick',
      cwd: tmp,
      skipOpenSpec: true,
      platforms: ['claude', 'cursor', 'windsurf'],
    });
    expect(code).toBe(0);

    const claudeSkill = path.join(tmp, '.claude', 'skills', 'ivy', 'SKILL.md');
    const cursorRule = path.join(tmp, '.cursor', 'rules', 'ivy-phase-guard.mdc');
    const windsurfHook = path.join(tmp, '.windsurf', 'hooks', 'ivy-phase-guard.json');
    for (const f of [claudeSkill, cursorRule, windsurfHook]) {
      expect((await fs.stat(f)).isFile()).toBe(true);
    }

    const data = await readYaml<ProjectYaml>(path.join(tmp, '.ivy', 'project.yaml'));
    expect(data?.platforms?.length).toBe(3);
  });

  it('quick mode finishes in well under 30s for a single platform', async () => {
    const t0 = Date.now();
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });
    const ms = Date.now() - t0;
    expect(ms).toBeLessThan(30_000);
  });
});

describe('v0.1 → v0.2 backwards compatibility', () => {
  let tmp: string;
  beforeEach(async () => { tmp = await mkTmpDir(); });
  afterEach(async () => { await fs.rm(tmp, { recursive: true, force: true }); });

  it('reads v0.1 project.yaml without exploding (status path)', async () => {
    // Simulate an existing v0.1 install: only `platform: claude`, no `platforms[]`.
    const ivyDir = path.join(tmp, '.ivy');
    await fs.mkdir(ivyDir, { recursive: true });
    await fs.writeFile(
      path.join(ivyDir, 'project.yaml'),
      ['platform: claude', 'scope: project', 'spec_adapter: openspec', ''].join('\n'),
    );
    // status.ts must accept the legacy schema (covered by the runStatus test
    // suite). Here we just confirm the file reads back without YAML errors.
    const data = await readYaml<ProjectYaml & { platform?: string }>(path.join(tmp, '.ivy', 'project.yaml'));
    expect(data?.platforms).toBeUndefined();
    expect(data?.platform).toBe('claude');
  });
});

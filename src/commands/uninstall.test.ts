import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';

import { runUninstall } from './uninstall.js';
import { writeYaml } from '../utils/yaml.js';
import { fileExists } from '../utils/fs.js';

describe('runUninstall', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-uninstall-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function setupProject(platforms: string[] = ['claude']) {
    await fs.mkdir(path.join(tmpDir, '.ivy'), { recursive: true });
    await writeYaml(path.join(tmpDir, '.ivy', 'project.yaml'), {
      version: '0.3',
      platforms,
      scope: 'project',
    });
    // Create dummy platform files
    for (const p of platforms) {
      const dir = path.join(tmpDir, `.${p}`, 'skills', 'ivy');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'SKILL.md'), '# skill');
      const rulesDir = path.join(tmpDir, `.${p}`, 'rules');
      await fs.mkdir(rulesDir, { recursive: true });
      await fs.writeFile(path.join(rulesDir, 'ivy-phase-guard.md'), '# rule');
      await fs.writeFile(path.join(rulesDir, 'ivy-security.md'), '# security');
    }
  }

  it('dry-run prints without deleting', async () => {
    await setupProject(['claude']);
    const exitCode = await runUninstall({ cwd: tmpDir, dryRun: true, force: true });
    expect(exitCode).toBe(0);
    expect(await fileExists(path.join(tmpDir, '.claude', 'skills', 'ivy', 'SKILL.md'))).toBe(true);
  });

  it('force skips confirmation and removes files', async () => {
    await setupProject(['claude']);
    const exitCode = await runUninstall({ cwd: tmpDir, force: true });
    expect(exitCode).toBe(0);
    expect(await fileExists(path.join(tmpDir, '.claude', 'skills', 'ivy'))).toBe(false);
    expect(await fileExists(path.join(tmpDir, '.ivy'))).toBe(false);
  });

  it('is idempotent — second run exits 0', async () => {
    await setupProject(['claude']);
    await runUninstall({ cwd: tmpDir, force: true });
    const exitCode = await runUninstall({ cwd: tmpDir, force: true });
    expect(exitCode).toBe(0);
  });

  it('removes only ivy files, preserves user files', async () => {
    await setupProject(['claude']);
    const userFile = path.join(tmpDir, '.claude', 'rules', 'user-rule.md');
    await fs.writeFile(userFile, '# user');
    await runUninstall({ cwd: tmpDir, force: true });
    expect(await fileExists(userFile)).toBe(true);
  });

  it('preserves non-ivy git hook content', async () => {
    await setupProject(['claude']);
    const hookDir = path.join(tmpDir, '.git', 'hooks');
    await fs.mkdir(hookDir, { recursive: true });
    const userHook = '# user custom hook\necho hello\n';
    const ivyHook = '# === IvyFlow pre-push hook — auto-generated ===\n# ivy\n# === IvyFlow pre-push hook END ===\n';
    await fs.writeFile(path.join(hookDir, 'pre-push'), userHook + ivyHook);

    await runUninstall({ cwd: tmpDir, force: true });
    const remaining = await fs.readFile(path.join(hookDir, 'pre-push'), 'utf-8');
    expect(remaining.trim()).toBe('# user custom hook\necho hello');
  });

  it('deletes git hook file when empty after removal', async () => {
    await setupProject(['claude']);
    const hookDir = path.join(tmpDir, '.git', 'hooks');
    await fs.mkdir(hookDir, { recursive: true });
    const ivyHook = '# === IvyFlow pre-push hook — auto-generated ===\n# ivy\n# === IvyFlow pre-push hook END ===\n';
    await fs.writeFile(path.join(hookDir, 'pre-push'), ivyHook);

    await runUninstall({ cwd: tmpDir, force: true });
    expect(await fileExists(path.join(hookDir, 'pre-push'))).toBe(false);
  });
});

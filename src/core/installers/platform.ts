import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { createRequire } from 'module';
import { fileExists, ensureDir, copyFile, writeFile } from '../../utils/fs.js';
import { logger } from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
  copyIvySkillsForPlatform,
  copyIvyRulesForPlatform,
  copyIvyCommandsForPlatform,
  installIvyHookForPlatform,
  getPlatformRulesDir,
} from '../skills.js';
import { installGitPrePushHook, installGitPostCommitHook } from '../git-hook.js';
import { defaultSpecAdapter } from '../spec-adapter.js';
import { PLATFORMS, type Platform, getPlatformSkillsDir } from '../platforms.js';
import type { PlatformDetectResult } from '../detect.js';
import type { InstallScope } from '../types.js';
import type { CapabilityPack } from '../capability-registry.js';

const require = createRequire(import.meta.url);

export interface PlatformInstallReport {
  id: string;
  ok: boolean;
  error?: string;
}

export function annotateChoice(r: PlatformDetectResult): { name: string; value: string; checked: boolean } {
  let suffix = '';
  let checked = false;
  if (r.detected) {
    if (r.confidence === 1.0) {
      suffix = ' (detected)';
      checked = true;
    } else if (r.confidence === 0.8) {
      suffix = ' (rules dir)';
      checked = true;
    } else {
      suffix = ' (low confidence — please confirm)';
      checked = false;
    }
  }
  return { name: `${r.platform.name}${suffix}`, value: r.platform.id, checked };
}

export async function selectPlatformsQuick(detected: PlatformDetectResult[]): Promise<Platform[]> {
  const picks = detected.filter((r) => r.detected && r.confidence >= 0.8).map((r) => r.platform);
  if (picks.length === 0) {
    const claude = PLATFORMS.find((p) => p.id === 'claude');
    return claude ? [claude] : [];
  }
  return picks;
}

export async function selectAllDetected(detected: PlatformDetectResult[]): Promise<Platform[]> {
  const picks = detected.filter((r) => r.detected).map((r) => r.platform);
  if (picks.length === 0) {
    const claude = PLATFORMS.find((p) => p.id === 'claude');
    return claude ? [claude] : [];
  }
  return picks;
}

export async function installForOnePlatform(
  cwd: string,
  platform: Platform,
  overwrite: boolean,
  scope: InstallScope,
  capabilities: CapabilityPack[] = [],
): Promise<PlatformInstallReport> {
  try {
    // Install all roles' skills and commands
    const allRoles = ['developer', 'pm', 'qa', 'architect', 'devops'];
    let totalSkills = 0;
    let totalSkipped = 0;
    let totalCmds = 0;
    let totalCmdSkipped = 0;

    for (const role of allRoles) {
      if (role === 'developer') {
        const skills = await copyIvySkillsForPlatform(cwd, platform, overwrite, scope);
        totalSkills += skills.copied;
        totalSkipped += skills.skipped;
      }
      const commands = await copyIvyCommandsForPlatform(cwd, platform, overwrite, scope, role);
      totalCmds += commands.copied;
      totalCmdSkipped += commands.skipped;
    }

    const rules = await copyIvyRulesForPlatform(cwd, platform, overwrite, scope);
    const hook = await installIvyHookForPlatform(cwd, platform, overwrite, scope);

    // Install capability pack skills
    let capSkillsCopied = 0;
    for (const cap of capabilities) {
      try {
        const capResult = await copyCapabilityToPlatform(cwd, platform, cap, overwrite, scope);
        capSkillsCopied += capResult.copied;
      } catch { /* non-fatal */ }
    }

    // Install role SKILL.md files for non-developer roles
    for (const role of ['pm', 'qa', 'architect', 'devops']) {
      try {
        await installRoleSkillToPlatform(cwd, platform, role, overwrite, scope);
      } catch { /* non-fatal */ }
    }

    // Install role dispatcher
    try {
      await installRoleDispatcherToPlatform(cwd, platform, overwrite, scope);
    } catch { /* non-fatal */ }

    await verifyPlatformInstall(cwd, platform, scope);

    logger.success(
      `${platform.name}: skills ${totalSkills}/${totalSkipped} skipped, rules ${rules.copied}/${rules.skipped} skipped, commands ${totalCmds}/${totalCmdSkipped} skipped, capabilities ${capSkillsCopied}, hook ${hook.installed ? 'installed' : 'n/a'}`,
    );
    return { id: platform.id, ok: true };
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    logger.error(`${platform.name}: ${msg}`);
    return { id: platform.id, ok: false, error: msg };
  }
}

async function installRoleSkillToPlatform(
  baseDir: string,
  platform: Platform,
  role: string,
  overwrite: boolean,
  scope: InstallScope,
): Promise<void> {
  const skillsDir = path.join(baseDir, getPlatformSkillsDir(platform, scope), 'skills');
  const destDir = path.join(skillsDir, `ivy-role-${role}`);

  if (!overwrite && await fileExists(path.join(destDir, 'SKILL.md'))) {
    return;
  }

  await ensureDir(destDir);

  if (isEmbeddedMode()) {
    const skillKey = `roles/${role}/SKILL.md`;
    const content = (globalThis as Record<string, unknown>).__ivyflow_assets as Record<string, string> | undefined;
    if (content?.[skillKey]) {
      await writeFile(path.join(destDir, 'SKILL.md'), content[skillKey]);
    }
  } else {
    const srcPath = path.join(path.resolve(__dirname, '..', '..', '..', 'assets'), 'roles', role, 'SKILL.md');
    if (await fileExists(srcPath)) {
      await copyFile(srcPath, path.join(destDir, 'SKILL.md'));
    }
  }
}

async function installRoleDispatcherToPlatform(
  baseDir: string,
  platform: Platform,
  overwrite: boolean,
  scope: InstallScope,
): Promise<void> {
  const skillsDir = path.join(baseDir, getPlatformSkillsDir(platform, scope), 'skills');
  const destDir = path.join(skillsDir, 'ivy-role');

  if (!overwrite && await fileExists(path.join(destDir, 'SKILL.md'))) {
    return;
  }

  await ensureDir(destDir);

  if (isEmbeddedMode()) {
    const skillKey = 'skills/ivy-role/SKILL.md';
    const content = (globalThis as Record<string, unknown>).__ivyflow_assets as Record<string, string> | undefined;
    if (content?.[skillKey]) {
      await writeFile(path.join(destDir, 'SKILL.md'), content[skillKey]);
    }
  } else {
    const srcPath = path.join(path.resolve(__dirname, '..', '..', '..', 'assets'), 'skills', 'ivy-role', 'SKILL.md');
    if (await fileExists(srcPath)) {
      await copyFile(srcPath, path.join(destDir, 'SKILL.md'));
    }
  }
}

async function copyCapabilityToPlatform(
  baseDir: string,
  platform: Platform,
  pack: CapabilityPack,
  overwrite: boolean,
  scope: InstallScope,
): Promise<{ copied: number }> {
  const skillsDir = path.join(baseDir, getPlatformSkillsDir(platform, scope), 'skills');
  const destDir = path.join(skillsDir, `ivy-capability-${pack.manifest.name}`);

  if (!overwrite && await fileExists(path.join(destDir, 'SKILL.md'))) {
    return { copied: 0 };
  }

  await ensureDir(destDir);

  let copied = 0;
  // skillPath is the source path in the capability pack
  if (isEmbeddedMode()) {
    const skillKey = `capabilities/${pack.manifest.name}/SKILL.md`;
    const content = globalThis.__ivyflow_assets?.[skillKey];
    if (content) {
      await writeFile(path.join(destDir, 'SKILL.md'), content);
      copied++;
    }
  } else {
    if (await fileExists(pack.skillPath)) {
      await copyFile(pack.skillPath, path.join(destDir, 'SKILL.md'));
      copied++;
    }
  }

  return { copied };
}

function isEmbeddedMode(): boolean {
  return typeof (globalThis as Record<string, unknown>).__ivyflow_assets !== 'undefined';
}

async function verifyPlatformInstall(cwd: string, platform: Platform, scope: InstallScope): Promise<void> {
  const skillsDir = path.join(cwd, getPlatformSkillsDir(platform, scope));
  const ivySkillDir = path.join(skillsDir, 'skills', 'ivy');

  const exists = await fileExists(ivySkillDir);
  if (!exists) {
    throw new Error(`安装验证失败：skills 目录不存在 ${ivySkillDir}`);
  }
}

export async function rollbackInstallations(
  cwd: string,
  platforms: Platform[],
  scope: InstallScope,
): Promise<void> {
  for (const platform of platforms) {
    const skillsDir = path.join(cwd, getPlatformSkillsDir(platform, scope));
    const ivySkillDir = path.join(skillsDir, 'skills', 'ivy');

    try {
      await fs.rm(ivySkillDir, { recursive: true, force: true });
    } catch { /* best-effort */ }

    if (platform.rulesFormat && platform.rulesFormat !== 'copilot') {
      const rulesDir = getPlatformRulesDir(platform as Parameters<typeof getPlatformRulesDir>[0], cwd, scope);
      for (const name of ['ivy-phase-guard', 'ivy-security']) {
        const ext = platform.rulesFormat === 'mdc' ? '.mdc' : '.md';
        try {
          await fs.rm(path.join(rulesDir, name + ext), { force: true });
        } catch { /* best-effort */ }
      }
    }

    if (platform.hookPath) {
      try {
        await fs.rm(path.join(skillsDir, platform.hookPath), { force: true });
      } catch { /* best-effort */ }
    }

    if (platform.rulesFormat === 'copilot') {
      try {
        await fs.rm(path.join(skillsDir, 'copilot-instructions.md'), { force: true });
      } catch { /* best-effort */ }
    }

    logger.dim(`  Rolled back ${platform.name}`);
  }
}

export async function setupOpenSpec(cwd: string, platforms: Platform[], scope: InstallScope): Promise<boolean> {
  const toolIds = platforms.map((p) => p.openspecToolId).filter((id) => id.length > 0);
  if (toolIds.length === 0) {
    logger.dim('(OpenSpec setup skipped — no tool ids)');
    return true;
  }

  logger.step('Setting up OpenSpec...');
  const cliReady = await defaultSpecAdapter.ensureCli(scope, cwd);
  if (!cliReady) {
    logger.error('OpenSpec CLI not available; aborting. Run `ivy init` again after installing it.');
    return false;
  }
  const specResult = await defaultSpecAdapter.init(cwd, toolIds, scope);
  if (specResult === 'failed') {
    logger.error('OpenSpec init failed; see logs above.');
    return false;
  }
  logger.success(`OpenSpec ${specResult}.`);
  return true;
}

export async function setupGitHooks(cwd: string, overwrite: boolean): Promise<void> {
  logger.step('Installing git pre-push hook...');
  const prePushResult = await installGitPrePushHook(cwd, overwrite);
  if (prePushResult.installed) {
    logger.success(`Pre-push hook installed at ${path.relative(cwd, prePushResult.path)}`);
  } else if (prePushResult.reason === 'no-git') {
    logger.warn('Not a git repo — skipping git hooks (you can re-run `ivy init` later).');
  } else {
    logger.dim(`Pre-push hook already exists at ${prePushResult.path} (use --overwrite to replace).`);
  }

  logger.step('Installing git post-commit hook (analytics)...');
  const postCommitResult = await installGitPostCommitHook(cwd, overwrite);
  if (postCommitResult.installed) {
    logger.success(`Post-commit hook installed at ${path.relative(cwd, postCommitResult.path)}`);
  } else if (postCommitResult.reason === 'no-git') {
    /* already warned above */
  } else {
    logger.dim(`Post-commit hook already exists at ${postCommitResult.path} (use --overwrite to replace).`);
  }
}

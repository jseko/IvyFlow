import path from 'path';
import { promises as fs } from 'fs';

import { readYaml } from '../utils/yaml.js';
import { fileExists, readFile, writeFile } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import { getPlatformById, getPlatformSkillsDir, type Platform } from '../core/platforms.js';
import { HOOK_START_MARKER, HOOK_END_MARKER } from '../core/git-hook.js';
import type { InstallScope } from '../core/types.js';

export interface UninstallOptions {
  cwd?: string;
  platforms?: string[];
  dryRun?: boolean;
  force?: boolean;
}

interface ProjectYaml {
  version?: string;
  scope?: InstallScope;
  platform?: string;
  platforms?: string[];
}

interface RemovalItem {
  type: 'dir' | 'file';
  path: string;
}

function resolveInstalledPlatforms(data: ProjectYaml | null, explicit?: string[]): Platform[] {
  if (explicit && explicit.length > 0) {
    return explicit.map((id) => getPlatformById(id)).filter((p): p is Platform => p !== undefined);
  }
  if (!data) return [];
  const ids = data.platforms ?? (data.platform ? [data.platform] : []);
  return ids.map((id) => getPlatformById(id)).filter((p): p is Platform => p !== undefined);
}

async function gatherRemovals(
  cwd: string,
  platforms: Platform[],
  scope: InstallScope,
): Promise<RemovalItem[]> {
  const items: RemovalItem[] = [];

  for (const platform of platforms) {
    const skillsDir = getPlatformSkillsDir(platform, scope);

    // Skills directory
    const skillDir = path.join(cwd, skillsDir, 'skills', 'ivy');
    if (await fileExists(skillDir)) {
      items.push({ type: 'dir', path: skillDir });
    }

    // Rules
    if (platform.rulesFormat) {
      const rulesDir = platform.rulesDir ?? 'rules';
      const ext = platform.rulesFormat === 'mdc' ? '.mdc' : '.md';
      const phaseGuard = path.join(cwd, skillsDir, rulesDir, `ivy-phase-guard${ext}`);
      const security = path.join(cwd, skillsDir, rulesDir, `ivy-security${ext}`);
      if (await fileExists(phaseGuard)) items.push({ type: 'file', path: phaseGuard });
      if (await fileExists(security)) items.push({ type: 'file', path: security });
    }

    // Hook (Windsurf only)
    if (platform.hookFormat === 'windsurf-json' && platform.hookPath) {
      const hookPath = path.join(cwd, skillsDir, platform.hookPath);
      if (await fileExists(hookPath)) items.push({ type: 'file', path: hookPath });
    }
  }

  // .ivy/ directory
  const ivyDir = path.join(cwd, '.ivy');
  if (await fileExists(ivyDir)) {
    items.push({ type: 'dir', path: ivyDir });
  }

  return items;
}

async function removeGitHookSection(cwd: string, dryRun: boolean): Promise<boolean> {
  const gitHookPath = path.join(cwd, '.git', 'hooks', 'pre-push');
  if (!(await fileExists(gitHookPath))) return false;

  const content = await readFile(gitHookPath);
  const startIdx = content.indexOf(HOOK_START_MARKER);
  if (startIdx === -1) return false;

  const endIdx = content.indexOf(HOOK_END_MARKER, startIdx);
  if (endIdx === -1) return false;

  const before = content.slice(0, startIdx);
  const after = content.slice(endIdx + HOOK_END_MARKER.length);
  // Clean up extra newlines
  const cleanedBefore = before.replace(/\n+$/, '\n');
  const cleanedAfter = after.replace(/^\n+/, '');
  const newContent = cleanedBefore + cleanedAfter;

  if (dryRun) {
    logger.dim(`  [dry-run] would edit ${gitHookPath}`);
    return true;
  }

  if (newContent.trim().length === 0) {
    await fs.unlink(gitHookPath);
    logger.dim(`  removed ${gitHookPath} (empty after IvyFlow section removal)`);
  } else {
    await writeFile(gitHookPath, newContent);
    logger.dim(`  edited ${gitHookPath} (IvyFlow section removed)`);
  }
  return true;
}

async function removeItems(items: RemovalItem[], dryRun: boolean): Promise<void> {
  for (const item of items) {
    if (dryRun) {
      logger.dim(`  [dry-run] would remove ${item.type}: ${item.path}`);
      continue;
    }
    try {
      if (item.type === 'dir') {
        await fs.rm(item.path, { recursive: true, force: true });
      } else {
        await fs.unlink(item.path);
      }
      logger.dim(`  removed ${item.type}: ${item.path}`);
    } catch {
      // Idempotent: ignore if already removed
      logger.dim(`  skipped ${item.type}: ${item.path} (already gone)`);
    }
  }
}

export async function runUninstall(opts: UninstallOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const dryRun = opts.dryRun ?? false;
  const force = opts.force ?? false;

  const yamlPath = path.join(cwd, '.ivy', 'project.yaml');
  const projectYaml = await readYaml<ProjectYaml>(yamlPath);

  if (!projectYaml && (!opts.platforms || opts.platforms.length === 0)) {
    logger.warn('No .ivy/project.yaml found and no --platforms specified. Nothing to uninstall.');
    return 0;
  }

  const platforms = resolveInstalledPlatforms(projectYaml, opts.platforms);
  if (platforms.length === 0) {
    logger.warn('No platforms to uninstall.');
    return 0;
  }

  const scope = projectYaml?.scope ?? 'project';
  const items = await gatherRemovals(cwd, platforms, scope);

  if (items.length === 0) {
    logger.info('No IvyFlow files found to remove.');
    return 0;
  }

  // Print what will be removed
  logger.step(`The following will be removed${dryRun ? ' (dry-run)' : ''}:`);
  for (const item of items) {
    logger.dim(`  ${item.type}: ${path.relative(cwd, item.path)}`);
  }

  // Dry-run: exit after printing
  if (dryRun) {
    await removeGitHookSection(cwd, true);
    logger.success(`Dry-run complete. ${items.length} item(s) would be removed.`);
    return 0;
  }

  // Confirm (unless --force)
  if (!force) {
    const { confirm } = await import('@inquirer/prompts');
    const answer = await confirm({ message: 'Proceed with uninstall?' });
    if (!answer) {
      logger.info('Uninstall cancelled.');
      return 0;
    }
  }

  // Execute removal
  await removeItems(items, false);
  await removeGitHookSection(cwd, false);

  logger.success(`Uninstall complete. ${items.length} item(s) removed.`);
  return 0;
}

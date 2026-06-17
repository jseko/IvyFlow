/**
 * Skill / Rule / Hook distribution — manifest-driven copy of `assets/skills/ivy/`,
 * `assets/rules/`, and `assets/hooks/` to the target platform's directories.
 *
 * v0.2:
 *   - Skills: byte-identical copy across all 7 platforms.
 *   - Rules: per-platform render via `core/render/` (md / mdc / copilot).
 *   - Hooks: claude-code (static), windsurf (rendered via render/hook-windsurf).
 */

import path from 'path';
import { fileURLToPath } from 'url';

import { fileExists, readJson, copyFile, ensureDir, readFile, writeFile } from '../utils/fs.js';
import { getPlatformSkillsDir, type Platform } from './platforms.js';
import type { InstallScope } from './types.js';
import { renderRule, renderHook } from './render/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ManifestHook {
  type: 'static' | 'rendered';
  asset?: string;
  installPath?: string;
  renderer?: string;
  installPathRelativeToSkillsDir?: string;
}

interface Manifest {
  version: string;
  schemaVersion?: number;
  skills: string[];
  rules?: string[];
  hooks?: Record<string, ManifestHook> | string[];
}

export function getAssetsDir(): string {
  return path.resolve(__dirname, '..', '..', 'assets');
}

async function readManifest(): Promise<Manifest> {
  const manifestPath = path.join(getAssetsDir(), 'manifest.json');
  if (!(await fileExists(manifestPath))) {
    throw new Error(`Manifest not found at ${manifestPath}`);
  }
  const manifest = await readJson<Manifest>(manifestPath);
  if (!manifest || !Array.isArray(manifest.skills)) {
    throw new Error(`Invalid manifest at ${manifestPath}: "skills" must be an array`);
  }
  return manifest;
}

export async function getManifestSkills(): Promise<string[]> {
  return (await readManifest()).skills;
}

export interface CopyResult {
  copied: number;
  skipped: number;
}

/**
 * Copy IvyFlow Skills listed in manifest.skills into
 * `<projectRoot>/<platform.skillsDir>/skills/<skillRelPath>`.
 */
export async function copyIvySkillsForPlatform(
  baseDir: string,
  platform: Platform,
  overwrite: boolean,
  scope: InstallScope = 'project',
): Promise<CopyResult> {
  const manifest = await readManifest();
  const assetsDir = getAssetsDir();
  let copied = 0;
  let skipped = 0;

  for (const skillRelPath of manifest.skills) {
    const src = path.join(assetsDir, 'skills', skillRelPath);
    const dest = path.join(baseDir, getPlatformSkillsDir(platform, scope), 'skills', skillRelPath);

    if (!(await fileExists(src))) {
      throw new Error(`Skill source not found: ${src}`);
    }
    if (!overwrite && (await fileExists(dest))) {
      skipped++;
      continue;
    }
    await copyFile(src, dest);
    copied++;
  }

  return { copied, skipped };
}

/** Resolve the destination path for the rendered rule on a given platform. */
function resolveRuleDest(
  baseDir: string,
  platform: Platform,
  scope: InstallScope,
  ruleRelPath: string,
): string {
  const skillsDir = getPlatformSkillsDir(platform, scope);
  // GitHub Copilot writes to <skillsDir>/copilot-instructions.md (no rulesDir).
  if (platform.rulesFormat === 'copilot') {
    return path.join(baseDir, skillsDir, 'copilot-instructions.md');
  }
  const baseName = path.basename(ruleRelPath, path.extname(ruleRelPath));
  const ext = platform.rulesFormat === 'mdc' ? '.mdc' : '.md';
  const rulesDir = platform.rulesDir ?? 'rules';
  return path.join(baseDir, skillsDir, rulesDir, baseName + ext);
}

/**
 * Render+copy rule files into the platform's rules directory.
 * Each platform applies its own format via `core/render/`.
 */
export async function copyIvyRulesForPlatform(
  baseDir: string,
  platform: Platform,
  overwrite: boolean,
  scope: InstallScope = 'project',
): Promise<CopyResult> {
  if (!platform.rulesFormat) {
    return { copied: 0, skipped: 0 };
  }
  const manifest = await readManifest();
  const rulePaths = manifest.rules ?? [];
  if (rulePaths.length === 0) {
    return { copied: 0, skipped: 0 };
  }

  const assetsDir = getAssetsDir();
  let copied = 0;
  let skipped = 0;

  for (const ruleRelPath of rulePaths) {
    const src = path.join(assetsDir, 'rules', ruleRelPath);
    if (!(await fileExists(src))) {
      throw new Error(`Rule source not found: ${src}`);
    }
    const dest = resolveRuleDest(baseDir, platform, scope, ruleRelPath);

    if (!overwrite && (await fileExists(dest))) {
      skipped++;
      continue;
    }
    const md = await readFile(src);
    const rendered = renderRule(platform.rulesFormat, md);
    await ensureDir(path.dirname(dest));
    await writeFile(dest, rendered);
    copied++;
  }

  return { copied, skipped };
}

export interface HookInstallResult {
  installed: boolean;
  path: string;
  reason?: string;
}

/**
 * Install platform-specific PreToolUse hook (currently Windsurf only).
 * No-op for platforms without `hookFormat: 'windsurf-json'`.
 */
export async function installIvyHookForPlatform(
  baseDir: string,
  platform: Platform,
  overwrite: boolean,
  scope: InstallScope = 'project',
): Promise<HookInstallResult> {
  if (platform.hookFormat !== 'windsurf-json' || !platform.hookPath) {
    return { installed: false, path: '', reason: 'platform-has-no-rendered-hook' };
  }
  const skillsDir = getPlatformSkillsDir(platform, scope);
  const dest = path.join(baseDir, skillsDir, platform.hookPath);

  if (!overwrite && (await fileExists(dest))) {
    return { installed: false, path: dest, reason: 'exists' };
  }
  const content = renderHook(platform.hookFormat);
  await ensureDir(path.dirname(dest));
  await writeFile(dest, content);
  return { installed: true, path: dest };
}

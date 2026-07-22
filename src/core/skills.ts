/**
 * Skill / Rule / Hook distribution — manifest-driven copy of `assets/skills/ivy/`,
 * `assets/roles/<role>/rules/`, and `assets/hooks/` to the target platform's directories.
 *
 * v0.2:
 *   - Skills: byte-identical copy across all 7 platforms.
 *   - Rules: per-platform render via `core/render/` (md / mdc / copilot).
 *   - Hooks: claude-code (static), windsurf (rendered via render/hook-windsurf).
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, readdirSync } from 'fs';

import { fileExists, readJson, copyFile, ensureDir, readFile, writeFile, chmod } from '../utils/fs.js';
import { getPlatformSkillsDir, type Platform, type HookFormat } from './platforms.js';
import type { InstallScope } from './types.js';
import type { PreToolUseGuardConfig } from './types.js';
import { renderRule, renderHook } from './render/index.js';
import { PreToolUseGuard, type PlatformHookAdapter } from './hook-runtime.js';
import { WindsurfHookAdapter } from './render/hook-windsurf.js';
import { CursorHookAdapter } from './render/hook-cursor.js';
import { GeminiHookAdapter } from './render/hook-gemini.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

declare global {
  var __ivyflow_assets: Record<string, string> | undefined;
}

function isEmbeddedMode(): boolean {
  return typeof globalThis.__ivyflow_assets !== 'undefined';
}

function getEmbeddedAsset(relativePath: string): string | undefined {
  return globalThis.__ivyflow_assets?.[relativePath];
}

function listEmbeddedAssets(prefix: string): string[] {
  const assets = globalThis.__ivyflow_assets;
  if (!assets) return [];
  return Object.keys(assets).filter(k => k.startsWith(prefix + '/'));
}

function readAssetFile(relativePath: string): string {
  if (isEmbeddedMode()) {
    const content = getEmbeddedAsset(relativePath);
    if (content === undefined) throw new Error(`Embedded asset not found: ${relativePath}`);
    return content;
  }
  return readFileSync(path.join(getAssetsDir(), relativePath), 'utf-8');
}

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
  if (isEmbeddedMode()) {
    const raw = getEmbeddedAsset('manifest.json');
    if (!raw) throw new Error('Manifest not found in embedded assets');
    const manifest = JSON.parse(raw) as Manifest;
    if (!manifest || !Array.isArray(manifest.skills)) {
      throw new Error('Invalid embedded manifest: "skills" must be an array');
    }
    return manifest;
  }

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
    const assetRelPath = skillRelPath.replace(/\\/g, '/');
    // Strip roles/developer/skills/ prefix for destination path
    const destRelPath = skillRelPath.replace(/^roles\/developer\/skills\//, '');
    const dest = path.join(baseDir, getPlatformSkillsDir(platform, scope), 'skills', destRelPath);

    if (isEmbeddedMode()) {
      const content = getEmbeddedAsset(assetRelPath);
      if (content === undefined) throw new Error(`Skill source not found: ${assetRelPath}`);
      if (!overwrite && (await fileExists(dest))) { skipped++; continue; }
      await writeFile(dest, content);
      copied++;
      continue;
    }

    const src = path.join(assetsDir, skillRelPath);
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
  // GitHub Copilot writes to <skillsDir>/copilot-instructions.md (no rulesDir).
  if (platform.rulesFormat === 'copilot') {
    const skillsDir = getPlatformSkillsDir(platform, scope);
    return path.join(baseDir, skillsDir, 'copilot-instructions.md');
  }
  const baseName = path.basename(ruleRelPath, path.extname(ruleRelPath));
  const ext = platform.rulesFormat === 'mdc' ? '.mdc' : '.md';
  const rulesDir = getPlatformRulesDir(platform, baseDir, scope);
  return path.join(rulesDir, baseName + ext);
}

/**
 * Get the platform's rules installation directory.
 * When `platform.rulesBaseDir` is set, uses that path; otherwise falls back to
 * `skillsDir` + `rulesDir` (pre-v0.8 behavior).
 */
export function getPlatformRulesDir(platform: Platform, cwd: string, scope: InstallScope = 'project'): string {
  if (platform.rulesBaseDir) {
    return path.join(cwd, platform.rulesBaseDir);
  }
  const skillsDir = getPlatformSkillsDir(platform, scope);
  const rulesDir = platform.rulesDir ?? 'rules';
  return path.join(cwd, skillsDir, rulesDir);
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
    const assetRelPath = `roles/developer/rules/${ruleRelPath}`.replace(/\\/g, '/');
    const dest = resolveRuleDest(baseDir, platform, scope, ruleRelPath);

    if (!overwrite && (await fileExists(dest))) {
      skipped++;
      continue;
    }

    let md: string;
    if (isEmbeddedMode()) {
      const content = getEmbeddedAsset(assetRelPath);
      if (content === undefined) throw new Error(`Rule source not found: ${assetRelPath}`);
      md = content;
    } else {
      const src = path.join(assetsDir, 'roles', 'developer', 'rules', ruleRelPath);
      if (!(await fileExists(src))) {
        throw new Error(`Rule source not found: ${src}`);
      }
      md = await readFile(src);
    }
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

/** Map HookFormat to its adapter class. Returns null for unsupported formats. */
function getHookAdapter(format: HookFormat): PlatformHookAdapter | null {
  if (format === 'windsurf-json') return new WindsurfHookAdapter();
  if (format === 'cursor-json') return new CursorHookAdapter();
  if (format === 'gemini') return new GeminiHookAdapter();
  return null;
}

/**
 * Install platform-specific PreToolUse hook.
 * v0.10: uses PlatformHookAdapter for Windsurf/Cursor/Gemini.
 * Falls back to renderHook() for Experimental platforms (qwen, kiro).
 */
export async function installIvyHookForPlatform(
  baseDir: string,
  platform: Platform,
  overwrite: boolean,
  scope: InstallScope = 'project',
): Promise<HookInstallResult> {
  if (!platform.hookFormat) {
    return { installed: false, path: '', reason: 'platform-has-no-hook-format' };
  }

  const adapter = getHookAdapter(platform.hookFormat);
  if (!adapter || !platform.hookPath) {
    return { installed: false, path: '', reason: 'platform-has-no-rendered-hook' };
  }

  const skillsDir = getPlatformSkillsDir(platform, scope);
  const dest = path.join(baseDir, skillsDir, platform.hookPath);

  if (!overwrite && (await fileExists(dest))) {
    return { installed: false, path: dest, reason: 'exists' };
  }

  const guardConfig: PreToolUseGuardConfig = {
    rules: [{ matcher: '**', allowedPhases: ['build', 'verify'] }],
    globalBlock: [],
  };
  const guard = new PreToolUseGuard(guardConfig, adapter);
  await guard.install(platform, baseDir);

  // For Cursor: also install the guard script that hooks.json references
  if (platform.hookFormat === 'cursor-json') {
    const scriptSrc = path.join(getAssetsDir(), 'hooks', 'ivy-cursor-guard.sh');
    if (await fileExists(scriptSrc)) {
      const scriptDestDir = path.join(baseDir, skillsDir, 'hooks');
      const scriptDest = path.join(scriptDestDir, 'ivy-phase-guard.sh');
      if (overwrite || !(await fileExists(scriptDest))) {
        await ensureDir(scriptDestDir);
        await copyFile(scriptSrc, scriptDest);
        await chmod(scriptDest, 0o755);
      }
    }
  }

  return { installed: true, path: dest };
}

/**
 * Copy IvyFlow Commands from role directory into the platform's commands directory.
 */
export async function copyIvyCommandsForPlatform(
  baseDir: string,
  platform: Platform,
  overwrite: boolean,
  scope: InstallScope = 'project',
  role: string = 'developer',
): Promise<CopyResult> {
  const skillsDir = getPlatformSkillsDir(platform, scope);
  const platformRoot = path.join(baseDir, skillsDir);
  const commandsDir = path.join(platformRoot, 'commands');
  await ensureDir(commandsDir);

  let copied = 0;
  let skipped = 0;

  // Install role-specific commands
  if (isEmbeddedMode()) {
    const roleCmdsPrefix = `roles/${role}/commands`;
    const cmdFiles = listEmbeddedAssets(roleCmdsPrefix);
    for (const cmdKey of cmdFiles) {
      const cmdName = path.basename(cmdKey);
      const dest = path.join(commandsDir, cmdName);
      if (!overwrite && (await fileExists(dest))) { skipped++; continue; }
      const content = readAssetFile(cmdKey);
      if (content !== undefined) {
        await writeFile(dest, content);
        copied++;
      }
    }

    // Common commands
    const commonPrefix = 'commands/common';
    const commonFiles = listEmbeddedAssets(commonPrefix);
    for (const cmdKey of commonFiles) {
      const cmdName = path.basename(cmdKey);
      const dest = path.join(commandsDir, cmdName);
      if (!overwrite && (await fileExists(dest))) continue;
      const content = readAssetFile(cmdKey);
      if (content !== undefined) {
        await writeFile(dest, content);
      }
    }
  } else {
    const roleCmdsDir = path.join(getAssetsDir(), 'roles', role, 'commands');
    try {
      const cmdFiles = readdirSync(roleCmdsDir);
      for (const cmdFile of cmdFiles) {
        const dest = path.join(commandsDir, cmdFile);
        if (!overwrite && (await fileExists(dest))) { skipped++; continue; }
        await copyFile(path.join(roleCmdsDir, cmdFile), dest);
        copied++;
      }
    } catch { /* role has no commands directory */ }

    const commonCmdsDir = path.join(getAssetsDir(), 'commands', 'common');
    try {
      const commonFiles = readdirSync(commonCmdsDir);
      for (const cmdFile of commonFiles) {
        const dest = path.join(commandsDir, cmdFile);
        if (!overwrite && (await fileExists(dest))) continue;
        await copyFile(path.join(commonCmdsDir, cmdFile), dest);
      }
    } catch { /* no common commands */ }
  }

  return { copied, skipped };
}

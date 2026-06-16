/**
 * Skill / Rule distribution — manifest-driven copy of `assets/skills/ivy/`,
 * `assets/rules/`, and (later) hook scripts to the target platform's
 * directories. v0.1 ships only the Claude Code platform with plain markdown
 * rules and no PreToolUse hooks.
 */

import path from 'path';
import { fileURLToPath } from 'url';

import { fileExists, readJson, copyFile, ensureDir, readFile, writeFile } from '../utils/fs.js';
import { getPlatformSkillsDir, type Platform } from './platforms.js';
import type { InstallScope } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Manifest {
  version: string;
  /** Skill files relative to `assets/skills/`, e.g. `ivy/SKILL.md`. */
  skills: string[];
  /** Rule files relative to `assets/rules/`, e.g. `ivy-phase-guard.md`. */
  rules?: string[];
  /** Hook scripts relative to `assets/hooks/`, e.g. `ivy-git-prepush.sh`. */
  hooks?: string[];
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

/**
 * Copy IvyFlow rule files (e.g., ivy-phase-guard.md) into
 * `<projectRoot>/<platform.skillsDir>/<platform.rulesDir>/<file>`.
 */
export async function copyIvyRulesForPlatform(
  baseDir: string,
  platform: Platform,
  overwrite: boolean,
  scope: InstallScope = 'project',
): Promise<CopyResult> {
  if (!platform.rulesDir || !platform.rulesFormat) {
    return { copied: 0, skipped: 0 };
  }
  const manifest = await readManifest();
  const rulePaths = manifest.rules ?? [];
  if (rulePaths.length === 0) {
    return { copied: 0, skipped: 0 };
  }

  const assetsDir = getAssetsDir();
  const rulesDestBase = path.join(
    baseDir,
    getPlatformSkillsDir(platform, scope),
    platform.rulesDir,
  );
  let copied = 0;
  let skipped = 0;

  for (const ruleRelPath of rulePaths) {
    const src = path.join(assetsDir, 'rules', ruleRelPath);
    if (!(await fileExists(src))) {
      throw new Error(`Rule source not found: ${src}`);
    }
    const dest = path.join(rulesDestBase, path.basename(ruleRelPath));

    if (!overwrite && (await fileExists(dest))) {
      skipped++;
      continue;
    }
    // v0.1 only emits 'md' format → straight copy without frontmatter rewrite.
    const content = await readFile(src);
    await ensureDir(path.dirname(dest));
    await writeFile(dest, content);
    copied++;
  }

  return { copied, skipped };
}

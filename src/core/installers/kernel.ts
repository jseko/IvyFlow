import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { ensureDir, copyFile, writeFile } from '../../utils/fs.js';
import type { InstallConfig } from '../install-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

declare global {
  var __ivyflow_assets: Record<string, string> | undefined;
}

function getAssetsDir(): string {
  if (process.env.IVYFLOW_ASSETS_DIR) {
    return process.env.IVYFLOW_ASSETS_DIR;
  }
  return path.resolve(__dirname, '..', '..', '..', 'assets');
}

function getEmbeddedAsset(relativePath: string): string | undefined {
  return globalThis.__ivyflow_assets?.[relativePath];
}

function listEmbeddedAssets(prefix: string): string[] {
  const assets = globalThis.__ivyflow_assets;
  if (!assets) return [];
  return Object.keys(assets).filter(k => k.startsWith(prefix + '/'));
}

export interface InstallResult {
  files: number;
  paths: string[];
}

export async function installKernel(config: InstallConfig): Promise<InstallResult> {
  const paths: string[] = [];

  const ivyDir = config.scope === 'global'
    ? path.join(path.dirname(config.cwd), '.ivy')
    : path.join(config.cwd, '.ivy');

  const kernelSkillsDir = path.join(ivyDir, 'skills', 'ivy');
  const kernelRulesDir = path.join(ivyDir, 'rules');
  const kernelHooksDir = path.join(ivyDir, 'hooks');

  if (globalThis.__ivyflow_assets) {
    await copyEmbeddedDir('roles/developer/skills/ivy', kernelSkillsDir, config.overwrite, paths);
    await copyEmbeddedDir('roles/developer/rules', kernelRulesDir, config.overwrite, paths);
    await copyEmbeddedDir('roles/developer/hooks', kernelHooksDir, config.overwrite, paths);
  } else {
    const assetsDir = getAssetsDir();
    await copyFsDir(path.join(assetsDir, 'roles', 'developer', 'skills', 'ivy'), kernelSkillsDir, config.overwrite, paths);
    await copyFsDir(path.join(assetsDir, 'roles', 'developer', 'rules'), kernelRulesDir, config.overwrite, paths);
    await copyFsDir(path.join(assetsDir, 'roles', 'developer', 'hooks'), kernelHooksDir, config.overwrite, paths);
  }

  return { files: paths.length, paths };
}

async function copyEmbeddedDir(prefix: string, destDir: string, overwrite: boolean, paths: string[]): Promise<void> {
  const files = listEmbeddedAssets(prefix);
  if (files.length === 0) return;

  await ensureDir(destDir);

  for (const fileKey of files) {
    const rel = fileKey.slice(prefix.length + 1);
    const destPath = path.join(destDir, rel);
    const dirPart = path.dirname(rel);
    if (dirPart !== '.') {
      await ensureDir(path.join(destDir, dirPart));
    }

    try {
      await fs.access(destPath);
      if (!overwrite) continue;
    } catch { /* doesn't exist */ }

    const content = getEmbeddedAsset(fileKey);
    if (content !== undefined) {
      await writeFile(destPath, content);
      paths.push(destPath);
    }
  }
}

async function copyFsDir(src: string, dest: string, overwrite: boolean, paths: string[]): Promise<void> {
  try {
    await fs.access(src);
  } catch {
    return;
  }

  await ensureDir(dest);
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyFsDir(srcPath, destPath, overwrite, paths);
    } else {
      try {
        await fs.access(destPath);
        if (!overwrite) continue;
      } catch { /* doesn't exist */ }

      await copyFile(srcPath, destPath);
      paths.push(destPath);
    }
  }
}

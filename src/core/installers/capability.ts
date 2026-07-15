import path from 'path';
import { ensureDir, fileExists, writeFile } from '../../utils/fs.js';
import type { CapabilityPack } from '../capability-registry.js';
import type { InstallConfig } from '../install-engine.js';

declare global {
  var __ivyflow_assets: Record<string, string> | undefined;
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

export async function installCapability(pack: CapabilityPack, config: InstallConfig): Promise<InstallResult> {
  const paths: string[] = [];

  const ivyDir = config.scope === 'global'
    ? path.join(path.dirname(config.cwd), '.ivy')
    : path.join(config.cwd, '.ivy');

  const capSkillsDir = path.join(ivyDir, 'capabilities', pack.manifest.name);
  const capRulesDir = path.join(ivyDir, 'capabilities', pack.manifest.name, 'rules');
  const capTemplatesDir = path.join(ivyDir, 'capabilities', pack.manifest.name, 'templates');

  await ensureDir(capSkillsDir);

  if (globalThis.__ivyflow_assets) {
    const skillKey = `capabilities/${pack.manifest.name}/SKILL.md`;
    const skillContent = getEmbeddedAsset(skillKey);
    if (skillContent !== undefined) {
      await writeFile(path.join(capSkillsDir, 'SKILL.md'), skillContent);
      paths.push(path.join(capSkillsDir, 'SKILL.md'));
    }

    const rulesPrefix = `capabilities/${pack.manifest.name}/rules`;
    const ruleFiles = listEmbeddedAssets(rulesPrefix);
    if (ruleFiles.length > 0) {
      await ensureDir(capRulesDir);
      for (const key of ruleFiles) {
        const content = getEmbeddedAsset(key);
        if (content !== undefined) {
          const name = key.slice(rulesPrefix.length + 1);
          const destPath = path.join(capRulesDir, name);
          await writeFile(destPath, content);
          paths.push(destPath);
        }
      }
    }

    const tmplPrefix = `capabilities/${pack.manifest.name}/templates`;
    const tmplFiles = listEmbeddedAssets(tmplPrefix);
    if (tmplFiles.length > 0) {
      await ensureDir(capTemplatesDir);
      for (const key of tmplFiles) {
        const content = getEmbeddedAsset(key);
        if (content !== undefined) {
          const name = key.slice(tmplPrefix.length + 1);
          const destPath = path.join(capTemplatesDir, name);
          await writeFile(destPath, content);
          paths.push(destPath);
        }
      }
    }
  } else {
    const { promises: fs } = await import('fs');
    const { copyFile } = await import('../../utils/fs.js');

    if (await fileExists(pack.skillPath)) {
      const destPath = path.join(capSkillsDir, 'SKILL.md');
      await copyFile(pack.skillPath, destPath);
      paths.push(destPath);
    }

    if (pack.rulesDir) {
      await ensureDir(capRulesDir);
      const entries = await fs.readdir(pack.rulesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const destPath = path.join(capRulesDir, entry.name);
          await copyFile(path.join(pack.rulesDir, entry.name), destPath);
          paths.push(destPath);
        }
      }
    }

    if (pack.templatesDir) {
      await ensureDir(capTemplatesDir);
      const entries = await fs.readdir(pack.templatesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const destPath = path.join(capTemplatesDir, entry.name);
          await copyFile(path.join(pack.templatesDir, entry.name), destPath);
          paths.push(destPath);
        }
      }
    }
  }

  return { files: paths.length, paths };
}

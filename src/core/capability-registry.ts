import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { parse } from 'yaml';
import { readYaml } from '../utils/yaml.js';

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

function listEmbeddedDirs(parentPath: string): string[] {
  const assets = globalThis.__ivyflow_assets;
  if (!assets) return [];
  const prefix = parentPath.replace(/\\/g, '/');
  const seen = new Set<string>();
  for (const key of Object.keys(assets)) {
    if (key.startsWith(prefix + '/')) {
      const rel = key.slice(prefix.length + 1);
      const topLevel = rel.split('/')[0];
      if (topLevel) seen.add(topLevel);
    }
  }
  return [...seen];
}

export interface CapabilityManifest {
  name: string;
  display_name: string;
  icon: string;
  description: string;
  benefit: string;
  risk_level: 'low' | 'medium' | 'high';
  network_permission: string;
  file_permission: string;
  size_kb: number;
  rating: number;
  recommended: boolean;
  dependencies: string[];
  conflicts: string[];
}

export interface CapabilityPack {
  manifest: CapabilityManifest;
  dirPath: string;
  skillPath: string;
  rulesDir?: string;
  templatesDir?: string;
}

const RISK_ORDER: Record<string, number> = { low: 0, medium: 1, high: 2 };

export class CapabilityRegistry {
  private packs: CapabilityPack[] = [];

  get capabilitiesDir(): string {
    if (process.env.IVYFLOW_CAPABILITIES_DIR) {
      return process.env.IVYFLOW_CAPABILITIES_DIR;
    }
    const assetsDir = (() => {
      if (process.env.IVYFLOW_ASSETS_DIR) return process.env.IVYFLOW_ASSETS_DIR;
      return path.resolve(__dirname, '..', '..', 'assets');
    })();
    return path.join(assetsDir, 'capabilities');
  }

  async load(): Promise<void> {
    this.packs = [];

    if (isEmbeddedMode()) {
      await this.loadEmbedded();
    } else {
      await this.loadFromDisk();
    }
  }

  private async loadEmbedded(): Promise<void> {
    const capDirs = listEmbeddedDirs('capabilities');
    for (const capName of capDirs) {
      const manifestPath = `capabilities/${capName}/manifest.yaml`;
      const raw = getEmbeddedAsset(manifestPath);
      if (!raw) continue;

      const manifest = parse(raw) as CapabilityManifest | null;
      if (!manifest || !manifest.name) continue;

      const skillPath = `capabilities/${capName}/SKILL.md`;
      const rulesDir = `capabilities/${capName}/rules`;
      const templatesDir = `capabilities/${capName}/templates`;

      const hasRules = getEmbeddedAsset(`${rulesDir}/placeholder`) !== undefined
        || listEmbeddedDirs(rulesDir).length > 0;
      const hasTemplates = getEmbeddedAsset(`${templatesDir}/placeholder`) !== undefined
        || listEmbeddedDirs(templatesDir).length > 0;

      this.packs.push({
        manifest: {
          ...manifest,
          dependencies: manifest.dependencies ?? [],
          conflicts: manifest.conflicts ?? [],
        },
        dirPath: capName,
        skillPath,
        rulesDir: hasRules ? rulesDir : undefined,
        templatesDir: hasTemplates ? templatesDir : undefined,
      });
    }
  }

  private async loadFromDisk(): Promise<void> {
    const baseDir = this.capabilitiesDir;

    let entries: string[];
    try {
      entries = await fs.readdir(baseDir);
    } catch {
      return;
    }

    for (const entryName of entries) {
      const dirPath = path.join(baseDir, entryName);
      let stat;
      try {
        stat = await fs.stat(dirPath);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;

      const manifestPath = path.join(dirPath, 'manifest.yaml');
      try {
        await fs.access(manifestPath);
      } catch {
        continue;
      }

      const manifest = await readYaml<CapabilityManifest>(manifestPath);
      if (!manifest || !manifest.name) continue;

      const skillPath = path.join(dirPath, 'SKILL.md');
      const rulesDir = path.join(dirPath, 'rules');
      const templatesDir = path.join(dirPath, 'templates');

      this.packs.push({
        manifest: {
          ...manifest,
          dependencies: manifest.dependencies ?? [],
          conflicts: manifest.conflicts ?? [],
        },
        dirPath,
        skillPath,
        rulesDir: await this.dirExists(rulesDir) ? rulesDir : undefined,
        templatesDir: await this.dirExists(templatesDir) ? templatesDir : undefined,
      });
    }
  }

  getAll(): CapabilityPack[] {
    return [...this.packs];
  }

  get(name: string): CapabilityPack | undefined {
    return this.packs.find((p) => p.manifest.name === name);
  }

  getRecommended(): CapabilityPack[] {
    return this.packs.filter((p) => p.manifest.recommended);
  }

  getByRiskLevel(maxRisk: 'low' | 'medium' | 'high'): CapabilityPack[] {
    const maxOrder = RISK_ORDER[maxRisk] ?? 2;
    return this.packs.filter((p) => (RISK_ORDER[p.manifest.risk_level] ?? 0) <= maxOrder);
  }

  resolveDependencies(selectedNames: string[]): CapabilityPack[] {
    const resolved: CapabilityPack[] = [];
    const visited = new Set<string>();

    const resolve = (name: string) => {
      if (visited.has(name)) return;
      visited.add(name);
      const pack = this.get(name);
      if (!pack) throw new Error(`Capability pack "${name}" not found`);
      for (const dep of pack.manifest.dependencies) {
        resolve(dep);
      }
      resolved.push(pack);
    };

    for (const name of selectedNames) {
      resolve(name);
    }

    return resolved;
  }

  validateSelection(selectedNames: string[]): string[] {
    const errors: string[] = [];
    for (const name of selectedNames) {
      const pack = this.get(name);
      if (!pack) {
        errors.push(`Capability pack "${name}" not found`);
        continue;
      }
      for (const conflict of pack.manifest.conflicts) {
        if (selectedNames.includes(conflict)) {
          errors.push(`"${name}" conflicts with "${conflict}"`);
        }
      }
      for (const dep of pack.manifest.dependencies) {
        if (!this.get(dep)) {
          errors.push(`"${name}" depends on "${dep}" which is not available`);
        }
      }
    }
    return errors;
  }

  private async dirExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }
}

export const defaultCapabilityRegistry = new CapabilityRegistry();

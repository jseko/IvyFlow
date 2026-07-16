import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { parse } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

declare global {
  var __ivyflow_assets: Record<string, string> | undefined;
}

export interface CapabilityMapping {
  id: string;
  implementation: string;
}

export interface PipelineDownstream {
  role: string;
  stage: string;
  condition?: string;
}

export interface RoleConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  version: number;
  default_workflow: string;
  default_topology: 'serial' | 'parallel' | 'supervisor' | 'debate';
  capabilities: CapabilityMapping[];
  commands: string[];
  pipeline_downstream?: PipelineDownstream[];
}

function isEmbeddedMode(): boolean {
  return typeof globalThis.__ivyflow_assets !== 'undefined';
}

function getEmbeddedAsset(relativePath: string): string | undefined {
  return globalThis.__ivyflow_assets?.[relativePath];
}

function getAssetsDir(): string {
  if (process.env.IVYFLOW_ASSETS_DIR) {
    return process.env.IVYFLOW_ASSETS_DIR;
  }
  return path.resolve(__dirname, '..', '..', 'assets');
}

export class RoleRegistry {
  private roles: Map<string, RoleConfig> = new Map();

  async load(): Promise<void> {
    this.roles.clear();

    if (isEmbeddedMode()) {
      await this.loadEmbedded();
    } else {
      await this.loadFromDisk();
    }
  }

  private async loadEmbedded(): Promise<void> {
    const prefix = 'roles/';
    const assets = globalThis.__ivyflow_assets!;
    const seen = new Set<string>();

    for (const key of Object.keys(assets)) {
      if (!key.startsWith(prefix)) continue;
      const rel = key.slice(prefix.length);
      const topLevel = rel.split('/')[0];
      if (topLevel) seen.add(topLevel);
    }

    for (const roleId of seen) {
      const yamlKey = `${prefix}${roleId}/role.yaml`;
      const raw = assets[yamlKey];
      if (!raw) continue;

      try {
        const config = parse(raw) as RoleConfig;
        if (config && config.id) {
          config.capabilities = config.capabilities ?? [];
          config.commands = config.commands ?? [];
          this.roles.set(config.id, config);
        }
      } catch { /* skip invalid */ }
    }
  }

  private async loadFromDisk(): Promise<void> {
    const rolesDir = path.join(getAssetsDir(), 'roles');

    let entries: string[];
    try {
      entries = await fs.readdir(rolesDir);
    } catch {
      return;
    }

    for (const entryName of entries) {
      const dirPath = path.join(rolesDir, entryName);
      let stat;
      try {
        stat = await fs.stat(dirPath);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;

      const yamlPath = path.join(dirPath, 'role.yaml');
      try {
        await fs.access(yamlPath);
      } catch {
        continue;
      }

      try {
        const raw = await fs.readFile(yamlPath, 'utf-8');
        const config = parse(raw) as RoleConfig;
        if (config && config.id) {
          config.capabilities = config.capabilities ?? [];
          config.commands = config.commands ?? [];
          this.roles.set(config.id, config);
        }
      } catch { /* skip invalid */ }
    }
  }

  get(id: string): RoleConfig | undefined {
    return this.roles.get(id);
  }

  getAll(): RoleConfig[] {
    return [...this.roles.values()];
  }

  getDefault(): RoleConfig {
    return this.roles.get('developer')!;
  }

  resolveImplementation(roleId: string, capabilityId: string): string | undefined {
    const role = this.roles.get(roleId);
    return role?.capabilities.find(c => c.id === capabilityId)?.implementation;
  }
}

export const defaultRoleRegistry = new RoleRegistry();

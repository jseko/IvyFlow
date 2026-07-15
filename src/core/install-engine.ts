import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { writeYaml, readYaml } from '../utils/yaml.js';
import { createRequire } from 'module';

import { detectPlatforms, type PlatformDetectResult } from './detect.js';
import { PLATFORMS, type Platform } from './platforms.js';
import type { InstallScope } from './types.js';
import type { CapabilityPack } from './capability-registry.js';

const require = createRequire(import.meta.url);
const { version: PKG_VERSION } = require('../../package.json');

export interface InstallPhase {
  name: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  fileCount?: number;
  totalFiles?: number;
  durationMs?: number;
  error?: string;
}

export interface InstallConfig {
  scope: InstallScope;
  language: string;
  projectType: string;
  cwd: string;
  overwrite: boolean;
  skipOpenSpec: boolean;
  platforms: Platform[];
  capabilities: CapabilityPack[];
}

export interface InstallReport {
  phases: InstallPhase[];
  failedPlatforms: string[];
  failedCapabilities: string[];
  totalDurationMs: number;
  success: boolean;
}

export type InstallPhaseType = 'kernel' | 'capability' | 'platform' | 'config';

export interface InstallProgressEvent {
  type: 'phase:start' | 'phase:end' | 'progress';
  phase: InstallPhaseType;
  phaseLabel: string;
  current?: number;
  total?: number;
  message?: string;
}

export class InstallEngine extends EventEmitter {
  private phases: InstallPhase[] = [];
  private startTime = 0;

  async run(config: InstallConfig): Promise<InstallReport> {
    this.startTime = Date.now();
    this.phases = [];
    const failedPlatforms: string[] = [];
    const failedCapabilities: string[] = [];

    try {
      await this.checkDiskSpace(config);
    } catch (err) {
      return this.failReport(failedPlatforms, failedCapabilities, (err as Error).message);
    }

    await this.installKernel(config);
    await this.installCapabilities(config, failedCapabilities);
    await this.installPlatforms(config, failedPlatforms);
    await this.writeConfig(config);

    return {
      phases: this.phases,
      failedPlatforms,
      failedCapabilities,
      totalDurationMs: Date.now() - this.startTime,
      success: failedPlatforms.length === 0 && failedCapabilities.length === 0,
    };
  }

  private emitProgress(phase: InstallPhaseType, label: string, current?: number, total?: number, message?: string): void {
    const event: InstallProgressEvent = { type: 'progress', phase, phaseLabel: label, current, total, message };
    this.emit('progress', event);
  }

  private emitPhaseStart(phase: InstallPhaseType, label: string): void {
    this.emit('progress', { type: 'phase:start', phase, phaseLabel: label });
  }

  private emitPhaseEnd(phase: InstallPhaseType, label: string): void {
    this.emit('progress', { type: 'phase:end', phase, phaseLabel: label });
  }

  private async checkDiskSpace(config: InstallConfig): Promise<void> {
    const totalKb = config.capabilities.reduce((sum, c) => sum + c.manifest.size_kb, 0);
    const requiredBytes = totalKb * 1024 * 2;

    try {
      const stat = await fs.statfs(config.cwd);
      const available = stat.bsize * stat.bavail;
      if (available < requiredBytes) {
        throw new Error(`磁盘空间不足：需要 ${Math.ceil(requiredBytes / 1024 / 1024)}MB，可用 ${Math.floor(available / 1024 / 1024)}MB`);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`工作目录不存在：${config.cwd}`);
      }
      throw err;
    }
  }

  private async installKernel(config: InstallConfig): Promise<void> {
    const label = '安装内核';
    this.emitPhaseStart('kernel', label);
    const phase: InstallPhase = { name: label, status: 'running' };
    const t0 = Date.now();

    try {
      const { installKernel } = await import('./installers/kernel.js');
      const result = await installKernel(config);
      phase.fileCount = result.files;
      phase.totalFiles = result.files;
      phase.durationMs = Date.now() - t0;
      phase.status = 'done';
    } catch (err) {
      phase.status = 'failed';
      phase.error = (err as Error).message;
    }

    this.phases.push(phase);
    this.emitPhaseEnd('kernel', label);
  }

  private async installCapabilities(config: InstallConfig, failed: string[]): Promise<void> {
    if (config.capabilities.length === 0) return;

    const label = '安装能力包';
    this.emitPhaseStart('capability', label);

    const { installCapability } = await import('./installers/capability.js');
    const results = await Promise.allSettled(
      config.capabilities.map(async (pack, i) => {
        this.emitProgress('capability', pack.manifest.display_name, i + 1, config.capabilities.length);
        return installCapability(pack, config);
      }),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const pack = config.capabilities[i];
      const phase: InstallPhase = {
        name: `${pack.manifest.icon} ${pack.manifest.display_name}`,
        status: result.status === 'fulfilled' ? 'done' : 'failed',
      };
      if (result.status === 'fulfilled') {
        phase.fileCount = result.value.files;
        phase.totalFiles = result.value.files;
      } else {
        phase.error = (result.reason as Error)?.message ?? String(result.reason);
        failed.push(pack.manifest.name);
      }
      this.phases.push(phase);
    }

    this.emitPhaseEnd('capability', label);
  }

  private async installPlatforms(config: InstallConfig, failed: string[]): Promise<void> {
    if (config.platforms.length === 0) return;

    const label = '安装到平台';
    this.emitPhaseStart('platform', label);

    const { installForOnePlatform } = await import('./installers/platform.js');
    const results = await Promise.allSettled(
      config.platforms.map(async (p) => {
        this.emitProgress('platform', p.name);
        return installForOnePlatform(config.cwd, p, config.overwrite, config.scope, config.capabilities);
      }),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const platform = config.platforms[i];
      const phase: InstallPhase = {
        name: platform.name,
        status: 'done',
      };
      if (result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.ok)) {
        phase.status = 'failed';
        phase.error = result.status === 'rejected'
          ? (result.reason as Error)?.message ?? String(result.reason)
          : result.value.error;
        failed.push(platform.id);
      }
      this.phases.push(phase);
    }

    this.emitPhaseEnd('platform', label);
  }

  private async writeConfig(config: InstallConfig): Promise<void> {
    const label = '写入配置';
    this.emitPhaseStart('config', label);
    const t0 = Date.now();

    const ivyDir = config.scope === 'global'
      ? path.join(os.homedir(), '.ivy')
      : path.join(config.cwd, '.ivy');

    await fs.mkdir(ivyDir, { recursive: true });
    const projectYamlPath = path.join(ivyDir, 'project.yaml');

    const existing = await readYaml(projectYamlPath) ?? {};

    const capabilitiesConfig: Record<string, unknown> = {};
    for (const pack of config.capabilities) {
      capabilitiesConfig[pack.manifest.name] = {
        enabled: true,
        ...this.getCapabilityDefaults(pack.manifest.name),
      };
    }

    const detected = await detectPlatforms(config.cwd);

    const newConfig = {
      ...existing,
      version: PKG_VERSION,
      platforms: config.platforms.map((p) => p.id),
      scope: config.scope,
      language: config.language,
      project_type: config.projectType,
      capabilities: capabilitiesConfig,
      security: {
        risk_level: 'low',
        external_connections: 0,
        file_permissions: ['read_project', 'write_config'],
      },
      install: {
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - this.startTime,
        version: PKG_VERSION,
      },
      initialized_at: existing.initialized_at ?? new Date().toISOString(),
      spec_adapter: existing.spec_adapter ?? 'openspec',
      analytics_enabled: existing.analytics_enabled ?? false,
      detected_platforms: detected
        .filter((r) => r.detected)
        .map((r) => ({ id: r.platform.id, confidence: r.confidence, matched: r.matchedPath })),
    };

    await writeYaml(projectYamlPath, newConfig as Record<string, unknown>);

    // Write language preference to CLAUDE.md for AI agent guidance
    await this.writeLanguageConfig(config);

    this.phases.push({
      name: label,
      status: 'done',
      durationMs: Date.now() - t0,
      fileCount: 1,
      totalFiles: 1,
    });

    this.emitPhaseEnd('config', label);
  }

  private getCapabilityDefaults(name: string): Record<string, unknown> {
    switch (name) {
      case 'code-intelligence':
        return { provider: 'gitnexus', index_freshness: 'fresh' };
      case 'testing':
        return { framework: null, tdd_mode: 'strict' };
      case 'deployment':
        return { ci_provider: null };
      case 'documentation':
        return { formats: ['api-doc', 'changelog'] };
      default:
        return {};
    }
  }

  private async writeLanguageConfig(config: InstallConfig): Promise<void> {
    const langLine = config.language === 'zh-CN'
      ? '请始终使用中文回复。'
      : 'Please always respond in English.';

    for (const platform of config.platforms) {
      const fileName = this.getAgentInstructionsFile(platform.id);
      if (!fileName) continue;

      const filePath = path.join(config.cwd, fileName);
      try {
        let content = '';
        try {
          content = await fs.readFile(filePath, 'utf-8');
        } catch {
          // file doesn't exist yet
        }

        if (!content.includes('请始终使用中文回复') && !content.includes('Please always respond in English')) {
          const marker = '<!-- ivyflow-language -->';
          content = content.trimEnd() + `\n\n${marker}\n${langLine}\n`;
          await fs.writeFile(filePath, content);
        }
      } catch {
        // best-effort, non-fatal
      }
    }
  }

  private getAgentInstructionsFile(platformId: string): string | null {
    switch (platformId) {
      case 'claude': return 'CLAUDE.md';
      case 'cursor': return '.cursorrules';
      case 'github-copilot': return '.github/copilot-instructions.md';
      case 'windsurf': return '.windsurfrules';
      case 'codebuddy': return 'CODEBUDDY.md';
      case 'gemini-cli': return 'GEMINI.md';
      case 'opencode': return 'AGENTS.md';
      default: return null;
    }
  }

  private failReport(failedPlatforms: string[], failedCapabilities: string[], error: string): InstallReport {
    logger.error(error);
    return {
      phases: [{ name: '安装失败', status: 'failed', error }],
      failedPlatforms,
      failedCapabilities,
      totalDurationMs: 0,
      success: false,
    };
  }
}

export const defaultInstallEngine = new InstallEngine();

/**
 * `ivy init` — 6-step interactive wizard with modular capability packs.
 *
 * v0.15: redesigned from monolithic 339-line command into a layered architecture:
 *   InitWizard (UX) → InstallEngine (orchestration) → Installers (execution)
 */

import os from 'os';
import { createRequire } from 'module';
import { confirm, select, checkbox } from '@inquirer/prompts';

import { detectPlatforms, type PlatformDetectResult } from '../core/detect.js';
import { PLATFORMS, type Platform } from '../core/platforms.js';
import type { InstallScope, ProjectFingerprint } from '../core/types.js';
import { logger } from '../utils/logger.js';
import { defaultCapabilityRegistry, type CapabilityPack } from '../core/capability-registry.js';
import { defaultInstallEngine, type InstallConfig } from '../core/install-engine.js';
import { annotateChoice, selectPlatformsQuick, selectAllDetected } from '../core/installers/platform.js';
import { setupOpenSpec, setupGitHooks } from '../core/installers/platform.js';

const require = createRequire(import.meta.url);
const { version: PKG_VERSION } = require('../../package.json');

export type InitMode = 'quick' | 'standard' | 'enterprise';

export interface InitOptions {
  mode?: InitMode;
  cwd?: string;
  skipOpenSpec?: boolean;
  overwrite?: boolean;
  platforms?: string[];
  yes?: boolean;
  all?: boolean;
}

// ─── Step 1: Welcome + Scope ───

function showWelcome(detectedHits: PlatformDetectResult[]): void {
  const platformNames = detectedHits.map((r) => r.platform.name).join(', ');

  console.log('');
  console.log('   ╔══════════════════════════════════════════════╗');
  console.log(`   ║     🍃  IvyFlow  v${PKG_VERSION.padEnd(27)}║`);
  console.log('   ║     AI-Native Development Workflow             ║');
  console.log('   ╚══════════════════════════════════════════════╝');
  console.log('');

  if (detectedHits.length > 0) {
    console.log(`   检测到 ${detectedHits.length} 个 AI 编程平台：${platformNames}`);
  } else {
    console.log('   未检测到 AI 编程平台，将默认使用 Claude Code');
  }
  console.log('');
}

async function stepScope(): Promise<InstallScope> {
  return select<InstallScope>({
    message: '安装范围：',
    choices: [
      { name: '当前项目（推荐）', value: 'project' },
      { name: '全局配置', value: 'global' },
    ],
    default: 'project',
  });
}

// ─── Step 2: Language + Project Type ───

function detectLocale(): string {
  const lang = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || '';
  if (lang.startsWith('zh')) return 'zh-CN';
  if (lang.startsWith('en')) return 'en';
  // Default to Chinese for broader user base
  return 'zh-CN';
}

async function stepLanguage(): Promise<string> {
  const detected = detectLocale();
  return select<string>({
    message: '工作语言 / Language：',
    choices: [
      { name: `中文${detected === 'zh-CN' ? '（默认）' : ''}`, value: 'zh-CN' },
      { name: `English${detected === 'en' ? ' (default)' : ''}`, value: 'en' },
    ],
    default: detected,
  });
}

// ─── Step 2: Language + Tech Stack ───

function describeFingerprint(fp: ProjectFingerprint): string {
  const parts: string[] = [];
  if (fp.language?.value.length) parts.push(fp.language.value.join('/'));
  if (fp.frontend?.value.length) parts.push(`前端:${fp.frontend.value.join('+')}`);
  if (fp.backend?.value.length) parts.push(`后端:${fp.backend.value.join('+')}`);
  if (fp.buildTool?.value.length) parts.push(fp.buildTool.value.join('/'));
  if (fp.testFramework?.value.length) parts.push(`测试:${fp.testFramework.value.join('/')}`);
  return parts.join('  ');
}

async function stepTechStack(cwd: string): Promise<{ language: string; fingerprint: ProjectFingerprint | null }> {
  const language = await stepLanguage();

  let fingerprint: ProjectFingerprint | null = null;
  try {
    const { detectFingerprint } = await import('./fingerprint.js');
    fingerprint = await detectFingerprint(cwd);
  } catch {
    // detection failed, continue
  }

  if (fingerprint && fingerprint.projectType.value !== 'unknown') {
    const desc = describeFingerprint(fingerprint);
    logger.info('');
    logger.info(`  🔍 检测到技术栈：${desc || '未识别'}`);
    logger.info('');
  }

  return { language, fingerprint };
}

// ─── Step 3: CodeGraph ───

function startSpinner(): { update: (line: string) => void; stop: () => void } {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  let currentLine = '';
  const timer = setInterval(() => {
    if (currentLine) {
      process.stdout.write(`\r\x1b[K${frames[i % frames.length]} ${currentLine}`);
      i++;
    }
  }, 80);

  const update = (line: string) => {
    currentLine = line;
    process.stdout.write(`\r\x1b[K${frames[i % frames.length]} ${line}`);
    i++;
  };

  const stop = () => {
    clearInterval(timer);
    if (currentLine) {
      process.stdout.write(`\r\x1b[K✓ ${currentLine}\n`);
      currentLine = '';
    }
  };

  return { update, stop };
}

async function stepInstall(config: InstallConfig): Promise<number> {
  const spinner = startSpinner();

  const engine = defaultInstallEngine;

  engine.on('progress', (event) => {
    if (event.type === 'phase:start') {
      spinner.update(`${event.phaseLabel}...`);
    } else if (event.type === 'phase:end') {
      spinner.stop();
      logger.success(`${event.phaseLabel}`);
    }
  });

  spinner.update('开始安装...');

  const report = await engine.run(config);
  spinner.stop();

  if (!report.success) {
    if (report.failedCapabilities.length > 0) {
      logger.warn(`能力包安装失败：${report.failedCapabilities.join(', ')}`);
    }
    if (report.failedPlatforms.length > 0) {
      logger.warn(`平台安装失败：${report.failedPlatforms.join(', ')}`);
    }
  }

  if (config.scope === 'project' && !config.skipOpenSpec) {
    const ok = await setupOpenSpec(config.cwd, config.platforms, config.scope);
    if (!ok) return 1;
  }

  if (config.scope === 'project') {
    await setupGitHooks(config.cwd, config.overwrite);
  }

  return 0;
}

// ─── Step 6: Completion Guide ───

function showCompletion(config: InstallConfig): void {
  const capList = config.capabilities.map((p) => `${p.manifest.icon} ${p.manifest.display_name}`).join('  ');
  const platNames = config.platforms.map((p) => p.name).join(', ');

  console.log('');
  console.log('   ╔══════════════════════════════════════════════╗');
  console.log('   ║  🎉  IvyFlow 已就绪！                        ║');
  console.log('   ║                                              ║');
  console.log('   ║  快速开始：                                  ║');
  console.log('   ║    /ivyflow "实现用户登录"   启动完整工作流   ║');
  console.log('   ║    /ivyflow-quick "修复报错"  快速修改        ║');
  console.log('   ║    /ivyflow-status            查看任务状态    ║');
  console.log('   ║                                              ║');
  console.log('   ║  工作目录：docs/ivyflow/specs/               ║');
  console.log('   ║           docs/ivyflow/plans/                ║');
  console.log('   ║                                              ║');
  if (capList) {
    console.log(`   ║  已安装能力：🍃 内核  ${capList}`);
  }
  if (platNames) {
    console.log(`   ║  已适配平台：${platNames}`);
  }
  console.log('   ╚══════════════════════════════════════════════╝');
  console.log('');
  console.log('   💡 提示：重启 AI 工具后斜杠命令即可生效');
  console.log('');
}

// ─── Step 3.5: CodeGraph ───

async function stepCodegraph(): Promise<boolean> {
  return confirm({
    message: '安装 CodeGraph 语义代码智能？（推荐 — 节省 ~16% 成本 · 减少 ~58% 工具调用）',
    default: true,
  });
}

async function shouldInstallCodegraph(): Promise<boolean> {
  try {
    const { execSync } = await import('child_process');
    execSync('which codegraph', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function runCodegraphInstall(cwd: string): Promise<void> {
  const { execSync } = await import('child_process');
  try {
    logger.step('安装 CodeGraph...');
    execSync('codegraph install --yes', { cwd, stdio: 'inherit' });
    execSync('codegraph init -i', { cwd, stdio: 'inherit' });
    logger.success('CodeGraph 安装完成');
  } catch {
    logger.warn('CodeGraph 安装失败（可能未安装 codegraph CLI），跳过。可稍后手动安装：npm i -g @codegraph/cli && codegraph init -i');
  }
}

// ─── Step 3.6: Superpowers ───

async function stepSuperpowers(): Promise<boolean> {
  return confirm({
    message: '安装 Superpowers 方法论工具集？（推荐 — brainstorming / writing-plans / TDD 等）',
    default: true,
  });
}

async function runSuperpowersInstall(cwd: string): Promise<void> {
  const { execSync } = await import('child_process');
  try {
    logger.step('安装 Superpowers (brainstorming)...');
    execSync('skills add obra/superpowers --skill brainstorming -y', { cwd, stdio: 'inherit' });
    logger.success('Superpowers brainstorming 安装完成');
  } catch {
    logger.warn('Superpowers 安装失败（可能未安装 skills CLI），跳过。可稍后手动安装：npm i -g skills && skills add obra/superpowers');
  }
}

async function shouldInstallSuperpowers(): Promise<boolean> {
  try {
    const { execSync } = await import('child_process');
    execSync('which skills', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function stepOpenspec(): Promise<boolean> {
  return confirm({
    message: '安装 OpenSpec 规范驱动开发工具？（推荐 — 用于变更提案和归档）',
    default: true,
  });
}

// ─── Main Entry ───

export async function runInit(opts: InitOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const isTTY = process.stdout.isTTY && process.stdin.isTTY;

  const detected = await detectPlatforms(cwd);
  const detectedHits = detected.filter((r) => r.detected);

  await defaultCapabilityRegistry.load();

  // Non-interactive modes
  if (opts.all || opts.yes || opts.mode === 'quick' || !isTTY) {
    return runNonInteractive(opts, cwd, detected, detectedHits);
  }

  // Interactive wizard
  return runWizard(opts, cwd, detected, detectedHits);
}

async function runWizard(
  opts: InitOptions,
  cwd: string,
  detected: PlatformDetectResult[],
  detectedHits: PlatformDetectResult[],
): Promise<number> {
  // Step 1: Welcome + Scope
  showWelcome(detectedHits);
  const scope = await stepScope();

  // Step 2: Language + Tech Stack Detection
  const { language } = await stepTechStack(cwd);

  // Step 3: Capabilities (install all by default)
  const selectedCaps = defaultCapabilityRegistry.getAll();

  // Step 3: CodeGraph (optional)
  const installCodegraph = await stepCodegraph();

  // Step 3.5: OpenSpec (optional)
  const skipOpenSpec = opts.skipOpenSpec ?? !(await stepOpenspec());

  // Step 3.6: Superpowers (optional)
  const installSuperpowers = await stepSuperpowers();

  // Platform selection
  const platforms = opts.platforms
    ? PLATFORMS.filter((p) => opts.platforms!.includes(p.id))
    : await selectPlatformsInteractive(detected);

  if (platforms.length === 0) {
    logger.error('未选择任何平台，安装中止。');
    return 1;
  }

  const config: InstallConfig = {
    scope,
    language,
    projectType: 'auto',
    cwd,
    overwrite: opts.overwrite ?? false,
    skipOpenSpec,
    platforms,
    capabilities: selectedCaps,
  };

  // Step 5: Install
  const result = await stepInstall(config);

  // Step 5.5: CodeGraph install (after main install)
  if (installCodegraph) {
    await runCodegraphInstall(cwd);
  }

  // Step 5.6: Superpowers install
  if (installSuperpowers) {
    await runSuperpowersInstall(cwd);
  }

  // Step 6: Completion
  if (result === 0) {
    showCompletion(config);
  }

  return result;
}

async function runNonInteractive(
  opts: InitOptions,
  cwd: string,
  detected: PlatformDetectResult[],
  detectedHits: PlatformDetectResult[],
): Promise<number> {
  const isAll = opts.all === true;
  const scope: InstallScope = 'project';
  const language = detectLocale();

  await defaultCapabilityRegistry.load();

  const selectedCaps = isAll
    ? defaultCapabilityRegistry.getAll()
    : defaultCapabilityRegistry.getRecommended();

  const platforms = opts.platforms
    ? PLATFORMS.filter((p) => opts.platforms!.includes(p.id))
    : isAll
      ? await selectAllDetected(detected)
      : await selectPlatformsQuick(detected);

  if (platforms.length === 0) {
    logger.error('No platforms selected; aborting.');
    return 1;
  }

  const config: InstallConfig = {
    scope,
    language,
    projectType: 'auto',
    cwd,
    overwrite: opts.overwrite ?? false,
    skipOpenSpec: false,
    platforms,
    capabilities: selectedCaps,
  };

  const result = await stepInstall(config);

  // Auto-install CodeGraph in non-interactive mode
  if (await shouldInstallCodegraph()) {
    await runCodegraphInstall(cwd);
  }

  // Auto-install Superpowers in non-interactive mode
  if (await shouldInstallSuperpowers()) {
    await runSuperpowersInstall(cwd);
  }

  if (result === 0) {
    showCompletion(config);
  }

  return result;
}

async function selectPlatformsInteractive(detected: PlatformDetectResult[]): Promise<Platform[]> {
  const choices = detected.map(annotateChoice);
  const picked = (await checkbox({
    message: '选择要安装到的平台',
    choices,
    required: true,
  })) as string[];
  return PLATFORMS.filter((p) => picked.includes(p.id));
}

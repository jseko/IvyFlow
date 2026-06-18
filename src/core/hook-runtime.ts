/**
 * PreToolUse TypeScript runtime guard — unified Hook lifecycle management.
 *
 * v0.10 productionization: replaces shell-script + JSON hook config with a
 * typed runtime that evaluates tool calls against phase-aware rules and
 * delegates platform-specific rendering to HookAdapters.
 *
 * §9.1 compliance: PlatformHookAdapter is NOT a Renderer interface — it's
 * a platform-specific config adapter with no dispatch table or IR.
 */

import path from 'path';
import { promises as fs } from 'fs';
import { mkdirSync } from 'fs';
import { fileExists, readFile } from '../utils/fs.js';
import type { Platform } from './platforms.js';
import type { PreToolUseContext, HookDecision, PreToolUseGuardConfig } from './types.js';

// ─── PlatformHookAdapter Interface ───

export interface PlatformHookAdapter {
  format: 'windsurf-json' | 'gemini-json' | 'cursor-json' | 'claude-static';
  render(config: PreToolUseGuardConfig): string;
  installPath(platform: Platform, projectPath: string): string;
}

// ─── PreToolUse Guard ───

export class PreToolUseGuard {
  private config: PreToolUseGuardConfig;
  private adapter: PlatformHookAdapter;

  constructor(config: PreToolUseGuardConfig, adapter: PlatformHookAdapter) {
    this.config = config;
    this.adapter = adapter;
  }

  /** Evaluate a tool invocation against the guard rules. */
  evaluate(ctx: PreToolUseContext): HookDecision {
    // 1. Check global block patterns
    if (this.config.globalBlock) {
      for (const pattern of this.config.globalBlock) {
        if (matchGlob(ctx.toolName, pattern)) {
          return { decision: 'block', reason: `Tool "${ctx.toolName}" is globally blocked by pattern: ${pattern}` };
        }
      }
    }

    // 2. Check phase-specific rules
    for (const rule of this.config.rules) {
      if (matchGlob(ctx.filePath, rule.matcher)) {
        if (!rule.allowedPhases.includes(ctx.currentPhase)) {
          return {
            decision: 'block',
            reason: rule.blockMessage ?? `Phase "${ctx.currentPhase}" does not allow modifying ${rule.matcher}`,
          };
        }
      }
    }

    // 3. Archive phase special handling
    if (ctx.currentPhase === 'archive' && ['Write', 'Edit'].includes(ctx.toolName)) {
      return { decision: 'block', reason: 'Archive phase: no file modifications allowed' };
    }

    return { decision: 'allow' };
  }

  /** Render and install hook config for the given platform. */
  async install(platform: Platform, projectPath: string): Promise<string> {
    const rendered = this.adapter.render(this.config);
    const targetPath = this.adapter.installPath(platform, projectPath);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, rendered, 'utf-8');
    return targetPath;
  }
}

// ─── Match Helpers ───

/**
 * Simple glob matching: supports `*` (any non-separator chars) and `**`
 * (any chars including separators). Used for tool name and file path matching.
 */
function matchGlob(text: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern === '**') return true;

  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '___DOUBLESTAR___')
    .replace(/\*/g, '[^/]*')
    .replace(/___DOUBLESTAR___/g, '.*');

  return new RegExp(`^${regexStr}$`).test(text);
}

// ─── Default Config ───

export function createDefaultGuardConfig(): PreToolUseGuardConfig {
  return {
    rules: [
      { matcher: '**', allowedPhases: ['build', 'verify'], blockMessage: 'Code edits only allowed in BUILD and VERIFY phases' },
    ],
    globalBlock: [],
  };
}

// ─── Legacy Config Compatibility ───

interface LegacyHookConfig {
  name?: string;
  event?: string;
  command?: string;
  blockOnNonZeroExit?: boolean;
  match?: { tools?: string[] };
  version?: number;
  hooks?: {
    preToolUse?: Array<{
      command: string;
      matcher?: string;
    }>;
  };
}

/**
 * Detect and parse legacy v0.7–v0.9 hook config JSON files.
 * Returns a compatible guard config, or null if no legacy config found.
 */
export async function detectLegacyHookConfig(hookPath: string): Promise<PreToolUseGuardConfig | null> {
  if (!(await fileExists(hookPath))) return null;

  let content: string;
  try {
    content = await readFile(hookPath);
  } catch {
    return null;
  }

  let parsed: LegacyHookConfig;
  try {
    parsed = JSON.parse(content) as LegacyHookConfig;
  } catch {
    return null;
  }

  // v0.7+ Windsurf JSON format: { event: 'PreToolUse', match: { tools }, ... }
  if (parsed.event === 'PreToolUse' && parsed.match?.tools) {
    return {
      rules: parsed.command === 'ivy validate'
        ? [{ matcher: '**', allowedPhases: ['build', 'verify'] }]
        : [{ matcher: '**', allowedPhases: ['build', 'verify', 'design'] }],
      globalBlock: [],
    };
  }

  // v0.8+ Cursor JSON format: { hooks: { preToolUse: [...] } }
  if (parsed.hooks?.preToolUse) {
    return {
      rules: [{ matcher: '**', allowedPhases: ['build', 'verify'] }],
      globalBlock: [],
    };
  }

  return null;
}

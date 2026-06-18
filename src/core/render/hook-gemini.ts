/**
 * Gemini CLI PreToolUse hook adapter — renders .gemini/settings.json BeforeTool segment.
 *
 * v0.10: upgraded from Experimental to Certified. Implements PlatformHookAdapter
 * for type-safe hook installation.
 *
 * Uses Gemini's native beforeTool configuration format.
 * §9.1 compliance: ≤ 50 lines, no Renderer interface.
 */

import path from 'path';
import type { Platform } from '../platforms.js';
import type { PlatformHookAdapter } from '../hook-runtime.js';
import type { PreToolUseGuardConfig } from '../types.js';

export class GeminiHookAdapter implements PlatformHookAdapter {
  format = 'gemini-json' as const;

  render(config: PreToolUseGuardConfig): string {
    const hasBuildPhase = config.rules.some((r) => r.allowedPhases.includes('build'));
    const hook = {
      beforeTool: {
        command: 'ivy validate',
        description: hasBuildPhase
          ? 'IvyFlow Phase Guard — blocks code edits in non-build phases'
          : 'IvyFlow Phase Guard',
      },
    };
    return JSON.stringify(hook, null, 2) + '\n';
  }

  installPath(platform: Platform, projectPath: string): string {
    return path.join(projectPath, platform.skillsDir, 'settings.json');
  }
}

/** @deprecated Use GeminiHookAdapter directly. */
export function renderHookForGemini(): string {
  return new GeminiHookAdapter().render({
    rules: [{ matcher: '**', allowedPhases: ['build', 'verify'] }],
    globalBlock: [],
  });
}

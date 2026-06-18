/**
 * Cursor PreToolUse hook adapter — renders .cursor/hooks.json.
 *
 * v0.10: implements PlatformHookAdapter interface for type-safe hook installation.
 * §9.1 compliance: ≤ 50 lines, no Renderer interface.
 */

import path from 'path';
import type { Platform } from '../platforms.js';
import type { PlatformHookAdapter } from '../hook-runtime.js';
import type { PreToolUseGuardConfig } from '../types.js';

export class CursorHookAdapter implements PlatformHookAdapter {
  format = 'cursor-json' as const;

  render(config: PreToolUseGuardConfig): string {
    const hook = {
      version: 1,
      hooks: {
        preToolUse: [
          {
            command: '.cursor/hooks/ivy-phase-guard.sh',
            matcher: 'Edit|Write',
          },
        ],
      },
    };
    return JSON.stringify(hook, null, 2) + '\n';
  }

  installPath(platform: Platform, projectPath: string): string {
    return path.join(projectPath, platform.skillsDir, platform.hookPath ?? 'hooks.json');
  }
}

/** @deprecated Use CursorHookAdapter directly. */
export function renderHookForCursor(): string {
  return new CursorHookAdapter().render({
    rules: [{ matcher: '**', allowedPhases: ['build', 'verify'] }],
    globalBlock: [],
  });
}

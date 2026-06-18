/**
 * Windsurf PreToolUse hook adapter — renders .windsurf/hooks/ivy-phase-guard.json.
 *
 * v0.10: implements PlatformHookAdapter interface for type-safe hook installation.
 * §9.1 compliance: ≤ 50 lines, no Renderer interface.
 */

import path from 'path';
import type { Platform } from '../platforms.js';
import type { PlatformHookAdapter } from '../hook-runtime.js';
import type { PreToolUseGuardConfig } from '../types.js';

export class WindsurfHookAdapter implements PlatformHookAdapter {
  format = 'windsurf-json' as const;

  render(config: PreToolUseGuardConfig): string {
    const hasBuildPhase = config.rules.some((r) => r.allowedPhases.includes('build'));
    const hook = {
      name: 'ivy-phase-guard',
      event: 'PreToolUse',
      match: { tools: ['Edit', 'Write', 'NotebookEdit'] },
      command: 'ivy validate',
      blockOnNonZeroExit: true,
      description: hasBuildPhase
        ? 'IvyFlow phase guard — blocks code edits in non-build phases'
        : 'IvyFlow phase guard',
    };
    return JSON.stringify(hook, null, 2) + '\n';
  }

  installPath(platform: Platform, projectPath: string): string {
    return path.join(projectPath, platform.skillsDir, platform.hookPath ?? 'hooks/ivy-phase-guard.json');
  }
}

/** @deprecated Use WindsurfHookAdapter directly. */
export function renderHookForWindsurf(): string {
  return new WindsurfHookAdapter().render({
    rules: [{ matcher: '**', allowedPhases: ['build', 'verify'] }],
    globalBlock: [],
  });
}

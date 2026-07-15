/**
 * Skill Router — maps phases to next skills based on workflow type.
 */

import type { StateYaml } from './lifecycle-projection.js';

export interface NextResult {
  action: 'auto' | 'manual' | 'done';
  skill?: string;
  hint?: string;
}

const FULL_ROUTING: Record<string, string> = {
  open: 'ivy-design',
  design: 'ivy-build',
  build: 'ivy-verify',
  verify: 'ivy-archive',
};

const HOTFIX_ROUTING: Record<string, string> = {
  open: 'ivy-build',
  build: 'ivy-verify',
  verify: 'ivy-archive',
};

const TWEAK_ROUTING: Record<string, string> = {
  open: 'ivy-build',
  build: 'ivy-verify',
  verify: 'ivy-archive',
};

export function resolveNextSkill(state: StateYaml): NextResult {
  const phase = state.checkpoint;
  const ext = state as Record<string, unknown>;
  const workflow = (ext.workflow as string) ?? 'full';
  const autoTransition = ext.auto_transition !== false && ext.auto_transition !== 'false';

  if (phase === 'archive') {
    return { action: 'done' };
  }

  let routing: Record<string, string>;
  switch (workflow) {
    case 'hotfix':
      routing = HOTFIX_ROUTING;
      break;
    case 'tweak':
      routing = TWEAK_ROUTING;
      break;
    default:
      routing = FULL_ROUTING;
  }

  const skill = routing[phase];
  if (!skill) {
    return { action: 'done' };
  }

  if (autoTransition) {
    return { action: 'auto', skill };
  }

  return {
    action: 'manual',
    skill,
    hint: `Run /${skill} to continue, or set auto_transition: true to auto-advance.`,
  };
}

export function formatNextResult(result: NextResult): string {
  switch (result.action) {
    case 'auto':
      return `NEXT: auto, SKILL: ${result.skill}`;
    case 'manual':
      return `NEXT: manual, SKILL: ${result.skill}, HINT: ${result.hint}`;
    case 'done':
      return 'NEXT: done';
  }
}

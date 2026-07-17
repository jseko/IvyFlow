import type { Origin, AILifecycleState, GitLifecycleState, RuntimeLifecycleState } from './types.js';

const AI_TRANSITIONS: Record<AILifecycleState, AILifecycleState[]> = {
  CREATED: ['CREATED', 'GENERATED'],
  GENERATED: ['GENERATED', 'ADOPTED'],
  ADOPTED: ['ADOPTED', 'MODIFIED'],
  MODIFIED: ['MODIFIED', 'ARCHIVED'],
  ARCHIVED: ['ARCHIVED'],
};

const GIT_TRANSITIONS: Record<GitLifecycleState, GitLifecycleState[]> = {
  NONE: ['NONE', 'COMMITTED'],
  COMMITTED: ['COMMITTED', 'PR_CREATED'],
  PR_CREATED: ['PR_CREATED', 'MERGED'],
  MERGED: ['MERGED'],
};

const RUNTIME_TRANSITIONS: Record<RuntimeLifecycleState, RuntimeLifecycleState[]> = {
  NONE: ['NONE', 'DEPLOYED'],
  DEPLOYED: ['DEPLOYED', 'STABLE', 'FAILED'],
  STABLE: ['STABLE', 'FAILED'],
  FAILED: ['FAILED', 'ROLLED_BACK'],
  ROLLED_BACK: ['ROLLED_BACK'],
};

export function transitionAILifecycle(origin: Origin, target: AILifecycleState): Origin {
  const current = origin.status.aiLifecycle;
  if (!AI_TRANSITIONS[current].includes(target)) {
    throw new Error(`Invalid AI lifecycle transition: ${current} → ${target}`);
  }
  return {
    ...origin,
    status: { ...origin.status, aiLifecycle: target },
  };
}

export function transitionGitLifecycle(origin: Origin, target: GitLifecycleState): Origin {
  const current = origin.status.gitLifecycle;
  if (!GIT_TRANSITIONS[current].includes(target)) {
    throw new Error(`Invalid Git lifecycle transition: ${current} → ${target}`);
  }
  return {
    ...origin,
    status: { ...origin.status, gitLifecycle: target },
  };
}

export function transitionRuntimeLifecycle(origin: Origin, target: RuntimeLifecycleState): Origin {
  const current = origin.status.runtimeLifecycle;
  if (!RUNTIME_TRANSITIONS[current].includes(target)) {
    throw new Error(`Invalid Runtime lifecycle transition: ${current} → ${target}`);
  }
  return {
    ...origin,
    status: { ...origin.status, runtimeLifecycle: target },
  };
}

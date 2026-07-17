import crypto from 'node:crypto';
import type { Origin, OriginStatus, AIAction, CodeArtifact } from './types.js';

export function generateOriginId(): string {
  return `orig_${crypto.randomBytes(8).toString('hex')}`;
}

export function createOrigin(provider: string): Origin {
  return {
    id: generateOriginId(),
    createdAt: Date.now(),
    provider,
    actions: [],
    artifacts: [],
    status: {
      aiLifecycle: 'CREATED',
      gitLifecycle: 'NONE',
      runtimeLifecycle: 'NONE',
    },
  };
}

export function addAction(origin: Origin, action: AIAction): Origin {
  return {
    ...origin,
    actions: [...origin.actions, action],
  };
}

export function addArtifact(origin: Origin, artifact: CodeArtifact): Origin {
  return {
    ...origin,
    artifacts: [...origin.artifacts, artifact],
  };
}

export function getStatus(origin: Origin): OriginStatus {
  return { ...origin.status };
}

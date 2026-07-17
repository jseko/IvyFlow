export type AIOperation = 'GENERATE' | 'EDIT' | 'DELETE';

export type AILifecycleState = 'CREATED' | 'GENERATED' | 'ADOPTED' | 'MODIFIED' | 'ARCHIVED';

export type GitLifecycleState = 'NONE' | 'COMMITTED' | 'PR_CREATED' | 'MERGED';

export type RuntimeLifecycleState = 'NONE' | 'DEPLOYED' | 'STABLE' | 'FAILED' | 'ROLLED_BACK';

export type OriginEventType = 'origin_created' | 'lifecycle_changed' | 'artifact_added' | 'fingerprint_updated';

export interface AIAction {
  id: string;
  provider: string;
  operation: AIOperation;
  artifact: { path: string };
  metadata: Record<string, unknown>;
}

export interface CodeArtifact {
  filePath: string;
  fingerprint: string;
  git?: {
    commit?: string;
    branch?: string;
    pr?: string;
  };
}

export interface OriginStatus {
  aiLifecycle: AILifecycleState;
  gitLifecycle: GitLifecycleState;
  runtimeLifecycle: RuntimeLifecycleState;
}

export interface Origin {
  id: string;
  createdAt: number;
  provider: string;
  actions: AIAction[];
  artifacts: CodeArtifact[];
  status: OriginStatus;
}

export interface OriginEvent {
  eventId: string;
  type: OriginEventType;
  originId: string;
  timestamp: number;
  payload: Record<string, unknown>;
}

export interface OriginProjection {
  origins: Map<string, Origin>;
  lastEventId: string | null;
  rebuiltAt: number;
}

export interface EventQuery {
  originId?: string;
  eventTypes?: OriginEventType[];
  fromTimestamp?: number;
  toTimestamp?: number;
  provider?: string;
  limit?: number;
}

export class EventStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventStoreError';
  }
}

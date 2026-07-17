import type { OriginEvent, OriginProjection, EventQuery } from './types.js';

export interface OriginEventStore {
  append(event: OriginEvent): Promise<void>;
  query(filter: EventQuery): Promise<OriginEvent[]>;
  stream(fromEventId?: string): AsyncGenerator<OriginEvent>;
  rebuildProjection(): Promise<OriginProjection>;
  getProjection(): Promise<OriginProjection>;
}

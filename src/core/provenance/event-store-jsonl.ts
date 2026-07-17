import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import path from 'path';
import { ensureDir, fileExists, writeFile } from '../../utils/fs.js';
import type { OriginEventStore } from './event-store.js';
import type { OriginEvent, OriginProjection, Origin, EventQuery } from './types.js';

export class JSONLEventStore implements OriginEventStore {
  private projectPath: string;
  private projectionCache: OriginProjection | null = null;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  private get eventsPath(): string {
    return path.join(this.projectPath, '.ivy', 'provenance', 'events.jsonl');
  }

  private get projectionPath(): string {
    return path.join(this.projectPath, '.ivy', 'provenance', 'projections', 'current-state.json');
  }

  async append(event: OriginEvent): Promise<void> {
    await ensureDir(path.dirname(this.eventsPath));
    await writeFile(this.eventsPath, JSON.stringify(event) + '\n', { flag: 'a' });
    this.projectionCache = null;
  }

  async query(filter: EventQuery): Promise<OriginEvent[]> {
    const results: OriginEvent[] = [];
    const { originId, eventTypes, fromTimestamp, toTimestamp, limit } = filter;

    for await (const event of this.stream()) {
      if (originId && event.originId !== originId) continue;
      if (eventTypes && !eventTypes.includes(event.type)) continue;
      if (fromTimestamp !== undefined && event.timestamp < fromTimestamp) continue;
      if (toTimestamp !== undefined && event.timestamp > toTimestamp) continue;

      results.push(event);
      if (limit !== undefined && results.length >= limit) break;
    }

    return results;
  }

  async *stream(fromEventId?: string): AsyncGenerator<OriginEvent> {
    if (!(await fileExists(this.eventsPath))) return;

    let foundFrom = fromEventId === undefined;
    const rl = createInterface({ input: createReadStream(this.eventsPath), crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as OriginEvent;
        if (!foundFrom) {
          if (parsed.eventId === fromEventId) {
            foundFrom = true;
            yield parsed;
          }
          continue;
        }
        yield parsed;
      } catch {
        // skip corrupted lines
      }
    }
  }

  async rebuildProjection(): Promise<OriginProjection> {
    const origins = new Map<string, Origin>();
    let lastEventId: string | null = null;

    for await (const event of this.stream()) {
      lastEventId = event.eventId;
    }

    const projection: OriginProjection = {
      origins,
      lastEventId,
      rebuiltAt: Date.now(),
    };

    await ensureDir(path.dirname(this.projectionPath));
    await writeFile(this.projectionPath, JSON.stringify({
      lastEventId: projection.lastEventId,
      rebuiltAt: projection.rebuiltAt,
    }, null, 2));

    this.projectionCache = projection;
    return projection;
  }

  async getProjection(): Promise<OriginProjection> {
    if (this.projectionCache) {
      return this.projectionCache;
    }
    return this.rebuildProjection();
  }
}

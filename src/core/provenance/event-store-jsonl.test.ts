import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { JSONLEventStore } from './event-store-jsonl.js';

async function tmpProject(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-prov-'));
}

describe('JSONLEventStore', () => {
  let projectPath: string;
  let store: JSONLEventStore;

  beforeEach(async () => {
    projectPath = await tmpProject();
    store = new JSONLEventStore(projectPath);
  });

  afterEach(async () => {
    await fs.rm(projectPath, { recursive: true, force: true });
  });

  it('appends an event to events.jsonl', async () => {
    const event = {
      eventId: 'evt_001',
      type: 'origin_created' as const,
      originId: 'orig_001',
      timestamp: Date.now(),
      payload: {},
    };
    await store.append(event);

    const events = await store.query({});
    expect(events.length).toBe(1);
    expect(events[0].eventId).toBe('evt_001');
    expect(events[0].type).toBe('origin_created');
  });

  it('query filters by event type', async () => {
    await store.append({
      eventId: 'evt_001',
      type: 'origin_created',
      originId: 'orig_001',
      timestamp: Date.now(),
      payload: {},
    });
    await store.append({
      eventId: 'evt_002',
      type: 'lifecycle_changed',
      originId: 'orig_001',
      timestamp: Date.now(),
      payload: {},
    });

    const result = await store.query({ eventTypes: ['origin_created'] });
    expect(result.length).toBe(1);
    expect(result[0].type).toBe('origin_created');
  });

  it('query respects limit', async () => {
    for (let i = 0; i < 5; i++) {
      await store.append({
        eventId: `evt_00${i}`,
        type: 'origin_created',
        originId: `orig_00${i}`,
        timestamp: Date.now(),
        payload: {},
      });
    }
    const result = await store.query({ limit: 3 });
    expect(result.length).toBe(3);
  });

  it('query filters by originId', async () => {
    await store.append({
      eventId: 'evt_001',
      type: 'origin_created',
      originId: 'orig_a',
      timestamp: Date.now(),
      payload: {},
    });
    await store.append({
      eventId: 'evt_002',
      type: 'origin_created',
      originId: 'orig_b',
      timestamp: Date.now(),
      payload: {},
    });

    const result = await store.query({ originId: 'orig_a' });
    expect(result.length).toBe(1);
    expect(result[0].originId).toBe('orig_a');
  });

  it('stream yields all events in order', async () => {
    await store.append({
      eventId: 'evt_001',
      type: 'origin_created',
      originId: 'orig_001',
      timestamp: 1000,
      payload: {},
    });
    await store.append({
      eventId: 'evt_002',
      type: 'lifecycle_changed',
      originId: 'orig_001',
      timestamp: 2000,
      payload: {},
    });

    const events: string[] = [];
    for await (const event of store.stream()) {
      events.push(event.eventId);
    }
    expect(events).toEqual(['evt_001', 'evt_002']);
  });

  it('stream starts from given eventId', async () => {
    await store.append({
      eventId: 'evt_001',
      type: 'origin_created',
      originId: 'orig_001',
      timestamp: 1000,
      payload: {},
    });
    await store.append({
      eventId: 'evt_002',
      type: 'lifecycle_changed',
      originId: 'orig_001',
      timestamp: 2000,
      payload: {},
    });

    const events: string[] = [];
    for await (const event of store.stream('evt_002')) {
      events.push(event.eventId);
    }
    expect(events).toEqual(['evt_002']);
  });

  it('rebuildProjection creates projection file', async () => {
    await store.append({
      eventId: 'evt_001',
      type: 'origin_created',
      originId: 'orig_001',
      timestamp: Date.now(),
      payload: {},
    });

    const projection = await store.rebuildProjection();
    expect(projection.lastEventId).toBe('evt_001');

    const projectionPath = path.join(projectPath, '.ivy', 'provenance', 'projections', 'current-state.json');
    const stat = await fs.stat(projectionPath);
    expect(stat.isFile()).toBe(true);
  });

  it('getProjection returns cached projection after rebuild', async () => {
    await store.append({
      eventId: 'evt_001',
      type: 'origin_created',
      originId: 'orig_001',
      timestamp: Date.now(),
      payload: {},
    });

    await store.rebuildProjection();
    const projection = await store.getProjection();
    expect(projection.lastEventId).toBe('evt_001');
  });
});

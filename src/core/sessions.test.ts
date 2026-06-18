import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import {
  appendRawEvent,
  appendInferredEvent,
  readRawEvents,
  readInferredEvents,
  validateRawEvent,
  type RawEvent,
} from './sessions.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-sessions-'));
}

function makeRawEvent(overrides: Partial<RawEvent> = {}): RawEvent {
  return {
    eventId: `evt_${Date.now()}_test`,
    event: 'git_commit',
    ts: new Date().toISOString(),
    change: 'test-change',
    source: 'git-hook',
    meta: { hash: 'abc123', insertions: 10, deletions: 2 },
    ...overrides,
  };
}

describe('validateRawEvent', () => {
  it('accepts a valid raw event', () => {
    const evt = makeRawEvent();
    expect(() => validateRawEvent(evt)).not.toThrow();
  });

  it('throws on missing eventId', () => {
    const evt = makeRawEvent();
    delete (evt as unknown as Record<string, unknown>).eventId;
    expect(() => validateRawEvent(evt)).toThrow('eventId');
  });

  it('throws on invalid event type', () => {
    const evt = makeRawEvent({ event: 'invalid_event' as RawEvent['event'] });
    expect(() => validateRawEvent(evt)).toThrow('event');
  });

  it('throws on missing ts', () => {
    const evt = makeRawEvent();
    delete (evt as unknown as Record<string, unknown>).ts;
    expect(() => validateRawEvent(evt)).toThrow('ts');
  });

  it('throws on missing change', () => {
    const evt = makeRawEvent();
    delete (evt as unknown as Record<string, unknown>).change;
    expect(() => validateRawEvent(evt)).toThrow('change');
  });

  it('throws on missing source', () => {
    const evt = makeRawEvent();
    delete (evt as unknown as Record<string, unknown>).source;
    expect(() => validateRawEvent(evt)).toThrow('source');
  });
});

describe('appendRawEvent', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('writes a valid raw event to events.jsonl', async () => {
    const evt = makeRawEvent();
    await appendRawEvent(tmp, evt);

    const events: RawEvent[] = [];
    for await (const e of readRawEvents(tmp)) {
      events.push(e);
    }
    expect(events).toHaveLength(1);
    expect(events[0].eventId).toBe(evt.eventId);
  });

  it('deduplicates by eventId', async () => {
    const evt = makeRawEvent();
    await appendRawEvent(tmp, evt);
    await appendRawEvent(tmp, evt);

    const events: RawEvent[] = [];
    for await (const e of readRawEvents(tmp)) {
      events.push(e);
    }
    expect(events).toHaveLength(1);
  });

  it('appends multiple unique events', async () => {
    await appendRawEvent(tmp, makeRawEvent({ eventId: 'evt_1' }));
    await appendRawEvent(tmp, makeRawEvent({ eventId: 'evt_2' }));

    const events: RawEvent[] = [];
    for await (const e of readRawEvents(tmp)) {
      events.push(e);
    }
    expect(events).toHaveLength(2);
  });
});

describe('appendInferredEvent', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('writes inferred events to inferred-events.jsonl', async () => {
    await appendInferredEvent(tmp, {
      event: 'session_start',
      ts: new Date().toISOString(),
      change: 'test-change',
      inferred: true,
      inferenceRule: 'session_boundary_30min',
      sessionId: 'sess_123',
      source: 'git-hook',
      meta: { basisEvents: ['evt_1'] },
    });

    const events = [];
    for await (const e of readInferredEvents(tmp)) {
      events.push(e);
    }
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('session_start');
    expect(events[0].inferred).toBe(true);
  });

  it('deduplicates by dedupKey', async () => {
    await appendInferredEvent(tmp, {
      event: 'session_start',
      ts: new Date().toISOString(),
      change: 'test-change',
      inferred: true,
      inferenceRule: 'session_boundary_30min',
      sessionId: 'sess_123',
      source: 'git-hook',
      meta: { basisEvents: ['evt_1'] },
    });
    await appendInferredEvent(tmp, {
      event: 'session_start',
      ts: new Date().toISOString(),
      change: 'test-change',
      inferred: true,
      inferenceRule: 'session_boundary_30min',
      sessionId: 'sess_123',
      source: 'git-hook',
      meta: { basisEvents: ['evt_1'] },
    });

    const events = [];
    for await (const e of readInferredEvents(tmp)) {
      events.push(e);
    }
    expect(events).toHaveLength(1);
  });
});

describe('readRawEvents', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns empty when no events file exists', async () => {
    const events: RawEvent[] = [];
    for await (const e of readRawEvents(tmp)) {
      events.push(e);
    }
    expect(events).toHaveLength(0);
  });

  it('skips malformed lines gracefully', async () => {
    const rawDir = path.join(tmp, '.ivy', 'sessions', 'raw');
    await fs.mkdir(rawDir, { recursive: true });
    await fs.writeFile(
      path.join(rawDir, 'events.jsonl'),
      '{"eventId":"evt_1","event":"git_commit","ts":"2024-01-01T00:00:00Z","change":"c","source":"git-hook"}\nnot-json\n',
      'utf-8',
    );

    const events: RawEvent[] = [];
    for await (const e of readRawEvents(tmp)) {
      events.push(e);
    }
    expect(events).toHaveLength(1);
    expect(events[0].eventId).toBe('evt_1');
  });
});

/**
 * Session Events — L1/L2 data model.
 *
 * L1 (raw/events.jsonl): ground-truth events that actually occurred.
 * L2 (inferred/sessions.jsonl): heuristic-derived session boundaries.
 *
 * Design constraints (design.md D1/D2):
 *   - Physical separation of L1 and L2.
 *   - Idempotent writes via eventId deduplication.
 *   - Schema validation on L1 ingest.
 *   - Best-effort: system tolerates missing events.
 */

import { randomBytes } from 'crypto';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import path from 'path';

import { ensureDir, fileExists, readFile, writeFile, readJson } from '../utils/fs.js';

// ─── L1: Raw Events ───

export interface RawEvent {
  ts: string;
  eventId: string;
  change: string;
  event: 'git_commit' | 'phase_transition' | 'tool_use' | 'git_push' | 'file_save';
  source: 'git-hook' | 'hook' | 'validate';
  meta?: Record<string, unknown>;
}

// ─── L2: Inferred Events ───

export interface InferredEvent {
  ts: string;
  inferred: true;
  inferenceRule: string;
  change: string;
  sessionId: string;
  event: 'session_start' | 'session_end' | 'session_boundary_crossed' | 'stuck_detected' | 'phase_drift';
  source: 'git-hook' | 'hook' | 'validate';
  meta: {
    basisEvents: string[];
    [key: string]: unknown;
  };
}

export type SessionEvent = RawEvent | InferredEvent;

// ─── Validation ───

const RAW_EVENT_TYPES: ReadonlySet<string> = new Set([
  'git_commit',
  'phase_transition',
  'tool_use',
  'git_push',
  'file_save',
]);

const INFERRED_EVENT_TYPES: ReadonlySet<string> = new Set([
  'session_start',
  'session_end',
  'session_boundary_crossed',
  'stuck_detected',
  'phase_drift',
]);

export function validateRawEvent(event: unknown): asserts event is RawEvent {
  if (!event || typeof event !== 'object') {
    throw new Error('RawEvent must be an object');
  }
  const e = event as Record<string, unknown>;
  if (!e.ts || typeof e.ts !== 'string') throw new Error('RawEvent.ts must be a string');
  if (!e.eventId || typeof e.eventId !== 'string') throw new Error('RawEvent.eventId must be a string');
  if (!e.change || typeof e.change !== 'string') throw new Error('RawEvent.change must be a string');
  if (!e.event || typeof e.event !== 'string' || !RAW_EVENT_TYPES.has(e.event)) {
    throw new Error(`RawEvent.event must be one of: ${[...RAW_EVENT_TYPES].join(', ')}`);
  }
  if (!e.source || typeof e.source !== 'string') throw new Error('RawEvent.source must be a string');
}

export function validateInferredEvent(event: unknown): asserts event is InferredEvent {
  if (!event || typeof event !== 'object') {
    throw new Error('InferredEvent must be an object');
  }
  const e = event as Record<string, unknown>;
  if (!e.ts || typeof e.ts !== 'string') throw new Error('InferredEvent.ts must be a string');
  if (e.inferred !== true) throw new Error('InferredEvent.inferred must be true');
  if (!e.inferenceRule || typeof e.inferenceRule !== 'string') {
    throw new Error('InferredEvent.inferenceRule must be a string');
  }
  if (!e.change || typeof e.change !== 'string') throw new Error('InferredEvent.change must be a string');
  if (!e.sessionId || typeof e.sessionId !== 'string') throw new Error('InferredEvent.sessionId must be a string');
  if (!e.event || typeof e.event !== 'string' || !INFERRED_EVENT_TYPES.has(e.event)) {
    throw new Error(`InferredEvent.event must be one of: ${[...INFERRED_EVENT_TYPES].join(', ')}`);
  }
  if (!e.meta || typeof e.meta !== 'object' || !Array.isArray((e.meta as Record<string, unknown>).basisEvents)) {
    throw new Error('InferredEvent.meta.basisEvents must be an array of strings');
  }
}

// ─── Idempotency (checksums.json) ───

interface Checksums {
  eventIds: string[];
  dedupKeys: string[];
}

async function readChecksums(projectPath: string): Promise<Checksums> {
  const checksumPath = path.join(projectPath, '.ivy', 'sessions', 'raw', 'checksums.json');
  if (await fileExists(checksumPath)) {
    try {
      return await readJson<Checksums>(checksumPath);
    } catch {
      return { eventIds: [], dedupKeys: [] };
    }
  }
  return { eventIds: [], dedupKeys: [] };
}

async function writeChecksums(projectPath: string, checksums: Checksums): Promise<void> {
  const checksumPath = path.join(projectPath, '.ivy', 'sessions', 'raw', 'checksums.json');
  await writeFile(checksumPath, JSON.stringify(checksums, null, 2));
}

export async function hasEventId(projectPath: string, eventId: string): Promise<boolean> {
  const checksums = await readChecksums(projectPath);
  return checksums.eventIds.includes(eventId);
}

export async function recordEventId(projectPath: string, eventId: string): Promise<void> {
  const checksums = await readChecksums(projectPath);
  if (!checksums.eventIds.includes(eventId)) {
    checksums.eventIds.push(eventId);
    await writeChecksums(projectPath, checksums);
  }
}

export async function hasDedupKey(projectPath: string, dedupKey: string): Promise<boolean> {
  const checksums = await readChecksums(projectPath);
  return checksums.dedupKeys.includes(dedupKey);
}

export async function recordDedupKey(projectPath: string, dedupKey: string): Promise<void> {
  const checksums = await readChecksums(projectPath);
  if (!checksums.dedupKeys.includes(dedupKey)) {
    checksums.dedupKeys.push(dedupKey);
    await writeChecksums(projectPath, checksums);
  }
}

// ─── Write ───

export async function appendRawEvent(projectPath: string, event: RawEvent): Promise<void> {
  if (await hasEventId(projectPath, event.eventId)) {
    return; // silently deduplicate
  }
  validateRawEvent(event);

  const l1File = path.join(projectPath, '.ivy', 'sessions', 'raw', 'events.jsonl');
  await ensureDir(path.dirname(l1File));
  await writeFile(l1File, JSON.stringify(event) + '\n', { flag: 'a' });

  await recordEventId(projectPath, event.eventId);
}

export async function appendInferredEvent(projectPath: string, event: InferredEvent): Promise<void> {
  const dedupKey = `${event.sessionId}:${event.event}`;
  if (await hasDedupKey(projectPath, dedupKey)) {
    return; // silently deduplicate
  }
  validateInferredEvent(event);

  const l2File = path.join(projectPath, '.ivy', 'sessions', 'inferred', 'sessions.jsonl');
  await ensureDir(path.dirname(l2File));
  await writeFile(l2File, JSON.stringify(event) + '\n', { flag: 'a' });

  await recordDedupKey(projectPath, dedupKey);
}

// ─── Read (streaming) ───

export async function* readRawEvents(projectPath: string): AsyncGenerator<RawEvent> {
  const file = path.join(projectPath, '.ivy', 'sessions', 'raw', 'events.jsonl');
  if (!(await fileExists(file))) return;

  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as RawEvent;
      validateRawEvent(parsed);
      yield parsed;
    } catch {
      // skip corrupted lines silently
    }
  }
}

export async function* readInferredEvents(projectPath: string): AsyncGenerator<InferredEvent> {
  const file = path.join(projectPath, '.ivy', 'sessions', 'inferred', 'sessions.jsonl');
  if (!(await fileExists(file))) return;

  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as InferredEvent;
      validateInferredEvent(parsed);
      yield parsed;
    } catch {
      // skip corrupted lines silently
    }
  }
}

// ─── Generators ───

export function generateEventId(): string {
  return 'evt_' + randomBytes(8).toString('hex');
}

export function generateSessionId(): string {
  return 'sess_' + randomBytes(8).toString('hex');
}

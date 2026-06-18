/**
 * Trend Analyzer — Derived Cache layer (v0.5).
 *
 * Computes trend profiles from L1/L2 data and caches them in
 * `.ivy/sessions/cache/` with 1-hour TTL.  The cache is rebuildable
 * and NOT a numbered data layer — confidence is inherited from L3.
 */

import path from 'path';

import { ensureDir, fileExists, readFile, writeFile } from '../utils/fs.js';
import { readRawEvents, readInferredEvents, type RawEvent, type InferredEvent } from './sessions.js';

// ─── Trend Profile ───

export interface ConfidenceProvenance {
  level: 'high' | 'medium' | 'low';
  basis: string;
}

export interface TrendProfile {
  changeName: string;
  periodStart: string;
  periodEnd: string;
  sessionCount: number;
  totalCommits: number;
  avgPhaseDuration: Record<string, number>;
  commonTransitions: Array<{ from: string; to: string; count: number }>;
  platformUsageSummary: Record<string, { sessions: number; commits: number }>;
  confidence: ConfidenceProvenance;
}

export interface PhaseDurationStats {
  change: string;
  phaseDurations: Record<string, number>;
}

export interface CommonTransition {
  from: string;
  to: string;
  count: number;
}

// ─── Cache Metadata ───

interface CacheMeta {
  createdAt: string;
  ttlMs: number;
  confidence: ConfidenceProvenance;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCacheDir(projectPath: string): string {
  return path.join(projectPath, '.ivy', 'sessions', 'cache');
}

function getTrendCachePath(projectPath: string, changeName: string): string {
  return path.join(getCacheDir(projectPath), `trend_profile_${changeName}.json`);
}

function getDurationStatsPath(projectPath: string): string {
  return path.join(getCacheDir(projectPath), 'phase_duration_stats.json');
}

function getTransitionsPath(projectPath: string): string {
  return path.join(getCacheDir(projectPath), 'common_transitions.json');
}

// ─── Cache Helpers ───

interface CacheEntry<T> {
  meta: CacheMeta;
  data: T;
}

async function readCache<T>(cachePath: string): Promise<CacheEntry<T> | null> {
  if (!(await fileExists(cachePath))) return null;
  try {
    const raw = await readFile(cachePath);
    const entry = JSON.parse(raw) as CacheEntry<T>;
    const age = Date.now() - new Date(entry.meta.createdAt).getTime();
    if (age > entry.meta.ttlMs) return null; // stale
    return entry;
  } catch {
    return null; // corrupted → treat as miss
  }
}

async function writeCache<T>(cachePath: string, data: T, confidence: ConfidenceProvenance): Promise<void> {
  const entry: CacheEntry<T> = {
    meta: {
      createdAt: new Date().toISOString(),
      ttlMs: CACHE_TTL_MS,
      confidence,
    },
    data,
  };
  await ensureDir(path.dirname(cachePath));
  await writeFile(cachePath, JSON.stringify(entry, null, 2));
}

// ─── Aggregation ───

async function collectEvents(
  projectPath: string,
  changeName?: string,
  periodStartMs?: number,
  periodEndMs?: number,
): Promise<{ rawEvents: RawEvent[]; inferredEvents: InferredEvent[] }> {
  const rawEvents: RawEvent[] = [];
  for await (const evt of readRawEvents(projectPath)) {
    if (changeName && evt.change !== changeName) continue;
    const ts = new Date(evt.ts).getTime();
    if (periodStartMs !== undefined && ts < periodStartMs) continue;
    if (periodEndMs !== undefined && ts > periodEndMs) continue;
    rawEvents.push(evt);
  }

  const inferredEvents: InferredEvent[] = [];
  for await (const evt of readInferredEvents(projectPath)) {
    if (changeName && evt.change !== changeName) continue;
    const ts = new Date(evt.ts).getTime();
    if (periodStartMs !== undefined && ts < periodStartMs) continue;
    if (periodEndMs !== undefined && ts > periodEndMs) continue;
    inferredEvents.push(evt);
  }

  return { rawEvents, inferredEvents };
}

function computeAvgPhaseDuration(inferredEvents: InferredEvent[]): Record<string, number> {
  const durations: Record<string, number[]> = {};
  // Phase durations are inferred from session boundaries + event patterns
  // For v0.5, we compute from phase_transition events embedded in raw events
  // and session durations as a proxy
  for (const evt of inferredEvents) {
    if (evt.event === 'session_end') {
      const durSec = (evt.meta as { durationSec?: number }).durationSec;
      const phase = (evt.meta as { phase?: string }).phase;
      if (durSec !== undefined && phase) {
        if (!durations[phase]) durations[phase] = [];
        durations[phase].push(durSec);
      }
    }
  }
  const result: Record<string, number> = {};
  for (const [phase, vals] of Object.entries(durations)) {
    result[phase] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  return result;
}

function computeCommonTransitions(rawEvents: RawEvent[]): CommonTransition[] {
  const transitions: Record<string, number> = {};
  const phaseEvents = rawEvents.filter((e) => e.event === 'phase_transition');
  for (const evt of phaseEvents) {
    const from = (evt.meta as { from?: string })?.from ?? 'unknown';
    const to = (evt.meta as { to?: string })?.to ?? 'unknown';
    const key = `${from}→${to}`;
    transitions[key] = (transitions[key] ?? 0) + 1;
  }
  return Object.entries(transitions)
    .map(([key, count]) => {
      const [from, to] = key.split('→');
      return { from, to, count };
    })
    .sort((a, b) => b.count - a.count);
}

function computeSessionCount(inferredEvents: InferredEvent[]): number {
  return inferredEvents.filter((e) => e.event === 'session_start').length;
}

// ─── Public API ───

export async function buildTrendProfile(
  projectPath: string,
  changeName: string,
  periodStart?: string,
  periodEnd?: string,
): Promise<TrendProfile | null> {
  // Check cache first
  const cachePath = getTrendCachePath(projectPath, changeName);
  const cached = await readCache<TrendProfile>(cachePath);
  if (cached) return cached.data;

  // Parse optional period boundaries
  const periodStartMs = periodStart ? new Date(periodStart).getTime() : undefined;
  const periodEndMs = periodEnd ? new Date(periodEnd).getTime() : undefined;

  // Collect events
  const { rawEvents, inferredEvents } = await collectEvents(projectPath, changeName, periodStartMs, periodEndMs);

  if (rawEvents.length === 0) return null;

  // Compute aggregates
  const profile: TrendProfile = {
    changeName,
    periodStart: periodStart ?? new Date(Math.min(...rawEvents.map((e) => new Date(e.ts).getTime()))).toISOString(),
    periodEnd: periodEnd ?? new Date().toISOString(),
    sessionCount: computeSessionCount(inferredEvents),
    totalCommits: rawEvents.filter((e) => e.event === 'git_commit').length,
    avgPhaseDuration: computeAvgPhaseDuration(inferredEvents),
    commonTransitions: computeCommonTransitions(rawEvents),
    platformUsageSummary: {}, // v0.5: populated by suggest engine
    confidence: {
      level: inferredEvents.length > 0 ? 'high' : 'medium',
      basis: inferredEvents.length > 0 ? 'L1+L2 events' : 'L1 events only',
    },
  };

  // Write cache
  await writeCache(cachePath, profile, profile.confidence);

  return profile;
}

/**
 * Read the data freshness of a cached trend profile, or null if absent/stale.
 */
export async function getTrendFreshness(
  projectPath: string,
  changeName: string,
): Promise<{ ageMs: number; fresh: boolean } | null> {
  const cachePath = getTrendCachePath(projectPath, changeName);
  if (!(await fileExists(cachePath))) return null;
  try {
    const raw = await readFile(cachePath);
    const entry = JSON.parse(raw) as CacheEntry<unknown>;
    const age = Date.now() - new Date(entry.meta.createdAt).getTime();
    return { ageMs: age, fresh: age <= entry.meta.ttlMs };
  } catch {
    return null;
  }
}

/**
 * Invalidate (delete) the trend cache for a given change.
 * Returns true if a cache file was removed, false if none existed.
 */
export async function invalidateTrendCache(projectPath: string, changeName: string): Promise<boolean> {
  const cachePath = getTrendCachePath(projectPath, changeName);
  if (!(await fileExists(cachePath))) return false;
  try {
    const { rm } = await import('fs/promises');
    await rm(cachePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Build aggregate phase duration stats across all changes.
 */
export async function buildPhaseDurationStats(
  projectPath: string,
): Promise<PhaseDurationStats | null> {
  const cachePath = getDurationStatsPath(projectPath);
  const cached = await readCache<PhaseDurationStats>(cachePath);
  if (cached) return cached.data;

  const { rawEvents } = await collectEvents(projectPath);
  if (rawEvents.length === 0) return null;

  // Group phase_transition events by change
  const phaseDurations: Record<string, Record<string, number[]>> = {};
  // Build a map change→phase→[start times]
  interface PhaseEntry { phase: string; start: number }
  const changePhases: Record<string, PhaseEntry[]> = {};

  for (const evt of rawEvents) {
    if (evt.event === 'phase_transition') {
      const meta = evt.meta as { from?: string; to?: string };
      if (!changePhases[evt.change]) changePhases[evt.change] = [];
      changePhases[evt.change].push({
        phase: meta.to ?? 'unknown',
        start: new Date(evt.ts).getTime(),
      });
    }
  }

  // Compute durations per phase per change
  for (const [change, phases] of Object.entries(changePhases)) {
    phases.sort((a, b) => a.start - b.start);
    for (let i = 0; i < phases.length - 1; i++) {
      const durDays = (phases[i + 1].start - phases[i].start) / (1000 * 60 * 60 * 24);
      if (!phaseDurations[change]) phaseDurations[change] = {};
      if (!phaseDurations[change][phases[i].phase]) phaseDurations[change][phases[i].phase] = [];
      phaseDurations[change][phases[i].phase].push(durDays);
    }
  }

  // Average per phase across all changes
  const phaseAverages: Record<string, number> = {};
  const phaseValues: Record<string, number[]> = {};
  for (const durations of Object.values(phaseDurations)) {
    for (const [phase, vals] of Object.entries(durations)) {
      if (!phaseValues[phase]) phaseValues[phase] = [];
      phaseValues[phase].push(...vals);
    }
  }
  for (const [phase, vals] of Object.entries(phaseValues)) {
    phaseAverages[phase] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  const stats: PhaseDurationStats = {
    change: '*',
    phaseDurations: phaseAverages,
  };

  await writeCache(cachePath, stats, { level: 'medium', basis: 'L1 phase_transition events' });
  return stats;
}

/**
 * Build common transition statistics across all changes.
 */
export async function buildCommonTransitions(
  projectPath: string,
): Promise<CommonTransition[]> {
  const cachePath = getTransitionsPath(projectPath);
  const cached = await readCache<CommonTransition[]>(cachePath);
  if (cached) return cached.data;

  const { rawEvents } = await collectEvents(projectPath);
  const transitions = computeCommonTransitions(rawEvents);

  await writeCache(cachePath, transitions, { level: 'high', basis: 'L1 phase_transition events' });
  return transitions;
}

export { CACHE_TTL_MS };
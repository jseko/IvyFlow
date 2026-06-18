/**
 * Session Inference — L2 layer generator (v0.5 calibrated).
 *
 * Scans L1 raw events and produces session_start / session_end via the
 * 30-minute boundary heuristic.  v0.5 adds:
 *   - CalibratedInferenceConfig (noise filtering, weekend detection)
 *   - Adjacent session merging (<5min gap)
 *   - Bias recording
 *
 * Fully replayable: delete inferred/ and re-run.
 */

import { appendInferredEvent, readRawEvents, type RawEvent, type InferredEvent } from './sessions.js';

// ─── Calibrated Config ───

export interface CalibratedInferenceConfig {
  sessionTimeoutMs: number;
  adaptiveTimeout: boolean;
  minSessionMs: number;
  calibrationMode: 'none' | 'rule' | 'human';
  multiSignalScoring?: boolean; // v0.6: enable multi-signal confidence scoring
}

export const DEFAULT_CALIBRATED_CONFIG: CalibratedInferenceConfig = {
  sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes
  adaptiveTimeout: false,            // v0.5暂不启用自适应
  minSessionMs: 60 * 1000,           // 1分钟以下视为噪音
  calibrationMode: 'rule',
  multiSignalScoring: false,         // v0.6实验特性，默认关闭
};

// ─── Bias Recording ───

export interface InferenceBiasEntry {
  timestamp: string;
  ruleName: string;
  change: string;
  sessionId: string;
  confidence: 'high' | 'medium' | 'low';
  detail: string;
}

export interface InferenceBiasLog {
  entries: InferenceBiasEntry[];
}

// ─── Weekend helpers ───

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function isOutsideWorkingHours(date: Date): boolean {
  const hour = date.getUTCHours();
  return hour < 8 || hour > 18;
}

// ─── Session helpers ───

function createSessionStart(
  sessionId: string,
  basisEventId: string,
  ts: number,
  change: string,
  calConfig?: CalibratedInferenceConfig,
  ruleName?: string,
): InferredEvent {
  const calMode = calConfig?.calibrationMode ?? DEFAULT_CALIBRATED_CONFIG.calibrationMode;
  return {
    ts: new Date(ts).toISOString(),
    inferred: true,
    inferenceRule: ruleName ?? (calMode === 'none' ? 'session_boundary_30min' : `session_boundary_30min_calibrated_${calMode}`),
    change,
    sessionId,
    event: 'session_start',
    source: 'git-hook',
    meta: { basisEvents: [basisEventId] },
  };
}

function createSessionEnd(
  sessionId: string,
  startEventId: string,
  endEventId: string,
  ts: number,
  startTs: number,
  change: string,
  commitCount: number,
  extraMeta?: Record<string, unknown>,
): InferredEvent {
  return {
    ts: new Date(ts).toISOString(),
    inferred: true,
    inferenceRule: 'session_boundary_30min',
    change,
    sessionId,
    event: 'session_end',
    source: 'git-hook',
    meta: {
      basisEvents: [startEventId, endEventId],
      durationSec: Math.round((ts - startTs) / 1000),
      commitCount,
      ...(extraMeta ?? {}),
    },
  };
}

// ─── Session grouping helper — shared between calibrate and non-calibrate ───

interface RawSession {
  sessionId: string;
  events: RawEvent[];
  startTs: number;
  endTs: number;
  startEventId: string;
  endEventId: string;
  commitCount: number;
  isMerged?: boolean;
}

function buildRawSessions(
  byChange: Map<string, RawEvent[]>,
  sessionTimeoutMs: number,
  config?: CalibratedInferenceConfig,
): Map<string, RawSession[]> {
  const allSessions = new Map<string, RawSession[]>();

  for (const [change, events] of byChange) {
    events.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    const sessions: RawSession[] = [];
    let sessionId: string | null = null;
    let sessionEvents: RawEvent[] = [];
    let startTs = 0;
    let lastTs = 0;
    let startEventId: string | null = null;
    let lastEventId: string | null = null;
    let commitCount = 0;

    for (const evt of events) {
      const ts = new Date(evt.ts).getTime();

      if (sessionId === null || ts - lastTs > sessionTimeoutMs) {
        if (sessionId !== null && sessionEvents.length > 0 && startEventId !== null && lastEventId !== null) {
          sessions.push({
            sessionId,
            events: sessionEvents,
            startTs,
            endTs: lastTs,
            startEventId,
            endEventId: lastEventId,
            commitCount,
          });
        }

        sessionId = generateSessionIdFromEvent(evt.eventId, ts);
        sessionEvents = [evt];
        startTs = ts;
        startEventId = evt.eventId;
        commitCount = 0;
      } else {
        sessionEvents.push(evt);
      }

      lastTs = ts;
      lastEventId = evt.eventId;
      if (evt.event === 'git_commit') commitCount++;
    }

    // flush last session
    if (sessionId !== null && sessionEvents.length > 0 && startEventId !== null && lastEventId !== null) {
      sessions.push({
        sessionId,
        events: sessionEvents,
        startTs,
        endTs: lastTs,
        startEventId,
        endEventId: lastEventId,
        commitCount,
      });
    }

    allSessions.set(change, sessions);
  }

  return allSessions;
}

function generateSessionIdFromEvent(eventId: string, ts: number): string {
  return `sess_${eventId}_${ts}`;
}

function recordBias(
  biasLog: InferenceBiasEntry[],
  ruleName: string,
  change: string,
  sessionId: string,
  confidence: 'high' | 'medium' | 'low',
  detail: string,
): void {
  biasLog.push({
    timestamp: new Date().toISOString(),
    ruleName,
    change,
    sessionId,
    confidence,
    detail,
  });
}

/**
 * Apply calibration rules: noise filtering, weekend detection, adjacent merging.
 * Returns filtered sessions + bias log.
 */
function calibrateSessions(
  sessionsByChange: Map<string, RawSession[]>,
  config: CalibratedInferenceConfig,
): { sessions: Map<string, RawSession[]>; bias: InferenceBiasEntry[] } {
  const bias: InferenceBiasEntry[] = [];
  const result = new Map<string, RawSession[]>();

  for (const [change, sessions] of sessionsByChange) {
    let filtered = sessions;

    // Noise filtering: discard single-commit sessions under minSessionMs
    if (config.calibrationMode !== 'none') {
      filtered = filtered.filter((s) => {
        const durationMs = s.endTs - s.startTs;
        if (s.commitCount <= 1 && durationMs < config.minSessionMs) {
          recordBias(bias, 'noise_filter_v1', change, s.sessionId, 'high',
            `Discarded: ${s.commitCount} commit(s), ${durationMs}ms duration < ${config.minSessionMs}ms threshold`);
          return false;
        }
        return true;
      });
    }

    // Weekend detection: mark sessions on weekends
    if (config.calibrationMode !== 'none') {
      for (const s of filtered) {
        const startDate = new Date(s.startTs);
        if (isWeekend(startDate) && isOutsideWorkingHours(startDate)) {
          s.events = s.events.map((evt) => ({
            ...evt,
            ...(evt.meta ? { meta: { ...evt.meta, possible_batch_operation: true } } : {}),
          }));
          recordBias(bias, 'weekend_detection_v1', change, s.sessionId, 'medium',
            `Weekend session at ${startDate.toISOString()}, marked as possible_batch_operation`);
        }
      }
    }

    // Adjacent session merging: merge sessions of same change within 5 min gap
    if (config.calibrationMode !== 'none') {
      const merged: RawSession[] = [];
      for (const s of filtered) {
        const prev = merged[merged.length - 1];
        if (prev && (s.startTs - prev.endTs) < 5 * 60 * 1000) {
          // merge: extend prev to current's end, accumulate events
          prev.events = [...prev.events, ...s.events];
          prev.endTs = s.endTs;
          prev.endEventId = s.endEventId;
          prev.commitCount += s.commitCount;
          prev.isMerged = true;
          recordBias(bias, 'adjacent_merge_v1', change, s.sessionId, 'high',
            `Merged into session ${prev.sessionId}: gap ${s.startTs - prev.endTs}ms < 5min`);
        } else {
          merged.push(s);
        }
      }
      filtered = merged;
    }

    result.set(change, filtered);
  }

  return { sessions: result, bias };
}

/**
 * Convert raw sessions to InferredEvent[].
 */
function sessionsToInferred(
  sessionsByChange: Map<string, RawSession[]>,
  inferenceRule: string,
): InferredEvent[] {
  const inferred: InferredEvent[] = [];

  for (const [change, sessions] of sessionsByChange) {
    for (const s of sessions) {
      const startEvent = createSessionStart(s.sessionId, s.startEventId, s.startTs, change);
      startEvent.inferenceRule = inferenceRule;
      inferred.push(startEvent);

      const meta: Record<string, unknown> = {};
      if (s.isMerged) meta.merged = true;

      inferred.push(
        createSessionEnd(
          s.sessionId,
          s.startEventId,
          s.endEventId,
          s.endTs,
          s.startTs,
          change,
          s.commitCount,
          meta,
        ),
      );
    }
  }

  return inferred;
}

// ─── Multi-Signal Scoring (v0.6) ───

export interface MultiSignalScore {
  overall: number;          // 0-1 combined score
  timeGapScore: number;     // 0-1
  fileOverlapScore: number; // 0-1
  commitFreqScore: number;  // 0-1
  confidence: string;       // 'low' | 'low~medium' | 'medium' | 'high'
}

/**
 * Compute multi-signal confidence score for a set of sessions.
 *
 * Time gap weight: 0.5 — longer gaps between sessions = higher boundary confidence.
 * File overlap weight: 0.3 — if sessions share changed files, boundary is weaker.
 * Commit frequency weight: 0.2 — more commits per session = higher quality signal.
 *
 * Combined confidence label:
 *   ≥ 0.7 → 'high'
 *   ≥ 0.5 → 'medium'
 *   ≥ 0.4 → 'low~medium'
 *   < 0.4 → 'low'
 */
export function computeMultiSignalScore(
  sessions: RawSession[],
): MultiSignalScore {
  if (sessions.length === 0) {
    return { overall: 0, timeGapScore: 0, fileOverlapScore: 0, commitFreqScore: 0, confidence: 'low' };
  }

  // Time gap score: normalized gap between consecutive sessions
  let totalGap = 0;
  let gapCount = 0;
  for (let i = 1; i < sessions.length; i++) {
    const gapMs = sessions[i].startTs - sessions[i - 1].endTs;
    totalGap += gapMs;
    gapCount++;
  }
  // Score: gap/(gap+30min) — gaps >> 30min → 1, gaps << 30min → 0
  const avgGapMs = gapCount > 0 ? totalGap / gapCount : 0;
  const timeGapScore = avgGapMs / (avgGapMs + 30 * 60 * 1000);

  // File overlap score: check if sessions reference same files (from file_save events)
  let overlapScore = 1; // default: no overlap detected
  for (let i = 1; i < sessions.length && overlapScore > 0; i++) {
    const prevFiles = extractFilePaths(sessions[i - 1].events);
    const currFiles = extractFilePaths(sessions[i].events);
    if (prevFiles.length > 0 && currFiles.length > 0) {
      const intersection = prevFiles.filter((f) => currFiles.includes(f));
      if (intersection.length > 0) {
        // Overlap reduces score proportionally
        overlapScore = Math.max(0, 1 - (intersection.length / Math.max(prevFiles.length, currFiles.length)));
      }
    }
  }

  // Commit frequency score: more commits per session = higher quality
  const avgCommits = sessions.reduce((s, sess) => s + sess.commitCount, 0) / sessions.length;
  const commitFreqScore = Math.min(1, avgCommits / 5); // 5+ commits → 1.0

  // Combined weighted score
  const overall = timeGapScore * 0.5 + overlapScore * 0.3 + commitFreqScore * 0.2;

  let confidence: string;
  if (overall >= 0.7) confidence = 'high';
  else if (overall >= 0.5) confidence = 'medium';
  else if (overall >= 0.4) confidence = 'low~medium';
  else confidence = 'low';

  return { overall, timeGapScore, fileOverlapScore: overlapScore, commitFreqScore, confidence };
}

function extractFilePaths(events: RawEvent[]): string[] {
  const paths: string[] = [];
  for (const evt of events) {
    const metaPath = (evt.meta as Record<string, unknown> | undefined)?.path;
    if (typeof metaPath === 'string') {
      paths.push(metaPath);
    }
  }
  return paths;
}

/**
 * Infer sessions from raw events. Accepts optional CalibratedInferenceConfig.
 */
export function inferSessions(
  rawEvents: RawEvent[],
  config?: CalibratedInferenceConfig,
): { events: InferredEvent[]; bias: InferenceBiasEntry[] } {
  const cfg = config ?? { ...DEFAULT_CALIBRATED_CONFIG, calibrationMode: 'none' };

  // Group by change
  const byChange: Map<string, RawEvent[]> = new Map();
  for (const evt of rawEvents) {
    const list = byChange.get(evt.change) ?? [];
    list.push(evt);
    byChange.set(evt.change, list);
  }

  // Build raw sessions
  const rawSessions = buildRawSessions(byChange, cfg.sessionTimeoutMs, cfg);

  // Apply calibration rules
  const { sessions: calibratedSessions, bias } = calibrateSessions(rawSessions, cfg);

  // v0.6: Multi-signal scoring (experimental, opt-in)
  if (cfg.multiSignalScoring) {
    for (const [, sessions] of calibratedSessions) {
      const score = computeMultiSignalScore(sessions);
      // Record bias entry for multi-signal scoring
      if (sessions.length > 0 && score.confidence !== 'high') {
        recordBias(bias, 'multi_signal_v1', sessions[0].events[0]?.change ?? 'unknown',
          sessions[0].sessionId, score.confidence === 'low~medium' ? 'medium' : score.confidence as 'high' | 'medium' | 'low',
          `Multi-signal score: ${score.overall.toFixed(2)} (timeGap=${score.timeGapScore.toFixed(2)}, fileOverlap=${score.fileOverlapScore.toFixed(2)}, commitFreq=${score.commitFreqScore.toFixed(2)})`);
      }
    }
  }

  // Convert to InferredEvent[]
  const inferenceRule = cfg.calibrationMode === 'none'
    ? 'session_boundary_30min'
    : `session_boundary_30min_calibrated_${cfg.calibrationMode}`;
  const events = sessionsToInferred(calibratedSessions, inferenceRule);

  return { events, bias };
}

/**
 * Run inference for a project: read all L1 raw events, compute L2 sessions,
 * and write them to disk. Returns count of inferred events + bias log.
 */
export async function runSessionInference(
  projectPath: string,
  config?: CalibratedInferenceConfig,
): Promise<{ inferred: number; bias: InferenceBiasEntry[] }> {
  const rawEvents: RawEvent[] = [];
  for await (const evt of readRawEvents(projectPath)) {
    rawEvents.push(evt);
  }

  const { events, bias } = inferSessions(rawEvents, config);

  for (const event of events) {
    await appendInferredEvent(projectPath, event);
  }

  return { inferred: events.length, bias };
}

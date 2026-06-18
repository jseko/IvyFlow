import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import {
  inferSessions,
  runSessionInference,
  DEFAULT_CALIBRATED_CONFIG,
  computeMultiSignalScore,
  type CalibratedInferenceConfig,
} from './session-inferer.js';
import { appendRawEvent, readInferredEvents, type RawEvent } from './sessions.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-inferer-'));
}

function makeCommitEvent(
  ts: string,
  change: string,
  hash: string,
): RawEvent {
  return {
    eventId: `evt_${hash}`,
    event: 'git_commit',
    ts,
    change,
    source: 'git-hook',
    meta: { hash, insertions: 10, deletions: 2 },
  };
}

describe('inferSessions', () => {
  it('returns empty for empty input', () => {
    const { events } = inferSessions([]);
    expect(events).toHaveLength(0);
  });

  it('creates one session for single commit', () => {
    const evts = [makeCommitEvent('2024-01-01T10:00:00Z', 'feat-x', 'abc')];
    const { events } = inferSessions(evts);
    expect(events).toHaveLength(2); // session_start + session_end
    expect(events[0].event).toBe('session_start');
    expect(events[1].event).toBe('session_end');
    expect(events[0].change).toBe('feat-x');
  });

  it('splits into two sessions when gap > 30min', () => {
    const evts = [
      makeCommitEvent('2024-01-01T10:00:00Z', 'feat-x', 'a1'),
      makeCommitEvent('2024-01-01T10:15:00Z', 'feat-x', 'a2'),
      makeCommitEvent('2024-01-01T11:00:00Z', 'feat-x', 'a3'),
    ];
    const { events } = inferSessions(evts);
    const starts = events.filter((e) => e.event === 'session_start');
    const ends = events.filter((e) => e.event === 'session_end');
    expect(starts).toHaveLength(2);
    expect(ends).toHaveLength(2);
  });

  it('keeps one session when gap < 30min', () => {
    const evts = [
      makeCommitEvent('2024-01-01T10:00:00Z', 'feat-x', 'a1'),
      makeCommitEvent('2024-01-01T10:29:00Z', 'feat-x', 'a2'),
    ];
    const { events } = inferSessions(evts);
    const starts = events.filter((e) => e.event === 'session_start');
    expect(starts).toHaveLength(1);
  });

  it('groups by change independently', () => {
    const evts = [
      makeCommitEvent('2024-01-01T10:00:00Z', 'feat-x', 'a1'),
      makeCommitEvent('2024-01-01T10:05:00Z', 'feat-y', 'b1'),
    ];
    const { events } = inferSessions(evts);
    const starts = events.filter((e) => e.event === 'session_start');
    expect(starts).toHaveLength(2);
    expect(starts[0].change).toBe('feat-x');
    expect(starts[1].change).toBe('feat-y');
  });

  it('computes correct duration for session_end', () => {
    const evts = [
      makeCommitEvent('2024-01-01T10:00:00Z', 'feat-x', 'a1'),
      makeCommitEvent('2024-01-01T10:15:00Z', 'feat-x', 'a2'),
    ];
    const { events } = inferSessions(evts);
    const end = events.find((e) => e.event === 'session_end');
    expect(end).toBeDefined();
    const durationSec = (end!.meta as Record<string, unknown>)?.durationSec as number;
    expect(durationSec).toBe(15 * 60);
  });

  it('basisEvents in session_end contains all eventIds', () => {
    const evts = [
      makeCommitEvent('2024-01-01T10:00:00Z', 'feat-x', 'a1'),
      makeCommitEvent('2024-01-01T10:10:00Z', 'feat-x', 'a2'),
    ];
    const { events } = inferSessions(evts);
    const end = events.find((e) => e.event === 'session_end');
    const basis = (end!.meta as Record<string, unknown>)?.basisEvents as string[];
    expect(basis).toEqual(['evt_a1', 'evt_a2']);
  });

  it('ignores non-git_commit events', () => {
    const evts: RawEvent[] = [
      makeCommitEvent('2024-01-01T10:00:00Z', 'feat-x', 'a1'),
      {
        eventId: 'evt_pt1',
        event: 'phase_transition',
        ts: '2024-01-01T10:05:00Z',
        change: 'feat-x',
        source: 'validate',
        meta: { from: 'open', to: 'design' },
      },
    ];
    const { events } = inferSessions(evts);
    const starts = events.filter((e) => e.event === 'session_start');
    expect(starts).toHaveLength(1);
  });

  // ─── Calibration tests ───

  const noCalConfig: CalibratedInferenceConfig = {
    ...DEFAULT_CALIBRATED_CONFIG,
    calibrationMode: 'none',
  };

  it('noise filtering: discards single-event sessions under 1min', () => {
    // Two sessions: one sub-1min single event, one normal
    const evts = [
      makeCommitEvent('2024-01-01T10:00:10Z', 'feat-x', 'noise'), // single event
      makeCommitEvent('2024-01-01T11:00:00Z', 'feat-x', 'real1'),
      makeCommitEvent('2024-01-01T11:05:00Z', 'feat-x', 'real2'),
    ];
    const { events, bias } = inferSessions(evts, DEFAULT_CALIBRATED_CONFIG);
    const starts = events.filter((e) => e.event === 'session_start');
    // noise session discarded (single event, <1min)
    expect(starts).toHaveLength(1);
    const noiseBias = bias.filter((b) => b.ruleName === 'noise_filter_v1');
    expect(noiseBias).toHaveLength(1);
  });

  it('noise filtering: not applied in none mode', () => {
    const evts = [
      makeCommitEvent('2024-01-01T10:00:10Z', 'feat-x', 'noise'),
    ];
    const { events } = inferSessions(evts, noCalConfig);
    const starts = events.filter((e) => e.event === 'session_start');
    expect(starts).toHaveLength(1);
  });

  it('weekend detection: marks weekend sessions outside working hours', () => {
    // 2024-01-06 is a Saturday, 22:00 UTC is outside working hours
    const evts = [
      makeCommitEvent('2024-01-06T22:00:00Z', 'feat-x', 'wk1'),
      makeCommitEvent('2024-01-06T22:15:00Z', 'feat-x', 'wk2'),
    ];
    const { events, bias } = inferSessions(evts, DEFAULT_CALIBRATED_CONFIG);
    const starts = events.filter((e) => e.event === 'session_start');
    expect(starts).toHaveLength(1);
    const weekendBias = bias.filter((b) => b.ruleName === 'weekend_detection_v1');
    expect(weekendBias).toHaveLength(1);
  });

  it('adjacent session merging: merges sessions <5min apart with short timeout', () => {
    // Disable noise filtering so single-event sessions survive for merge testing
    const mergeConfig: CalibratedInferenceConfig = {
      ...DEFAULT_CALIBRATED_CONFIG,
      sessionTimeoutMs: 60 * 1000, // 1 minute timeout → close sessions
      minSessionMs: 0,             // disable noise filtering
    };
    // Events every 90s → split into separate sessions (gap >1min).
    // S2 starts at 10:01:30 → within 5min of S1 end (10:00) → should merge.
    const evts = [
      makeCommitEvent('2024-01-01T10:00:00Z', 'feat-x', 'a1'),
      makeCommitEvent('2024-01-01T10:01:30Z', 'feat-x', 'a2'),
      makeCommitEvent('2024-01-01T10:03:00Z', 'feat-x', 'a3'),
      makeCommitEvent('2024-01-01T10:10:00Z', 'feat-x', 'a4'),
    ];
    const { events, bias } = inferSessions(evts, mergeConfig);
    const mergeBias = bias.filter((b) => b.ruleName === 'adjacent_merge_v1');
    // Initial sessions: S1(10:00), S2(10:01:30), S3(10:03:00), S4(10:10)
    // S2 starts 90s after S1 → merged into S1
    // S3 starts 90s after S2 end → merged into S1
    // S4 starts 7min after S3 end → NOT merged
    expect(mergeBias.length).toBeGreaterThanOrEqual(2);
  });

  it('returns bias log for all calibration actions', () => {
    // One noise event + one normal session
    const evts = [
      makeCommitEvent('2024-01-01T10:00:10Z', 'feat-x', 'noise'),
      makeCommitEvent('2024-01-01T11:00:00Z', 'feat-x', 'ok1'),
      makeCommitEvent('2024-01-01T11:15:00Z', 'feat-x', 'ok2'),
    ];
    const { bias } = inferSessions(evts, DEFAULT_CALIBRATED_CONFIG);
    expect(bias.length).toBeGreaterThanOrEqual(1);
    expect(bias.every((b) => b.ruleName && b.change && b.sessionId)).toBe(true);
  });

  // ─── Multi-Signal Scoring tests (v0.6) ───

  it('multi-signal scoring records bias entry for low confidence', () => {
    // Two events with 1hr gap → stays as one session → single session → no gap baseline
    const evts = [
      makeCommitEvent('2024-01-01T10:00:00Z', 'feat-x', 'a1'),
      makeCommitEvent('2024-01-01T11:00:00Z', 'feat-x', 'a2'),
    ];
    const { bias } = inferSessions(evts, { ...DEFAULT_CALIBRATED_CONFIG, multiSignalScoring: true, minSessionMs: 0 });
    const signalBias = bias.filter((b) => b.ruleName === 'multi_signal_v1');
    expect(signalBias.length).toBeGreaterThanOrEqual(1);
    expect(signalBias[0].detail).toContain('Multi-signal score');
  });

  it('multi-signal scoring gives higher confidence with wider gaps', () => {
    // Simulate sessions with large gaps (2hr+) and multiple commits
    const mockSessions = [
      {
        sessionId: 's1',
        events: [
          { event: 'git_commit', meta: { hash: 'a1' } } as unknown as RawEvent,
          { event: 'git_commit', meta: { hash: 'a2' } } as unknown as RawEvent,
          { event: 'git_commit', meta: { hash: 'a3' } } as unknown as RawEvent,
        ],
        startTs: new Date('2024-01-01T10:00:00Z').getTime(),
        endTs: new Date('2024-01-01T10:30:00Z').getTime(),
        startEventId: 'e1',
        endEventId: 'e3',
        commitCount: 3,
      },
      {
        sessionId: 's2',
        events: [
          { event: 'git_commit', meta: { hash: 'b1' } } as unknown as RawEvent,
          { event: 'git_commit', meta: { hash: 'b2' } } as unknown as RawEvent,
        ],
        startTs: new Date('2024-01-01T14:00:00Z').getTime(),
        endTs: new Date('2024-01-01T14:20:00Z').getTime(),
        startEventId: 'e4',
        endEventId: 'e5',
        commitCount: 2,
      },
    ];

    const score = computeMultiSignalScore(mockSessions);
    // Time gap is 3.5hr → timeGapScore should be high (3.5h / (3.5h+30min) ≈ 0.875)
    expect(score.timeGapScore).toBeGreaterThan(0.5);
    // Overall should be medium-high
    expect(score.confidence).not.toBe('low');
  });

  it('multi-signal scoring: file overlap reduces confidence', () => {
    // Sessions with file overlap — both touch src/core/main.ts
    const s1Events = [
      { eventId: 'e1', event: 'file_save', ts: '2024-01-01T10:00:00Z', change: 'feat-x', source: 'git-hook' as const,
        meta: { path: 'src/core/main.ts', status: 'modified', commitHash: 'a1', fileSize: 100, insertions: 5, deletions: 2 } } as unknown as RawEvent,
    ];
    const s2Events = [
      { eventId: 'e2', event: 'file_save', ts: '2024-01-01T11:00:00Z', change: 'feat-x', source: 'git-hook' as const,
        meta: { path: 'src/core/main.ts', status: 'modified', commitHash: 'b1', fileSize: 100, insertions: 3, deletions: 1 } } as unknown as RawEvent,
    ];

    const mockSessions = [
      { sessionId: 's1', events: s1Events, startTs: 100000, endTs: 100000, startEventId: 'e1', endEventId: 'e1', commitCount: 1 },
      { sessionId: 's2', events: s2Events, startTs: 103600000, endTs: 103600000, startEventId: 'e2', endEventId: 'e2', commitCount: 1 },
    ];

    const score = computeMultiSignalScore(mockSessions);
    // File overlap exists (both touch main.ts) → fileOverlapScore should be < 1
    expect(score.fileOverlapScore).toBeLessThan(1);
  });

  it('multi-signal scoring: empty sessions returns low confidence', () => {
    const score = computeMultiSignalScore([]);
    expect(score.overall).toBe(0);
    expect(score.confidence).toBe('low');
  });

  it('multi-signal scoring: high commit count increases commitFreqScore', () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      ({ event: 'git_commit' as const, meta: {} }) as unknown as RawEvent);

    const mockSessions = [
      { sessionId: 's1', events, startTs: 0, endTs: 100, startEventId: 'e1', endEventId: 'e10', commitCount: 10 },
    ];

    const score = computeMultiSignalScore(mockSessions);
    expect(score.commitFreqScore).toBe(1); // 10/5 = 2 → clamped to 1
  });
});

describe('runSessionInference', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('is a no-op when no raw events exist', async () => {
    await runSessionInference(tmp);
    const events = [];
    for await (const e of readInferredEvents(tmp)) {
      events.push(e);
    }
    expect(events).toHaveLength(0);
  });

  it('writes inferred events after reading raw events', async () => {
    await appendRawEvent(tmp, makeCommitEvent('2024-01-01T10:00:00Z', 'feat-x', 'a1'));
    await appendRawEvent(tmp, makeCommitEvent('2024-01-01T10:15:00Z', 'feat-x', 'a2'));

    await runSessionInference(tmp);

    const events = [];
    for await (const e of readInferredEvents(tmp)) {
      events.push(e);
    }
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.inferred === true)).toBe(true);
  });

  it('is idempotent — second run produces same results', async () => {
    await appendRawEvent(tmp, makeCommitEvent('2024-01-01T10:00:00Z', 'feat-x', 'a1'));

    await runSessionInference(tmp);
    const first = [];
    for await (const e of readInferredEvents(tmp)) {
      first.push(e);
    }

    await runSessionInference(tmp);
    const second = [];
    for await (const e of readInferredEvents(tmp)) {
      second.push(e);
    }

    expect(second).toHaveLength(first.length);
  });
});
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import { aggregateAnalytics, type CommitMeta, type AnalyticsResult } from './analytics.js';
import { appendRawEvent, appendInferredEvent } from './sessions.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-analytics-'));
}

function makeCommitEvent(ts: string, change: string, hash: string, insertions: number, deletions: number) {
  return {
    eventId: `evt_${hash}`,
    event: 'git_commit' as const,
    ts,
    change,
    source: 'git-hook' as const,
    meta: { hash, insertions, deletions },
  };
}

function makePhaseTransition(ts: string, change: string, from: string, to: string) {
  return {
    eventId: `evt_pt_${from}_${to}`,
    event: 'phase_transition' as const,
    ts,
    change,
    source: 'validate' as const,
    meta: { from, to },
  };
}

describe('aggregateAnalytics', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns zero metrics when no events exist', async () => {
    const result = await aggregateAnalytics(tmp, undefined, 7);
    expect(result.metrics.commits.value).toBe(0);
    expect(Object.keys(result.metrics.phaseTransitions.value)).toHaveLength(0);
    expect(result.rawEventCount).toBe(0);
    expect(result.inferredEventCount).toBe(0);
  });

  it('counts commits correctly', async () => {
    const now = new Date();
    const ts = now.toISOString();
    await appendRawEvent(tmp, makeCommitEvent(ts, 'feat-x', 'abc1', 10, 2));
    await appendRawEvent(tmp, makeCommitEvent(ts, 'feat-x', 'abc2', 5, 1));

    const result = await aggregateAnalytics(tmp, undefined, 7);
    expect(result.metrics.commits.value).toBe(2);
    expect(result.metrics.commits.confidence.level).toBe('high');
  });

  it('counts phase transitions', async () => {
    const now = new Date();
    const ts = now.toISOString();
    await appendRawEvent(tmp, makePhaseTransition(ts, 'feat-x', 'open', 'design'));
    await appendRawEvent(tmp, makePhaseTransition(ts, 'feat-x', 'design', 'build'));
    await appendRawEvent(tmp, makePhaseTransition(ts, 'feat-x', 'build', 'verify'));

    const result = await aggregateAnalytics(tmp, undefined, 7);
    const pt = result.metrics.phaseTransitions.value;
    expect(pt['open → design']).toBe(1);
    expect(pt['design → build']).toBe(1);
    expect(pt['build → verify']).toBe(1);
    expect(result.metrics.phaseTransitions.confidence.level).toBe('high');
  });

  it('filters by change name', async () => {
    const now = new Date();
    const ts = now.toISOString();
    await appendRawEvent(tmp, makeCommitEvent(ts, 'feat-x', 'a1', 10, 2));
    await appendRawEvent(tmp, makeCommitEvent(ts, 'feat-y', 'b1', 5, 1));

    const result = await aggregateAnalytics(tmp, 'feat-x', 7);
    expect(result.metrics.commits.value).toBe(1);
  });

  it('filters by period', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);
    const newDate = new Date();

    await appendRawEvent(tmp, makeCommitEvent(oldDate.toISOString(), 'feat-x', 'old1', 10, 2));
    await appendRawEvent(tmp, makeCommitEvent(newDate.toISOString(), 'feat-x', 'new1', 5, 1));

    const result = await aggregateAnalytics(tmp, undefined, 7);
    expect(result.metrics.commits.value).toBe(1);
  });

  it('includes session metrics when inferred events exist', async () => {
    const now = new Date();
    const ts = now.toISOString();
    await appendRawEvent(tmp, makeCommitEvent(ts, 'feat-x', 'a1', 10, 2));
    await appendInferredEvent(tmp, {
      event: 'session_start',
      ts,
      change: 'feat-x',
      inferred: true,
      inferenceRule: 'session_boundary_30min',
      sessionId: 'sess_1',
      source: 'git-hook',
      meta: { basisEvents: ['evt_a1'] },
    });
    await appendInferredEvent(tmp, {
      event: 'session_end',
      ts,
      change: 'feat-x',
      inferred: true,
      inferenceRule: 'session_boundary_30min',
      sessionId: 'sess_1',
      source: 'git-hook',
      meta: { basisEvents: ['evt_a1'], durationSec: 900 },
    });

    const result = await aggregateAnalytics(tmp, undefined, 7);
    expect(result.metrics.sessionCount?.value).toBe(1);
    expect(result.metrics.sessionCount?.confidence.level).toBe('low');
    expect(result.metrics.avgSessionDurationMin?.value).toBe(15);
  });

  it('includes AI contribution estimate for commits', async () => {
    const now = new Date();
    const ts = now.toISOString();
    await appendRawEvent(tmp, makeCommitEvent(ts, 'feat-x', 'a1', 100, 0));

    const result = await aggregateAnalytics(tmp, undefined, 7);
    expect(result.metrics.aiContributionEstimate).toBeDefined();
    expect(result.metrics.aiContributionEstimate?.experimental).toBe(true);
    expect(result.metrics.aiContributionEstimate?.confidence.level).toBe('none');
  });

  it('excludes AI estimate when no commits', async () => {
    const now = new Date();
    const ts = now.toISOString();
    await appendRawEvent(tmp, makePhaseTransition(ts, 'feat-x', 'open', 'design'));

    const result = await aggregateAnalytics(tmp, undefined, 7);
    expect(result.metrics.aiContributionEstimate).toBeUndefined();
  });
});

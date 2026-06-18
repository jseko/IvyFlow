import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import {
  buildTrendProfile,
  getTrendFreshness,
  invalidateTrendCache,
  buildPhaseDurationStats,
  buildCommonTransitions,
} from './trend-analyzer.js';
import { appendRawEvent, appendInferredEvent, type RawEvent, type InferredEvent } from './sessions.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-trend-'));
}

function makeCommit(ts: string, change: string, hash: string): RawEvent {
  return {
    eventId: `evt_${hash}`,
    event: 'git_commit',
    ts,
    change,
    source: 'git-hook',
    meta: { hash, insertions: 10, deletions: 2 },
  };
}

function makePhaseTransition(ts: string, change: string, from: string, to: string): RawEvent {
  return {
    eventId: `evt_pt_${Math.random().toString(36).slice(2, 6)}`,
    event: 'phase_transition',
    ts,
    change,
    source: 'validate',
    meta: { from, to },
  };
}

describe('trend-analyzer', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  describe('buildTrendProfile', () => {
    it('returns null when no events exist', async () => {
      const profile = await buildTrendProfile(tmp, 'feat-x');
      expect(profile).toBeNull();
    });

    it('builds trend profile from raw events', async () => {
      await appendRawEvent(tmp, makeCommit('2024-01-01T10:00:00Z', 'feat-x', 'a1'));
      await appendRawEvent(tmp, makeCommit('2024-01-02T10:00:00Z', 'feat-x', 'a2'));

      const profile = await buildTrendProfile(tmp, 'feat-x');
      expect(profile).not.toBeNull();
      expect(profile!.changeName).toBe('feat-x');
      expect(profile!.totalCommits).toBe(2);
    });

    it('returns cached profile on second call', async () => {
      await appendRawEvent(tmp, makeCommit('2024-01-01T10:00:00Z', 'feat-x', 'a1'));
      await buildTrendProfile(tmp, 'feat-x');
      const profile2 = await buildTrendProfile(tmp, 'feat-x');
      expect(profile2).not.toBeNull();
    });
  });

  describe('getTrendFreshness', () => {
    it('returns null when no cache exists', async () => {
      const freshness = await getTrendFreshness(tmp, 'feat-x');
      expect(freshness).toBeNull();
    });

    it('returns fresh status after building profile', async () => {
      await appendRawEvent(tmp, makeCommit('2024-01-01T10:00:00Z', 'feat-x', 'a1'));
      await buildTrendProfile(tmp, 'feat-x');
      const freshness = await getTrendFreshness(tmp, 'feat-x');
      expect(freshness).not.toBeNull();
      expect(freshness!.fresh).toBe(true);
    });
  });

  describe('invalidateTrendCache', () => {
    it('returns false when no cache exists', async () => {
      const removed = await invalidateTrendCache(tmp, 'feat-x');
      expect(removed).toBe(false);
    });

    it('removes cache and returns true', async () => {
      await appendRawEvent(tmp, makeCommit('2024-01-01T10:00:00Z', 'feat-x', 'a1'));
      await buildTrendProfile(tmp, 'feat-x');
      const removed = await invalidateTrendCache(tmp, 'feat-x');
      expect(removed).toBe(true);
      const freshness = await getTrendFreshness(tmp, 'feat-x');
      expect(freshness).toBeNull();
    });
  });

  describe('buildPhaseDurationStats', () => {
    it('returns null when no events exist', async () => {
      const stats = await buildPhaseDurationStats(tmp);
      expect(stats).toBeNull();
    });

    it('computes duration stats from phase transitions', async () => {
      await appendRawEvent(tmp, makePhaseTransition('2024-01-01T10:00:00Z', 'feat-x', 'open', 'design'));
      await appendRawEvent(tmp, makePhaseTransition('2024-01-10T10:00:00Z', 'feat-x', 'design', 'build'));

      const stats = await buildPhaseDurationStats(tmp);
      expect(stats).not.toBeNull();
      // design phase should have ~9 days duration
      expect(Object.keys(stats!.phaseDurations).length).toBeGreaterThan(0);
    });
  });

  describe('buildCommonTransitions', () => {
    it('returns empty array when no transitions exist', async () => {
      const transitions = await buildCommonTransitions(tmp);
      expect(transitions).toEqual([]);
    });

    it('counts transitions', async () => {
      await appendRawEvent(tmp, makePhaseTransition('2024-01-01T10:00:00Z', 'feat-x', 'open', 'design'));
      await appendRawEvent(tmp, makePhaseTransition('2024-01-05T10:00:00Z', 'feat-x', 'design', 'build'));

      const transitions = await buildCommonTransitions(tmp);
      expect(transitions.length).toBeGreaterThan(0);
      expect(transitions[0].from).toBe('open');
      expect(transitions[0].to).toBe('design');
    });
  });
});
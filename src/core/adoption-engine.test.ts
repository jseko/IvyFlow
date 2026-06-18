/**
 * Tests for adoption-engine.ts (v0.7).
 *
 * Coverage:
 * - AdoptionProfile computation with mock events
 * - Funnel accuracy
 * - Suggestion impact metrics
 * - Weekly trends
 * - Empty data handling
 * - Confidence annotation correctness
 * - adoption_profile.json TTL caching
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { execFileSync } from 'child_process';

import { computeAdoptionProfile, formatAdoptionProfile } from './adoption-engine.js';
import { appendRawEvent } from './sessions.js';
import { type RawEvent } from './sessions.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-adopt-'));
}

function makeCommit(ts: string, change: string, hash: string, insertions = 10): RawEvent {
  return {
    eventId: `evt_${hash}`,
    event: 'git_commit',
    ts,
    change,
    source: 'git-hook',
    meta: { hash, insertions, deletions: 2 },
  };
}

function makePhaseTransition(ts: string, change: string, to: string): RawEvent {
  return {
    eventId: `evt_pt_${change}_${to}`,
    event: 'phase_transition',
    ts,
    change,
    source: 'validate',
    meta: { from: 'prev', to },
  };
}

describe('computeAdoptionProfile', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
    // Ensure .ivy/sessions/raw exists
    await fs.mkdir(path.join(tmp, '.ivy', 'sessions', 'raw'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  });

  it('returns empty profile when no events exist', async () => {
    const profile = await computeAdoptionProfile(tmp, undefined, 30);
    expect(profile.funnel.totalCommits).toBe(0);
    expect(profile.funnel.totalChanges).toBe(0);
    expect(profile.confidence.overall).toBe('low');
  });

  it('computes correct funnel with commit events', async () => {
    // Two changes, each with commits, one archived
    await appendRawEvent(tmp, makeCommit('2026-06-01T10:00:00Z', 'feat-x', 'a1'));
    await appendRawEvent(tmp, makeCommit('2026-06-02T10:00:00Z', 'feat-x', 'a2'));
    await appendRawEvent(tmp, makeCommit('2026-06-03T10:00:00Z', 'feat-y', 'b1'));
    await appendRawEvent(tmp, makePhaseTransition('2026-06-05T10:00:00Z', 'feat-x', 'archive'));

    const profile = await computeAdoptionProfile(tmp, undefined, 90);
    expect(profile.funnel.totalCommits).toBe(3);
    expect(profile.funnel.totalChanges).toBe(2);
    expect(profile.funnel.completedChanges).toBe(1);
    expect(profile.funnel.completionRate).toBeCloseTo(0.5, 1);
  });

  it('supports change-level filtering', async () => {
    await appendRawEvent(tmp, makeCommit('2026-06-01T10:00:00Z', 'feat-x', 'a1'));
    await appendRawEvent(tmp, makeCommit('2026-06-02T10:00:00Z', 'feat-y', 'b1'));

    const profile = await computeAdoptionProfile(tmp, 'feat-x', 90);
    expect(profile.changeName).toBe('feat-x');
    expect(profile.funnel.totalCommits).toBe(1);
  });

  it('calculates completion rate correctly', async () => {
    await appendRawEvent(tmp, makeCommit('2026-06-01T10:00:00Z', 'feat-x', 'a1'));
    await appendRawEvent(tmp, makePhaseTransition('2026-06-05T10:00:00Z', 'feat-x', 'archive'));
    await appendRawEvent(tmp, makeCommit('2026-06-02T10:00:00Z', 'feat-y', 'b1'));
    await appendRawEvent(tmp, makeCommit('2026-06-03T10:00:00Z', 'feat-z', 'c1'));

    const profile = await computeAdoptionProfile(tmp, undefined, 90);
    expect(profile.funnel.completedChanges).toBe(1);
    expect(profile.funnel.totalChanges).toBe(3);
  });

  it('annotates confidence as medium with sufficient data', async () => {
    // Add 15+ commit events across multiple changes
    for (let i = 0; i < 15; i++) {
      await appendRawEvent(tmp, makeCommit(
        `2026-06-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
        i < 8 ? 'feat-x' : 'feat-y',
        `hash${i}`,
      ));
    }

    const profile = await computeAdoptionProfile(tmp, undefined, 90);
    expect(profile.confidence.overall).toBe('medium');
    expect(profile.confidence.note).toBeTruthy();
  });

  it('includes weekly trend data', async () => {
    // Multiple events across weeks
    await appendRawEvent(tmp, makeCommit('2026-06-01T10:00:00Z', 'feat-x', 'a1')); // Week 23
    await appendRawEvent(tmp, makeCommit('2026-06-08T10:00:00Z', 'feat-x', 'a2')); // Week 24
    await appendRawEvent(tmp, makeCommit('2026-06-15T10:00:00Z', 'feat-x', 'a3')); // Week 25

    const profile = await computeAdoptionProfile(tmp, undefined, 90);
    expect(profile.weeklyTrend.length).toBeGreaterThanOrEqual(2);
  });

  it('produces consistent JSON-format output', async () => {
    await appendRawEvent(tmp, makeCommit('2026-06-01T10:00:00Z', 'feat-x', 'a1'));

    const profile = await computeAdoptionProfile(tmp, undefined, 30);
    const json = JSON.stringify(profile);
    const parsed = JSON.parse(json);
    expect(parsed.funnel.totalCommits).toBe(1);
    expect(parsed.confidence.overall).toBe('low');
  });

  it('caching: returns cached profile within TTL', async () => {
    // First computation
    await appendRawEvent(tmp, makeCommit('2026-06-01T10:00:00Z', 'feat-x', 'a1'));
    const first = await computeAdoptionProfile(tmp, undefined, 30);
    expect(first.funnel.totalCommits).toBe(1);

    // Second call should use cache
    const second = await computeAdoptionProfile(tmp, undefined, 30);
    expect(second.funnel.totalCommits).toBe(1);
  });
});

describe('formatAdoptionProfile', () => {
  it('produces human-readable output', async () => {
    const profile = {
      changeName: 'test',
      periodStart: '2026-06-01T00:00:00.000Z',
      periodEnd: '2026-06-30T00:00:00.000Z',
      funnel: { totalCommits: 10, totalFilesChanged: 5, totalLinesAdded: 1000, totalChanges: 3, completedChanges: 2, completionRate: 0.67 },
      suggestionImpact: { totalSuggestions: 5, acceptedSuggestions: 3, estimatedLinesFromAccepted: 600, avgTimeToResolve: 0 },
      weeklyTrend: [{ week: '2026-06-01', commits: 5, linesAdded: 500, suggestionsAccepted: 2 }],
      confidence: { overall: 'medium' as const, note: 'Based on 10 data points.' },
    };

    const output = formatAdoptionProfile(profile);
    expect(output).toContain('Adoption Analytics');
    expect(output).toContain('67%');
    expect(output).toContain('Total commits:');
    expect(output).toContain('MEDIUM');
  });
});

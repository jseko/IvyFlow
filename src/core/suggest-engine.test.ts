import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import { runSuggestEngine, generateSuggestionId, buildTypeMap, resetSuggestionCounter, type Suggestion } from './suggest-engine.js';
import { appendRawEvent, type RawEvent } from './sessions.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-suggest-'));
}

function phaseEvent(ts: string, change: string, from: string, to: string, hash?: string): RawEvent {
  return {
    eventId: `evt_${hash ?? Math.random().toString(36).slice(2, 6)}`,
    event: 'phase_transition',
    ts,
    change,
    source: 'validate',
    meta: { from, to },
  };
}

function commitEvent(ts: string, change: string, hash: string): RawEvent {
  return {
    eventId: `evt_${hash}`,
    event: 'git_commit',
    ts,
    change,
    source: 'git-hook',
    meta: { hash },
  };
}

describe('generateSuggestionId', () => {
  beforeEach(() => resetSuggestionCounter());

  it('generates unique IDs per type', () => {
    const id1 = generateSuggestionId('stuck');
    const id2 = generateSuggestionId('stuck');
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^sugg_st_\d+$/);
  });

  it('prefixes match suggestion type', () => {
    expect(generateSuggestionId('stuck')).toMatch(/^sugg_st_/);
    expect(generateSuggestionId('phase_review')).toMatch(/^sugg_pr_/);
    expect(generateSuggestionId('rollback_warning')).toMatch(/^sugg_rb_/);
    expect(generateSuggestionId('cleanup')).toMatch(/^sugg_cl_/);
    expect(generateSuggestionId('milestone')).toMatch(/^sugg_ms_/);
  });
});

describe('buildTypeMap', () => {
  it('groups suggestion IDs by type', () => {
    const suggestions = [
      { id: 'sugg_st_01', type: 'stuck' as const, severity: 'critical' as const, change: 'x', message: 'x', confidence: 'high' as const },
      { id: 'sugg_st_02', type: 'stuck' as const, severity: 'critical' as const, change: 'x', message: 'x', confidence: 'high' as const },
      { id: 'sugg_pr_01', type: 'phase_review' as const, severity: 'info' as const, change: 'x', message: 'x', confidence: 'medium' as const },
    ];
    const map = buildTypeMap(suggestions);
    expect(map.stuck).toHaveLength(2);
    expect(map.phase_review).toHaveLength(1);
  });
});

describe('runSuggestEngine', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns empty array when no events exist', async () => {
    const suggestions = await runSuggestEngine(tmp);
    expect(suggestions).toEqual([]);
  });

  it('returns empty when no phase transitions exist', async () => {
    await appendRawEvent(tmp, commitEvent('2024-01-01T10:00:00Z', 'feat-x', 'a1'));
    const suggestions = await runSuggestEngine(tmp);
    expect(suggestions).toEqual([]);
  });

  it('detects stuck change', async () => {
    const day = 24 * 60 * 60 * 1000;
    await appendRawEvent(tmp, phaseEvent(
      new Date(Date.now() - 40 * day).toISOString(), 'feat-x', 'open', 'build',
    ));

    const suggestions = await runSuggestEngine(tmp);
    const stuck = suggestions.filter((s) => s.type === 'stuck');
    expect(stuck.length).toBeGreaterThanOrEqual(1);
    expect(stuck[0].severity).toBe('critical');
    expect(stuck[0].confidence).toBe('high');
  });

  it('detects rollback warnings', async () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    await appendRawEvent(tmp, phaseEvent(new Date(now - 7 * day).toISOString(), 'feat-x', 'design', 'build'));
    await appendRawEvent(tmp, phaseEvent(new Date(now - 6 * day).toISOString(), 'feat-x', 'build', 'design'));
    await appendRawEvent(tmp, phaseEvent(new Date(now - 5 * day).toISOString(), 'feat-x', 'design', 'build'));
    await appendRawEvent(tmp, phaseEvent(new Date(now - 4 * day).toISOString(), 'feat-x', 'build', 'design'));
    await appendRawEvent(tmp, phaseEvent(new Date(now - 3 * day).toISOString(), 'feat-x', 'design', 'build'));
    await appendRawEvent(tmp, phaseEvent(new Date(now - 2 * day).toISOString(), 'feat-x', 'build', 'design'));

    const suggestions = await runSuggestEngine(tmp);
    const rollbacks = suggestions.filter((s) => s.type === 'rollback_warning');
    expect(rollbacks.length).toBeGreaterThanOrEqual(1);
  });

  it('filters by change name', async () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    await appendRawEvent(tmp, phaseEvent(
      new Date(now - 40 * day).toISOString(), 'feat-x', 'open', 'build',
    ));
    await appendRawEvent(tmp, phaseEvent(
      new Date(now - 40 * day).toISOString(), 'feat-y', 'open', 'build',
    ));

    const suggestions = await runSuggestEngine(tmp, { changes: ['feat-x'] });
    const changes = [...new Set(suggestions.map((s) => s.change))];
    expect(changes).toEqual(['feat-x']);
  });

  it('each suggestion has a unique id', async () => {
    const day = 24 * 60 * 60 * 1000;
    await appendRawEvent(tmp, phaseEvent(new Date(Date.now() - 40 * day).toISOString(), 'feat-x', 'open', 'build'));
    await appendRawEvent(tmp, phaseEvent(new Date(Date.now() - 40 * day).toISOString(), 'feat-y', 'open', 'build'));

    const suggestions = await runSuggestEngine(tmp);
    const ids = suggestions.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // TC-5: Phase Review outputs reviewRecommended, NOT suggestedNextPhase
  it('phase_review suggestion has no suggestedNextPhase field', async () => {
    const day = 24 * 60 * 60 * 1000;
    // Create cycle: build→design→build so build has historical avg
    // open→design (50d ago), design→build (40d ago, design=10d),
    // build→design (39d ago, build=1d avg), design→build (10d ago, design=29d)
    // Current: build at 10d > historical build avg 1d → triggers phase review
    await appendRawEvent(tmp, phaseEvent(
      new Date(Date.now() - 50 * day).toISOString(), 'feat-x', 'open', 'design',
    ));
    await appendRawEvent(tmp, phaseEvent(
      new Date(Date.now() - 40 * day).toISOString(), 'feat-x', 'design', 'build',
    ));
    await appendRawEvent(tmp, phaseEvent(
      new Date(Date.now() - 39 * day).toISOString(), 'feat-x', 'build', 'design',
    ));
    await appendRawEvent(tmp, phaseEvent(
      new Date(Date.now() - 10 * day).toISOString(), 'feat-x', 'design', 'build',
    ));

    const suggestions = await runSuggestEngine(tmp);
    const pr = suggestions.find((s) => s.type === 'phase_review');
    expect(pr).toBeDefined();
    expect(pr!.type).toBe('phase_review');
    expect(pr!.severity).toBe('info');
    // Runtime verification: no suggestedNextPhase on the suggestion
    expect((pr as unknown as Record<string, unknown>).suggestedNextPhase).toBeUndefined();
  });

  // TC-14: Phase Review with no data returns null (no suggestion)
  it('phase_review not generated with insufficient data', async () => {
    // Single transition — no historical average to compare against
    await appendRawEvent(tmp, phaseEvent(
      new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), 'feat-x', 'open', 'build',
    ));

    const suggestions = await runSuggestEngine(tmp);
    const pr = suggestions.find((s) => s.type === 'phase_review');
    expect(pr).toBeUndefined();
  });
});
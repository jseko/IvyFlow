import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import { queryChangeMetrics } from './change-metrics.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-metric-'));
}

async function writeRawEvent(cwd: string, event: Record<string, unknown>): Promise<void> {
  const dir = path.join(cwd, '.ivy', 'sessions', 'raw');
  await fs.mkdir(dir, { recursive: true });
  const line = JSON.stringify(event) + '\n';
  await fs.appendFile(path.join(dir, 'events.jsonl'), line, 'utf-8');
}

describe('queryChangeMetrics', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('computes phase_durations from phase_transition events', async () => {
    // Simulate a change with phase transitions: open→design at t0, design→build at t0+3d
    await writeRawEvent(tmp, { ts: '2026-06-01T10:00:00Z', eventId: 'e1', change: 'feat-a', event: 'git_commit', source: 'git-hook' });
    await writeRawEvent(tmp, { ts: '2026-06-01T12:00:00Z', eventId: 'e2', change: 'feat-a', event: 'phase_transition', source: 'hook', meta: { from: 'open', to: 'design' } });
    await writeRawEvent(tmp, { ts: '2026-06-04T12:00:00Z', eventId: 'e3', change: 'feat-a', event: 'phase_transition', source: 'hook', meta: { from: 'design', to: 'build' } });

    const results = await queryChangeMetrics(tmp, 'feat-a', ['phase_durations']);
    expect(results.length).toBeGreaterThan(0);

    // open duration = 2h / 24 = 0.08d, design duration = 3d
    for (const r of results) {
      expect(r.change).toBe('feat-a');
      expect(r.metric).toBe('phase_durations');
      expect(r).toHaveProperty('value');
      expect(r).toHaveProperty('label');
    }
  });

  it('computes commit_frequency from git_commit events', async () => {
    await writeRawEvent(tmp, { ts: '2026-06-01T10:00:00Z', eventId: 'e1', change: 'feat-b', event: 'git_commit', source: 'git-hook' });
    await writeRawEvent(tmp, { ts: '2026-06-01T11:00:00Z', eventId: 'e2', change: 'feat-b', event: 'git_commit', source: 'git-hook' });
    await writeRawEvent(tmp, { ts: '2026-06-01T12:00:00Z', eventId: 'e3', change: 'feat-b', event: 'git_commit', source: 'git-hook' });

    const results = await queryChangeMetrics(tmp, 'feat-b', ['commit_frequency']);
    expect(results).toHaveLength(1);
    expect(results[0].value).toBe(3);
    expect(results[0].label).toContain('3 commits');
  });

  it('detects completed changes via phase_transition to archive', async () => {
    await writeRawEvent(tmp, { ts: '2026-06-01T10:00:00Z', eventId: 'e1', change: 'feat-c', event: 'git_commit', source: 'git-hook' });
    await writeRawEvent(tmp, { ts: '2026-06-10T10:00:00Z', eventId: 'e2', change: 'feat-c', event: 'phase_transition', source: 'hook', meta: { from: 'build', to: 'archive' } });

    const results = await queryChangeMetrics(tmp, 'feat-c', ['completion_rate']);
    expect(results).toHaveLength(1);
    expect(results[0].value).toBe(100);
    expect(results[0].label).toBe('completed');
  });

  it('detects incomplete changes without archive transition', async () => {
    await writeRawEvent(tmp, { ts: '2026-06-01T10:00:00Z', eventId: 'e1', change: 'feat-d', event: 'git_commit', source: 'git-hook' });
    await writeRawEvent(tmp, { ts: '2026-06-05T10:00:00Z', eventId: 'e2', change: 'feat-d', event: 'phase_transition', source: 'hook', meta: { from: 'open', to: 'design' } });

    const results = await queryChangeMetrics(tmp, 'feat-d', ['completion_rate']);
    expect(results).toHaveLength(1);
    expect(results[0].value).toBe(0);
    expect(results[0].label).toBe('in_progress');
  });

  it('returns empty array for no matching events', async () => {
    // Empty events.jsonl
    const results = await queryChangeMetrics(tmp, 'nonexistent', ['phase_durations']);
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(0);
  });

  it('filters by change name correctly with multiple changes', async () => {
    await writeRawEvent(tmp, { ts: '2026-06-01T10:00:00Z', eventId: 'e1', change: 'feat-e', event: 'git_commit', source: 'git-hook' });
    await writeRawEvent(tmp, { ts: '2026-06-01T10:00:00Z', eventId: 'e2', change: 'feat-other', event: 'git_commit', source: 'git-hook' });
    await writeRawEvent(tmp, { ts: '2026-06-01T11:00:00Z', eventId: 'e3', change: 'feat-e', event: 'git_commit', source: 'git-hook' });

    const results = await queryChangeMetrics(tmp, 'feat-e', ['commit_frequency']);
    expect(results).toHaveLength(1);
    expect(results[0].value).toBe(2);
  });

  it('skips unsupported metrics gracefully', async () => {
    await writeRawEvent(tmp, { ts: '2026-06-01T10:00:00Z', eventId: 'e1', change: 'feat-f', event: 'git_commit', source: 'git-hook' });

    const results = await queryChangeMetrics(tmp, 'feat-f', ['active_changes' as any]);
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(0);
  });
});
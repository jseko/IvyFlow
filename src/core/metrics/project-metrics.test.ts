import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import { queryProjectMetrics } from './project-metrics.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-prometric-'));
}

async function writeRawEvent(cwd: string, event: Record<string, unknown>): Promise<void> {
  const dir = path.join(cwd, '.ivy', 'sessions', 'raw');
  await fs.mkdir(dir, { recursive: true });
  const line = JSON.stringify(event) + '\n';
  await fs.appendFile(path.join(dir, 'events.jsonl'), line, 'utf-8');
}

describe('queryProjectMetrics', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('computes completion_rate across changes', async () => {
    // feat-x: completed, feat-y: active
    await writeRawEvent(tmp, { ts: '2026-06-01T10:00:00Z', eventId: 'e1', change: 'feat-x', event: 'git_commit', source: 'git-hook' });
    await writeRawEvent(tmp, { ts: '2026-06-10T10:00:00Z', eventId: 'e2', change: 'feat-x', event: 'phase_transition', source: 'hook', meta: { from: 'build', to: 'archive' } });
    await writeRawEvent(tmp, { ts: '2026-06-05T10:00:00Z', eventId: 'e3', change: 'feat-y', event: 'git_commit', source: 'git-hook' });

    const results = await queryProjectMetrics(tmp, ['completion_rate']);
    expect(results.length).toBeGreaterThan(0);

    const featX = results.find(r => r.change === 'feat-x');
    const featY = results.find(r => r.change === 'feat-y');
    expect(featX?.value).toBe(100);
    expect(featY?.value).toBe(0);
  });

  it('computes commit_frequency across all changes', async () => {
    await writeRawEvent(tmp, { ts: '2026-06-01T10:00:00Z', eventId: 'e1', change: 'feat-a', event: 'git_commit', source: 'git-hook' });
    await writeRawEvent(tmp, { ts: '2026-06-01T11:00:00Z', eventId: 'e2', change: 'feat-b', event: 'git_commit', source: 'git-hook' });
    await writeRawEvent(tmp, { ts: '2026-06-01T12:00:00Z', eventId: 'e3', change: 'feat-a', event: 'git_commit', source: 'git-hook' });

    const results = await queryProjectMetrics(tmp, ['commit_frequency']);
    expect(results).toHaveLength(1);
    expect(results[0].value).toBe(3);
  });

  it('computes active_changes correctly', async () => {
    await writeRawEvent(tmp, { ts: '2026-06-01T10:00:00Z', eventId: 'e1', change: 'done', event: 'phase_transition', source: 'hook', meta: { from: 'build', to: 'archive' } });
    await writeRawEvent(tmp, { ts: '2026-06-05T10:00:00Z', eventId: 'e2', change: 'wip', event: 'git_commit', source: 'git-hook' });

    const results = await queryProjectMetrics(tmp, ['active_changes']);
    expect(results).toHaveLength(1);
    expect(results[0].label).toContain('1 active');
    expect(results[0].label).toContain('1 completed');
  });

  it('returns empty array for empty events', async () => {
    const results = await queryProjectMetrics(tmp, ['completion_rate']);
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(0);
  });

  it('skips unsupported metrics gracefully', async () => {
    const results = await queryProjectMetrics(tmp, ['bottleneck_phases' as unknown as 'active_changes']);
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(0);
  });
});
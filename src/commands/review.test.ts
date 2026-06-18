import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import { runReview, type ReviewOptions } from './review.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-review-'));
}

describe('runReview', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns 0 when no pending suggestions', async () => {
    const code = await runReview({ cwd: tmp });
    expect(code).toBe(0);
  });

  it('returns JSON output with --json flag', async () => {
    const code = await runReview({ cwd: tmp, json: true });
    expect(code).toBe(0);
    // JSON output goes to console — we just verify exit code
  });

  it('handles --auto accept gracefully', async () => {
    const code = await runReview({ cwd: tmp, auto: true, autoAction: 'accept' });
    expect(code).toBe(0);
  });

  it('handles --auto snooze with custom days', async () => {
    const code = await runReview({ cwd: tmp, auto: true, autoAction: 'snooze', snoozeDays: 14 });
    expect(code).toBe(0);
  });
});

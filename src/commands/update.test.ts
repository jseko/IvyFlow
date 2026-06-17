import { describe, it, expect, vi, beforeEach } from 'vitest';

import { runUpdate } from './update.js';

describe('runUpdate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  function mockFetch(version: string | null) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: version !== null,
      json: async () => ({ version }),
    } as Response);
  }

  it('returns 0 when up to date', async () => {
    mockFetch('0.2.0-rc.1');
    const exitCode = await runUpdate({ check: false });
    expect(exitCode).toBe(0);
  });

  it('returns 1 with --check when update available', async () => {
    mockFetch('99.0.0');
    const exitCode = await runUpdate({ check: true });
    expect(exitCode).toBe(1);
  });

  it('returns 0 on network failure (offline graceful)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error'));
    const exitCode = await runUpdate({ check: false });
    expect(exitCode).toBe(0);
  });
});

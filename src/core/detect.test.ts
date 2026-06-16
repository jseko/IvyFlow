import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import { detectPlatform } from './detect.js';

describe('detectPlatform', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-detect-'));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns claude with detected=false when .claude is absent', async () => {
    const { platform, detected } = await detectPlatform(tmp);
    expect(platform.id).toBe('claude');
    expect(detected).toBe(false);
  });

  it('returns claude with detected=true when .claude exists', async () => {
    await fs.mkdir(path.join(tmp, '.claude'), { recursive: true });
    const { platform, detected } = await detectPlatform(tmp);
    expect(platform.id).toBe('claude');
    expect(detected).toBe(true);
  });
});

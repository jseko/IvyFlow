import { describe, it, expect } from 'vitest';
import { getLocalVersion } from './version.js';

describe('getLocalVersion', () => {
  it('returns a non-empty semver string', () => {
    const v = getLocalVersion();
    expect(v).toBeTruthy();
    expect(v).toMatch(/^\d+\.\d+\.\d+/);
  });
});

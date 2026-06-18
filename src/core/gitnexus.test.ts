import { describe, it, expect } from 'vitest';

import { isGitNexusInstalled, queryGitNexusOverlay } from './gitnexus.js';

describe('isGitNexusInstalled', () => {
  it('returns a boolean (does not throw)', async () => {
    const result = await isGitNexusInstalled();
    expect(typeof result).toBe('boolean');
  });
});

describe('queryGitNexusOverlay', () => {
  it('returns graceful error when gitnexus is installed but no project context', async () => {
    // This should work whether gitnexus is installed or not
    const result = await queryGitNexusOverlay('/nonexistent-path', 'test-change');
    expect(result).toHaveProperty('visible');
    expect(result).toHaveProperty('risk');
    expect(result).toHaveProperty('affectedProcesses');
    expect(result).toHaveProperty('affectedModules');
  });

  it('does not throw regardless of gitnexus state', async () => {
    let error: Error | undefined;
    try {
      await queryGitNexusOverlay('/tmp', 'test-change');
    } catch (err) {
      error = err as Error;
    }
    expect(error).toBeUndefined();
  });
});
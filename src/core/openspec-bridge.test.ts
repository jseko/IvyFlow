import { describe, it, expect } from 'vitest';
import { OpenSpecBridge } from './openspec-bridge.js';

describe('OpenSpecBridge', () => {
  it('translateEvent proposed returns design recommendation', async () => {
    const bridge = new OpenSpecBridge({ changeName: 'test', cwd: '/' });
    const rec = await bridge.translateEvent('proposed', 'my-change');
    expect(rec.target).toBe('design');
    expect(rec.command).toContain('ivy state set design');
  });

  it('translateEvent applied returns verify recommendation', async () => {
    const bridge = new OpenSpecBridge({ changeName: 'test', cwd: '/' });
    const rec = await bridge.translateEvent('applied', 'my-change');
    expect(rec.target).toBe('verify');
    expect(rec.command).toContain('ivy state set verify');
  });

  it('translateEvent archived returns archive recommendation', async () => {
    const bridge = new OpenSpecBridge({ changeName: 'test', cwd: '/' });
    const rec = await bridge.translateEvent('archived', 'my-change');
    expect(rec.target).toBe('archive');
  });

  it('recommendPhase does not throw', async () => {
    const bridge = new OpenSpecBridge({ changeName: 'test', cwd: '/' });
    await expect(
      bridge.recommendPhase({ target: 'design', message: 'test', command: 'ivy state set design' }),
    ).resolves.toBeUndefined();
  });

  it('recommendPhase with empty command works', async () => {
    const bridge = new OpenSpecBridge({ changeName: 'test', cwd: '/' });
    await expect(
      bridge.recommendPhase({ target: 'archive', message: 'done', command: '' }),
    ).resolves.toBeUndefined();
  });
});

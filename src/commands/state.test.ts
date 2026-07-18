/**
 * Tests for `ivy state set <field> <value>` / `ivy state get <field>` —
 * the generic workflow-field setter that fixes P0-2 (guard fields previously
 * had no writer, so build/verify hard guards could never pass).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import { runState } from './state.js';
import { readState, writeState, createInitialState } from '../core/lifecycle-projection.js';

const CHANGE = 'p0-2-change';

async function setup(): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-state-test-'));
  // runState requires `.ivy/project.yaml`
  await fs.mkdir(path.join(tmpDir, '.ivy'), { recursive: true });
  await fs.writeFile(path.join(tmpDir, '.ivy', 'project.yaml'), 'version: 1\n');
  // initialise a change state (open)
  await writeState(tmpDir, createInitialState(CHANGE), CHANGE);
  return tmpDir;
}

describe('ivy state set/get workflow fields (P0-2)', () => {
  let tmpDir: string;
  beforeEach(async () => {
    tmpDir = await setup();
  });
  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('writes isolation and persists it (read back via serializer)', async () => {
    const code = await runState({ command: 'set', checkpoint: 'isolation', value: 'branch', change: CHANGE, cwd: tmpDir });
    expect(code).toBe(0);

    const state = await readState(tmpDir, CHANGE);
    expect(state).not.toBeNull();
    expect((state as any).isolation).toBe('branch');
  });

  it('writes build_mode and verification_report/branch_status', async () => {
    expect(await runState({ command: 'set', checkpoint: 'build_mode', value: 'full', change: CHANGE, cwd: tmpDir })).toBe(0);
    expect(await runState({ command: 'set', checkpoint: 'verification_report', value: 'reports/verify.md', change: CHANGE, cwd: tmpDir })).toBe(0);
    expect(await runState({ command: 'set', checkpoint: 'branch_status', value: 'handled', change: CHANGE, cwd: tmpDir })).toBe(0);

    const state = await readState(tmpDir, CHANGE);
    expect((state as any).build_mode).toBe('full');
    expect((state as any).verification_report).toBe('reports/verify.md');
    expect((state as any).branch_status).toBe('handled');
  });

  it('coerces boolean fields (archived) to real booleans', async () => {
    expect(await runState({ command: 'set', checkpoint: 'archived', value: 'true', change: CHANGE, cwd: tmpDir })).toBe(0);
    const state = await readState(tmpDir, CHANGE);
    expect((state as any).archived).toBe(true);
  });

  it('rejects invalid isolation values', async () => {
    const code = await runState({ command: 'set', checkpoint: 'isolation', value: 'foobar', change: CHANGE, cwd: tmpDir });
    expect(code).toBe(1);
    const state = await readState(tmpDir, CHANGE);
    expect((state as any).isolation).toBeUndefined();
  });

  it('reads a field with get', async () => {
    await runState({ command: 'set', checkpoint: 'build_mode', value: 'full', change: CHANGE, cwd: tmpDir });
    const code = await runState({ command: 'get', field: 'build_mode', change: CHANGE, cwd: tmpDir });
    expect(code).toBe(0);
  });

  it('auto-initialises state when setting a field with no prior state', async () => {
    const fresh = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-state-fresh-'));
    await fs.mkdir(path.join(fresh, '.ivy'), { recursive: true });
    await fs.writeFile(path.join(fresh, '.ivy', 'project.yaml'), 'version: 1\n');
    const code = await runState({ command: 'set', checkpoint: 'isolation', value: 'worktree', change: 'brand-new', cwd: fresh });
    expect(code).toBe(0);
    const state = await readState(fresh, 'brand-new');
    expect(state).not.toBeNull();
    expect(state!.checkpoint).toBe('open');
    expect((state as any).isolation).toBe('worktree');
    await fs.rm(fresh, { recursive: true, force: true });
  });
});

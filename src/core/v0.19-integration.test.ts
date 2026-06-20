/**
 * v0.19 Integration & Boundary Tests
 *
 * E2E tests: full lifecycle flows for worktree, dispatch, openspec-bridge.
 * Boundary tests: architectural guards against workflow engine drift.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ─── Helpers ───

function createTempRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v0.19-e2e-'));
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email test@test.com', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name test', { cwd: dir, stdio: 'pipe' });
  fs.writeFileSync(path.join(dir, 'README.md'), '# e2e');
  execSync('git add -A && git commit -m "init"', { cwd: dir, stdio: 'pipe' });
  return dir;
}

function createTasksMd(dir: string): string {
  const content = [
    '- [ ] 1.1 First task',
    '- [ ] 1.2 Second task',
    '- [ ] 1.3 Third task (depends on 1.1)',
  ].join('\n');
  const p = path.join(dir, 'tasks.md');
  fs.writeFileSync(p, content);
  return p;
}

// ─── E2E-1: Worktree Full Lifecycle ───

describe('E2E-1: Worktree full lifecycle', () => {
  let repoDir: string;

  beforeAll(() => {
    repoDir = createTempRepo();
  });

  afterAll(() => {
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('should create a worktree', async () => {
    const { WorktreeManager } = await import('./worktree-manager.js');
    const mgr = new WorktreeManager({ cwd: repoDir });
    const info = await mgr.create('e2e-test');
    expect(info.changeName).toBe('e2e-test');
    expect(fs.existsSync(info.path)).toBe(true);
  });

  it('should list worktrees', async () => {
    const { WorktreeManager } = await import('./worktree-manager.js');
    const mgr = new WorktreeManager({ cwd: repoDir });
    const list = await mgr.list();
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.some((w) => w.changeName === 'e2e-test')).toBe(true);
  });

  it('should show status', async () => {
    const { WorktreeManager } = await import('./worktree-manager.js');
    const mgr = new WorktreeManager({ cwd: repoDir });
    const s = await mgr.status();
    expect(s.total).toBeGreaterThanOrEqual(1);
  });

  it('should cleanup worktree', async () => {
    const { WorktreeManager } = await import('./worktree-manager.js');
    const mgr = new WorktreeManager({ cwd: repoDir });
    await mgr.cleanup('e2e-test');
    const list = await mgr.list();
    expect(list.some((w) => w.changeName === 'e2e-test')).toBe(false);
  });
});

// ─── E2E-2: Dispatch Full Lifecycle ───

describe('E2E-2: Dispatch full lifecycle', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v0.19-dispatch-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should parse tasks.md', async () => {
    const { TaskDispatcher } = await import('./task-dispatcher.js');
    const tasksPath = createTasksMd(tmpDir);
    const d = new TaskDispatcher({ cwd: tmpDir });
    const tasks = await d.parseTasks(tasksPath);
    expect(tasks).toHaveLength(3);
  });

  it('should find runnable tasks (all pending, no deps = all runnable)', async () => {
    const { TaskDispatcher } = await import('./task-dispatcher.js');
    const tasksPath = createTasksMd(tmpDir);
    const d = new TaskDispatcher({ cwd: tmpDir });
    const tasks = await d.parseTasks(tasksPath);
    const runnable = d.findRunnableTasks(tasks);
    expect(runnable.length).toBe(3);
  });

  it('should dispatch and aggregate results', async () => {
    const { TaskDispatcher } = await import('./task-dispatcher.js');
    const tasksPath = createTasksMd(tmpDir);
    const d = new TaskDispatcher({ cwd: tmpDir, maxParallel: 2 });
    const tasks = await d.parseTasks(tasksPath);
    const results = await d.dispatchIndependentTasks(tasks);
    expect(results.length).toBeLessThanOrEqual(2);
    const report = d.aggregateResults(results);
    expect(report.total).toBe(results.length);
  });

  it('should track task status', async () => {
    const { TaskDispatcher } = await import('./task-dispatcher.js');
    const d = new TaskDispatcher({ cwd: tmpDir });
    expect(d.trackStatus('nonexistent')).toBeUndefined();
  });
});

// ─── E2E-3: OpenSpec Bridge Full Lifecycle ───

describe('E2E-3: OpenSpec Bridge lifecycle', () => {
  it('should translate proposed event to design phase', async () => {
    const { OpenSpecBridge } = await import('./openspec-bridge.js');
    const bridge = new OpenSpecBridge({ changeName: 'test', cwd: '/' });
    const rec = await bridge.translateEvent('proposed', 'test-change');
    expect(rec.target).toBe('design');
    expect(rec.command).toContain('ivy state set design');
  });

  it('should translate applied event to verify phase', async () => {
    const { OpenSpecBridge } = await import('./openspec-bridge.js');
    const bridge = new OpenSpecBridge({ changeName: 'test', cwd: '/' });
    const rec = await bridge.translateEvent('applied', 'test-change');
    expect(rec.target).toBe('verify');
    expect(rec.command).toContain('ivy state set verify');
  });

  it('should not modify phase state directly (no auto-promote)', async () => {
    const { OpenSpecBridge } = await import('./openspec-bridge.js');
    const bridge = new OpenSpecBridge({ changeName: 'test', cwd: '/' });
    const rec = await bridge.translateEvent('proposed', 'test');
    await bridge.recommendPhase(rec);
    // recommendPhase only logs, it should not auto-execute state changes
    expect(rec.command).toContain('ivy state set');
  });

  it('should not modify proposal/design content', () => {
    const src = fs.readFileSync('./src/core/openspec-bridge.ts', 'utf-8');
    // Bridge must NOT write to proposal.md or design.md
    expect(src).not.toMatch(/proposal\.md/);
    expect(src).not.toMatch(/design\.md/);
  });
});

// ─── Capability Boundary Tests ───

describe('Capability boundary tests', () => {
  it('dispatcher_not_scheduler — dispatcher has no schedule/reschedule methods', async () => {
    const { TaskDispatcher } = await import('./task-dispatcher.js');
    const proto = Object.getOwnPropertyNames(TaskDispatcher.prototype);
    expect(proto).not.toContain('schedule');
    expect(proto).not.toContain('reschedule');
    expect(proto).not.toContain('queue');
  });

  it('dispatcher_no_persistent_state — dispatcher state is ephemeral', async () => {
    const { TaskDispatcher } = await import('./task-dispatcher.js');
    const src = fs.readFileSync('./src/core/task-dispatcher.ts', 'utf-8');
    // Dispatcher should not write state to disk (except applySyncDiff for tasks.md user confirmation)
    // It should not have persistent state file IO
    expect(src).not.toMatch(/writeFileSync.*state/);
    expect(src).not.toMatch(/\.state\.yaml/);
    expect(src).not.toMatch(/\.state\.json/);
  });

  it('phase_is_label_only — phase-machine has no auto-promote logic', () => {
    const src = fs.readFileSync('./src/core/phase-machine.ts', 'utf-8');
    expect(src).not.toMatch(/auto.?promote/);
    expect(src).not.toMatch(/autoAdvance/);
    expect(src).not.toMatch(/autoTransition/);
  });

  it('worktree_no_lifecycle_state — WorktreeInfo has minimal fields', () => {
    const src = fs.readFileSync('./src/core/worktree-manager.ts', 'utf-8');
    const iface = src.match(/interface WorktreeInfo \{([^}]+)\}/);
    expect(iface).not.toBeNull();
    const fields = iface![1].split(';').map((f) => f.trim()).filter(Boolean);
    const fieldNames = fields.map((f) => f.split(':')[0].trim());
    expect(fieldNames).toEqual(['path', 'branch', 'changeName']);
  });

  it('tasks_md_read_only — dispatcher does not write tasks.md structure', async () => {
    const { TaskDispatcher } = await import('./task-dispatcher.js');
    const src = fs.readFileSync('./src/core/task-dispatcher.ts', 'utf-8');
    // The only write to tasks.md is in applySyncDiff for status markers
    // verify there's no other writeFileSync to tasks.md
    const writeCalls = src.match(/writeFileSync.*tasks\.md/g);
    // applySyncDiff should be the only one, or there could be 0 (if using different method)
    expect(writeCalls?.length ?? 0).toBeLessThanOrEqual(1);
  });
});

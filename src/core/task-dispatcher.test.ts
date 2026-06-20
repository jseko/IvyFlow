import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { TaskDispatcher } from './task-dispatcher.js';

function writeTasks(dir: string, content: string): string {
  const p = path.join(dir, 'tasks.md');
  fs.writeFileSync(p, content);
  return p;
}

describe('TaskDispatcher', () => {
  it('parseTasks reads tasks from markdown', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'td-test-'));
    const p = writeTasks(dir, '- [ ] 1.1 First task\n- [x] 1.2 Done task\n');
    const d = new TaskDispatcher({ cwd: dir });
    const tasks = await d.parseTasks(p);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].id).toBe('1.1');
    expect(tasks[0].status).toBe('pending');
    expect(tasks[1].id).toBe('1.2');
  });

  it('findRunnableTasks returns pending tasks with no blockers', () => {
    const d = new TaskDispatcher({ cwd: '/' });
    const tasks = [
      { id: '1', subject: 'a', description: '', status: 'pending' as const, blocks: [], blockedBy: [] },
      { id: '2', subject: 'b', description: '', status: 'pending' as const, blocks: ['1'], blockedBy: ['1'] },
    ];
    const runnable = d.findRunnableTasks(tasks);
    expect(runnable).toEqual(['1']);
  });

  it('dispatchIndependentTasks respects maxParallel cap', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'td-test-'));
    const d = new TaskDispatcher({ cwd: dir, maxParallel: 1 });
    const tasks = [
      { id: '1', subject: 'a', description: '', status: 'pending' as const, blocks: [], blockedBy: [] },
      { id: '2', subject: 'b', description: '', status: 'pending' as const, blocks: [], blockedBy: [] },
    ];
    const results = await d.dispatchIndependentTasks(tasks);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('trackStatus returns undefined for unknown task', () => {
    const d = new TaskDispatcher({ cwd: '/' });
    expect(d.trackStatus('nope')).toBeUndefined();
  });

  it('aggregateResults produces correct report', () => {
    const d = new TaskDispatcher({ cwd: '/' });
    const results = [
      { taskId: '1', success: true, output: 'ok', durationMs: 100 },
      { taskId: '2', success: false, error: 'fail', durationMs: 50 },
    ];
    const r = d.aggregateResults(results);
    expect(r.total).toBe(2);
    expect(r.completed).toBe(1);
    expect(r.failed).toBe(1);
  });

  it('getSyncDiff returns accumulated diffs', () => {
    const d = new TaskDispatcher({ cwd: '/' });
    expect(d.getSyncDiff()).toEqual([]);
  });

  it('parseTasks returns empty array for no tasks', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'td-test-'));
    const p = writeTasks(dir, '# Just a header\n');
    const d = new TaskDispatcher({ cwd: dir });
    const tasks = await d.parseTasks(p);
    expect(tasks).toEqual([]);
  });
});

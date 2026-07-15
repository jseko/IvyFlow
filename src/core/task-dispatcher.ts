import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

export interface Task {
  id: string;
  subject: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  blocks: string[];
  blockedBy: string[];
  owner?: string;
  result?: string;
  error?: string;
  durationMs?: number;
}

export interface DispatchResult {
  taskId: string;
  success: boolean;
  output?: string;
  error?: string;
  durationMs: number;
}

export interface DispatchReport {
  total: number;
  completed: number;
  failed: number;
  durationMs: number;
  results: DispatchResult[];
}

export interface SyncDiffEntry {
  taskId: string;
  from: string;
  to: string;
}

export interface TaskDispatcherOptions {
  maxParallel?: number;
  timeout?: number;
  cwd: string;
}

const TASK_RE = /^-\s+\[( |x|~|!)\]\s+(\S+)\s+(.+)$/m;

function parseStatusChar(ch: string): Task['status'] {
  if (ch === 'x') return 'completed';
  if (ch === '~') return 'in_progress';
  if (ch === '!') return 'failed';
  return 'pending';
}

export class TaskDispatcher {
  private maxParallel: number;
  private timeout: number;
  private cwd: string;
  private tasks: Map<string, Task> = new Map();
  private syncDiff: SyncDiffEntry[] = [];

  constructor(opts: TaskDispatcherOptions) {
    this.maxParallel = Math.min(opts.maxParallel ?? 4, 4);
    this.timeout = opts.timeout ?? 300_000;
    this.cwd = opts.cwd;
  }

  async parseTasks(tasksPath: string): Promise<Task[]> {
    const content = fs.readFileSync(tasksPath, 'utf-8');
    const parsed: Task[] = [];
    const lines = content.split('\n');
    let currentId = '';
    let currentSubject = '';

    for (const line of lines) {
      const m = line.match(TASK_RE);
      if (m) {
        if (currentId) {
          parsed.push(this.buildTask(currentId, currentSubject));
        }
        currentId = m[2];
        currentSubject = m[3];
      }
    }
    if (currentId) {
      parsed.push(this.buildTask(currentId, currentSubject));
    }

    this.tasks.clear();
    for (const t of parsed) {
      this.tasks.set(t.id, t);
    }
    return parsed;
  }

  private buildTask(id: string, subject: string): Task {
    return {
      id,
      subject,
      description: subject,
      status: 'pending',
      blocks: [],
      blockedBy: [],
    };
  }

  findRunnableTasks(tasks: Task[]): string[] {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    return tasks
      .filter((t) => {
        if (t.status !== 'pending') return false;
        return t.blockedBy.every((dep) => {
          const depTask = taskMap.get(dep);
          return depTask && depTask.status === 'completed';
        });
      })
      .map((t) => t.id);
  }

  async dispatchIndependentTasks(tasks: Task[]): Promise<DispatchResult[]> {
    const runnableIds = this.findRunnableTasks(tasks);
    const toRun = tasks.filter((t) => runnableIds.includes(t.id));
    const batch = toRun.slice(0, this.maxParallel);
    const results: DispatchResult[] = [];

    for (const task of batch) {
      const t = this.tasks.get(task.id);
      if (t) t.status = 'in_progress';
      const start = Date.now();

      try {
        const output = `Task ready: ${task.id} — ${task.subject}`;
        const elapsed = Date.now() - start;
        if (t) { t.status = 'completed'; t.result = output; t.durationMs = elapsed; }
        this.syncDiff.push({ taskId: task.id, from: 'pending', to: 'completed' });
        results.push({ taskId: task.id, success: true, output, durationMs: elapsed });
      } catch (err) {
        const elapsed = Date.now() - start;
        const msg = (err as Error).message;
        if (t) { t.status = 'failed'; t.error = msg; t.durationMs = elapsed; }
        results.push({ taskId: task.id, success: false, error: msg, durationMs: elapsed });
      }
    }

    return results;
  }

  /** @deprecated — task execution is delegated to AI Agent via Skill instructions */
  private runTask(_task: Task): Promise<string> {
    return Promise.resolve('');
  }

  trackStatus(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  aggregateResults(results: DispatchResult[]): DispatchReport {
    return {
      total: results.length,
      completed: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      durationMs: results.reduce((a, r) => a + r.durationMs, 0),
      results,
    };
  }

  getSyncDiff(): SyncDiffEntry[] {
    return [...this.syncDiff];
  }

  async applySyncDiff(cwd: string, tasksPath: string): Promise<void> {
    const content = fs.readFileSync(tasksPath, 'utf-8');
    let updated = content;
    for (const entry of this.syncDiff) {
      const fromStr = `- [${entry.from === 'completed' ? 'x' : ' '}] ${entry.taskId}`;
      const toStr = `- [${entry.to === 'completed' ? 'x' : ' '}] ${entry.taskId}`;
      updated = updated.replace(fromStr, toStr);
    }
    fs.writeFileSync(tasksPath, updated);
    this.syncDiff = [];
    logger.success('tasks.md status updated');
  }
}

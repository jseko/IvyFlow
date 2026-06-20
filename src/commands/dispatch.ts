import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger.js';
import { fileExists } from '../utils/fs.js';
import { TaskDispatcher, type Task } from '../core/task-dispatcher.js';
import { OpenSpecBridge } from '../core/openspec-bridge.js';

export interface DispatchOptions {
  tasks?: string;
  parallel?: number;
  cwd?: string;
  recommend?: boolean;
  recommendPhase?: boolean;
}

interface DispatchStatusOptions {
  tasks?: string;
  cwd?: string;
}

interface SyncStatusOptions {
  apply?: boolean;
  tasks?: string;
  cwd?: string;
}

function resolveTasksPath(cwd: string, tasksArg?: string): string | null {
  const candidates = tasksArg
    ? [path.resolve(cwd, tasksArg)]
    : [
        path.join(cwd, 'tasks.md'),
        path.join(cwd, 'openspec', 'changes', 'tasks.md'),
      ];
  return candidates.find((p) => fileExists(p)) ?? null;
}

export async function runDispatch(opts: DispatchOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const tasksPath = resolveTasksPath(cwd, opts.tasks);
  if (!tasksPath) {
    logger.error('No tasks.md found. Specify with --tasks.');
    return 1;
  }

  const dispatcher = new TaskDispatcher({ cwd, maxParallel: opts.parallel ?? 4 });
  const tasks = await dispatcher.parseTasks(tasksPath);
  if (tasks.length === 0) {
    logger.info('No tasks found in tasks.md.');
    return 0;
  }

  // ── Recommend mode: show runnable tasks without executing ──
  if (opts.recommend) {
    return recommendTasks(cwd, dispatcher, tasks, tasksPath);
  }

  // ── Normal dispatch ──
  logger.header(`Task Dispatch — ${tasks.length} tasks`);
  logger.divider();

  const runnable = dispatcher.findRunnableTasks(tasks);
  if (runnable.length === 0) {
    logger.info('No runnable tasks (all pending tasks have unresolved dependencies).');
    return 0;
  }

  logger.info(`Dispatching ${runnable.length} task(s) (max parallel: ${opts.parallel ?? 4})...`);
  const results = await dispatcher.dispatchIndependentTasks(tasks);
  const report = dispatcher.aggregateResults(results);

  logger.success(`Completed: ${report.completed}, Failed: ${report.failed}`);
  logger.info(`Duration: ${report.durationMs}ms`);

  const syncDiff = dispatcher.getSyncDiff();
  if (syncDiff.length > 0) {
    logger.info('');
    logger.info('Pending status updates:');
    for (const entry of syncDiff) {
      logger.info(`  ${entry.taskId}: ${entry.from} → ${entry.to}`);
    }
    logger.info('');
    logger.info('Run `ivy dispatch sync-status --apply` to apply.');
  }

  // ── Recommend phase mode: suggest next phase if all tasks done ──
  if (opts.recommendPhase) {
    await recommendNextPhase(cwd, tasks);
  }

  return report.failed > 0 ? 1 : 0;
}

// ─── Recommend helpers ───

async function recommendTasks(
  cwd: string,
  dispatcher: TaskDispatcher,
  tasks: Task[],
  tasksPath: string,
): Promise<number> {
  const runnable = dispatcher.findRunnableTasks(tasks);

  logger.header('Task Recommendation');
  logger.divider();

  if (runnable.length === 0) {
    logger.info('  No runnable tasks currently available.');
    logger.info('  All pending tasks have unresolved dependencies.');
    return 0;
  }

  logger.info(`  ${runnable.length} task(s) ready to dispatch:`);
  for (const id of runnable) {
    const task = tasks.find((t) => t.id === id);
    if (task) {
      logger.info(`    ${id}: ${task.subject}`);
    }
  }

  logger.info('');
  logger.info('  To execute these tasks, run:');
  logger.info(`    ivy dispatch --tasks "${tasksPath}"`);
  logger.info('');
  logger.info('  (Recommend mode: no tasks were executed.)');

  return 0;
}

async function recommendNextPhase(cwd: string, tasks: Task[]): Promise<void> {
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const total = tasks.length;

  logger.header('Phase Recommendation');
  logger.divider();

  if (completed < total) {
    logger.info(`  Progress: ${completed}/${total} tasks complete.`);
    logger.info('  Not all tasks are done — phase promotion not recommended yet.');
    return;
  }

  logger.info(`  All ${total} tasks complete!`);
  logger.info('');

  // Use OpenSpecBridge to suggest next phase
  // Infer change name from tasks.md location pattern: openspec/changes/<name>/tasks.md
  const changeName = inferChangeNameFromTasksPath(cwd);
  if (changeName) {
    const bridge = new OpenSpecBridge({ changeName, cwd });
    const rec = await bridge.translateEvent('applied', changeName);
    await bridge.recommendPhase(rec);
  } else {
    logger.info('  Run `ivy state set verify` to advance to VERIFY phase.');
  }
}

function inferChangeNameFromTasksPath(cwd: string): string | null {
  // Try: openspec/changes/<name>/tasks.md
  const changesDir = path.join(cwd, 'openspec', 'changes');
  if (fs.existsSync(changesDir)) {
    try {
      const entries = fs.readdirSync(changesDir);
      for (const entry of entries) {
        if (entry.startsWith('.')) continue;
        const tasksMd = path.join(changesDir, entry, 'tasks.md');
        if (fs.existsSync(tasksMd)) return entry;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export async function runDispatchStatus(opts: DispatchStatusOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const tasksPath = resolveTasksPath(cwd, opts.tasks);
  if (!tasksPath) {
    logger.error('No tasks.md found.');
    return 1;
  }

  const dispatcher = new TaskDispatcher({ cwd });
  const tasks = await dispatcher.parseTasks(tasksPath);

  logger.header('Task Status');
  logger.divider();

  const counts = { pending: 0, in_progress: 0, completed: 0, failed: 0 };
  for (const t of tasks) {
    if (t.status === 'pending') counts.pending++;
    else if (t.status === 'in_progress') counts.in_progress++;
    else if (t.status === 'completed') counts.completed++;
    else if (t.status === 'failed') counts.failed++;
  }

  logger.info(`  Pending:      ${counts.pending}`);
  logger.info(`  In Progress:  ${counts.in_progress}`);
  logger.info(`  Completed:    ${counts.completed}`);
  logger.info(`  Failed:       ${counts.failed}`);
  logger.info(`  Total:        ${tasks.length}`);

  return 0;
}

export async function runDispatchSyncStatus(opts: SyncStatusOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const tasksPath = resolveTasksPath(cwd, opts.tasks);
  if (!tasksPath) {
    logger.error('No tasks.md found.');
    return 1;
  }

  const dispatcher = new TaskDispatcher({ cwd });
  await dispatcher.parseTasks(tasksPath);
  const diff = dispatcher.getSyncDiff();

  if (diff.length === 0) {
    logger.info('No pending status updates.');
    return 0;
  }

  if (!opts.apply) {
    logger.header('Pending Status Updates');
    logger.divider();
    for (const entry of diff) {
      logger.info(`  ${entry.taskId}: ${entry.from} → ${entry.to}`);
    }
    logger.info('');
    logger.info('Run `ivy dispatch sync-status --apply` to apply these changes.');
    return 0;
  }

  await dispatcher.applySyncDiff(cwd, tasksPath);
  logger.success('tasks.md status updated.');
  return 0;
}

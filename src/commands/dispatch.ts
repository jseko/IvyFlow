import path from 'path';
import { logger } from '../utils/logger.js';
import { fileExists } from '../utils/fs.js';
import { TaskDispatcher, type Task } from '../core/task-dispatcher.js';

export interface DispatchOptions {
  tasks?: string;
  parallel?: number;
  cwd?: string;
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

  return report.failed > 0 ? 1 : 0;
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

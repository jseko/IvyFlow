import { select } from '@inquirer/prompts';
import { logger } from '../utils/logger.js';
import {
  createPipeline,
  readPipeline,
  completeStage,
  blockStage,
  retryStage,
  getDownstreamChoices,
  formatPipelineStatus,
} from '../core/pipeline.js';

export async function runPipelineStart(name: string, cwd?: string): Promise<number> {
  const projectPath = cwd ?? process.cwd();
  try {
    const pipeline = await createPipeline(projectPath, name);
    logger.info(formatPipelineStatus(pipeline));
    logger.info(`当前角色: ${pipeline.stages[0].role}（使用对应命令开始工作流）`);
    return 0;
  } catch (err) {
    logger.error((err as Error).message);
    return 1;
  }
}

export async function runPipelineStatus(cwd?: string): Promise<number> {
  const projectPath = cwd ?? process.cwd();
  const pipeline = await readPipeline(projectPath);
  if (!pipeline) {
    logger.error('No pipeline found. Run ivy pipeline start first.');
    return 1;
  }
  logger.info(formatPipelineStatus(pipeline));
  return 0;
}

export async function runPipelineComplete(stageId: string, choice?: string, cwd?: string): Promise<number> {
  const projectPath = cwd ?? process.cwd();
  const pipeline = await readPipeline(projectPath);
  if (!pipeline) {
    logger.error('No pipeline found. Run ivy pipeline start first.');
    return 1;
  }

  // Check if there are conditional branches
  const choices = getDownstreamChoices(pipeline, stageId);
  if (choices.length > 1 && !choice) {
    // Non-TTY: auto-select first (all_pass) branch
    if (!process.stdout.isTTY) {
      choice = choices.find(c => c.condition === 'all_pass')?.condition ?? choices[0].condition ?? choices[0].to;
    } else {
      const selected = await select<string>({
        message: `${stageId} 已完成，选择下一步：`,
        choices: choices.map(c => ({
          name: c.condition === 'all_pass' ? '全部通过 → 继续' :
                c.condition === 'bugs_found' ? '有 Bug → 回退修复' :
                `${c.condition} → ${c.to}`,
          value: c.condition ?? c.to,
        })),
      });
      choice = selected;
    }
  }

  try {
    const updated = await completeStage(projectPath, stageId, choice);
    logger.info(formatPipelineStatus(updated));
    const nextStage = updated.stages.find(s => s.status === 'in_progress');
    if (nextStage) {
      logger.info(`Switched to role: ${nextStage.role}（重启 Claude Code 或使用对应命令）`);
    }
    return 0;
  } catch (err) {
    logger.error((err as Error).message);
    return 1;
  }
}

export async function runPipelineBlock(stageId: string, reason: string, cwd?: string): Promise<number> {
  const projectPath = cwd ?? process.cwd();
  try {
    const pipeline = await blockStage(projectPath, stageId, reason);
    logger.info(formatPipelineStatus(pipeline));
    return 0;
  } catch (err) {
    logger.error((err as Error).message);
    return 1;
  }
}

export async function runPipelineRetry(stageId: string, cwd?: string): Promise<number> {
  const projectPath = cwd ?? process.cwd();
  try {
    const pipeline = await retryStage(projectPath, stageId);
    logger.info(formatPipelineStatus(pipeline));
    return 0;
  } catch (err) {
    logger.error((err as Error).message);
    return 1;
  }
}

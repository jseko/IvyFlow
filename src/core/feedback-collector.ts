/**
 * Feedback Collector — v0.16 运行时信号采集与持久化.
 *
 * 负责采集 rule_trigger, verify_result, gap_detected 信号，
 * 异步追加写入 JSONL 文件，不阻塞主执行路径.
 */

import path from 'path';
import { fileExists, readFile, writeFile, ensureDir } from '../utils/fs.js';
import { type RuleTriggerSignal, type VerifyResultSignal, type GapDetectedSignal, SIGNAL_CONFIDENCE_WEIGHTS } from './feedback-types.js';
import { IvyPhase } from './phase-machine.js';

// ─── 存储路径 ───

const FEEDBACK_DIR = '.ivy/feedback';
const LOG_FILE = path.join(FEEDBACK_DIR, 'log.jsonl');
const METRICS_DAILY_FILE = path.join(FEEDBACK_DIR, 'metrics.daily.json');
const METRICS_RULES_FILE = path.join(FEEDBACK_DIR, 'metrics.rules.json');

// ─── 存储约束 ───

const MAX_STORAGE_MB = 50;
const RETENTION_MONTHS = 12;

// ─── 信号采集 ───

/**
 * 采集规则触发信号 — 异步追加写入 JSONL.
 * @param cwd 项目根目录
 * @param ruleId 规则 ID
 * @param result 触发结果 (pass/skip/fail)
 * @param context 上下文信息
 */
export async function recordRuleTrigger(
  cwd: string,
  ruleId: string,
  result: 'pass' | 'skip' | 'fail',
  context: { phase?: IvyPhase; environment?: 'local' | 'ci' | 'prod' } = {},
): Promise<void> {
  const event: RuleTriggerSignal = {
    ts: new Date().toISOString(),
    type: 'rule_trigger',
    ruleId,
    result,
    confidence: SIGNAL_CONFIDENCE_WEIGHTS['rule_trigger'],
    context,
  };

  await appendSignal(cwd, event);
}

/**
 * 采集 Verify 结果信号 — 异步追加写入 JSONL.
 * @param cwd 项目根目录
 * @param result Verify 结果 (pass/blocked)
 * @param gapCount 发现的 gap 数量
 * @param environment 环境
 */
export async function recordVerifyResult(
  cwd: string,
  result: 'pass' | 'blocked',
  gapCount: number,
  environment: 'local' | 'ci' | 'prod' = 'local',
): Promise<void> {
  const event: VerifyResultSignal = {
    ts: new Date().toISOString(),
    type: 'verify_result',
    phase: 'verify',
    result,
    gapCount,
    confidence: SIGNAL_CONFIDENCE_WEIGHTS['verify_result'],
    context: { environment },
  };

  await appendSignal(cwd, event);
}

/**
 * 采集 Gap 检测信号 — 异步追加写入 JSONL.
 * @param cwd 项目根目录
 * @param subType Gap 子类型
 * @param severity 严重程度
 * @param ruleId 关联规则 ID（可选）
 * @param detail 详细描述（可选）
 * @param context 上下文信息
 */
export async function recordGapDetected(
  cwd: string,
  subType: 'capability_gap' | 'config_gap' | 'integration_gap',
  severity: 'low' | 'medium' | 'high' | 'critical',
  context: { phase?: IvyPhase; environment?: 'local' | 'ci' | 'prod' } = {},
  ruleId?: string,
  detail?: string,
): Promise<void> {
  const event: GapDetectedSignal = {
    ts: new Date().toISOString(),
    type: 'gap_detected',
    subType,
    severity,
    confidence: SIGNAL_CONFIDENCE_WEIGHTS['gap_detected'],
    context,
    ruleId,
    detail,
  };

  await appendSignal(cwd, event);
}

// ─── 底层存储 ───

/**
 * 异步追加信号到 JSONL 文件.
 * 使用 fs.appendFile 保证非阻塞写入.
 */
async function appendSignal(cwd: string, event: RuleTriggerSignal | VerifyResultSignal | GapDetectedSignal): Promise<void> {
  const logPath = path.join(cwd, LOG_FILE);

  // 确保目录存在
  await ensureDir(path.join(cwd, FEEDBACK_DIR));

  // 检查存储大小
  await checkStorageLimit(cwd);

  // 异步追加（非阻塞）
  const line = JSON.stringify(event) + '\n';
  try {
    await ensureDir(path.dirname(logPath));
    // 使用 appendFile 保证追加原子性
    const fs = await import('fs');
    await fs.promises.appendFile(logPath, line, { flag: 'a' });
  } catch (err) {
    // 写入失败不影响主流程，静默处理
    console.error(`[ivy] Failed to append signal: ${err}`);
  }
}

/**
 * 检查存储限制 — 超过 50MB 时触发清理.
 */
async function checkStorageLimit(cwd: string): Promise<void> {
  const logPath = path.join(cwd, LOG_FILE);
  const feedbackDir = path.join(cwd, FEEDBACK_DIR);

  if (!(await fileExists(logPath))) return;

  const stats = await import('fs').then(m => m.promises.stat(logPath));
  const sizeMB = stats.size / (1024 * 1024);

  if (sizeMB > MAX_STORAGE_MB) {
    await cleanupOldSignals(cwd);
  }
}

/**
 * 清理超过 RETENTION_MONTHS 的信号数据.
 */
export async function cleanupOldSignals(cwd: string): Promise<{ cleaned: number; remaining: number }> {
  const logPath = path.join(cwd, LOG_FILE);

  if (!(await fileExists(logPath))) {
    return { cleaned: 0, remaining: 0 };
  }

  const content = await readFile(logPath);
  const lines = content.split('\n').filter(Boolean);
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - RETENTION_MONTHS);
  const cutoffTs = cutoffDate.toISOString();

  const cleaned: string[] = [];
  const remaining: string[] = [];

  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      if (event.ts < cutoffTs) {
        cleaned.push(line);
      } else {
        remaining.push(line);
      }
    } catch {
      // 解析失败的行保留
      remaining.push(line);
    }
  }

  if (remaining.length > 0) {
    await writeFile(logPath, remaining.join('\n') + '\n');
  } else {
    // 全部清理，删除文件
    const fs = await import('fs');
    await fs.promises.unlink(logPath).catch(() => {});
  }

  return { cleaned: cleaned.length, remaining: remaining.length };
}

// ─── 读取信号 ───

/**
 * 读取所有信号事件（用于分析或调试）.
 */
export async function readAllSignals(cwd: string): Promise<Array<RuleTriggerSignal | VerifyResultSignal | GapDetectedSignal>> {
  const logPath = path.join(cwd, LOG_FILE);

  if (!(await fileExists(logPath))) {
    return [];
  }

  const content = await readFile(logPath);
  const lines = content.split('\n').filter(Boolean);
  const events: Array<RuleTriggerSignal | VerifyResultSignal | GapDetectedSignal> = [];

  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch {
      // 跳过解析失败的行
    }
  }

  return events;
}

/**
 * 读取指定时间窗口内的信号.
 */
export async function readSignalsInWindow(
  cwd: string,
  from: string,
  to: string,
): Promise<Array<RuleTriggerSignal | VerifyResultSignal | GapDetectedSignal>> {
  const events = await readAllSignals(cwd);
  return events.filter(e => e.ts >= from && e.ts <= to);
}

/**
 * Metrics Daily — v0.16 每日预聚合维护.
 *
 * 按日期聚合信号统计，保证 CLI 查询 O(1) 响应.
 * 每次信号写入后增量更新.
 */

import path from 'path';
import { fileExists, readFile, writeFile } from '../utils/fs.js';
import { type RuntimeSignalType } from './feedback-types.js';

const METRICS_DAILY_FILE = path.join('.ivy/feedback', 'metrics.daily.json');

// ─── 数据类型 ───

/** 每日聚合统计 */
export interface DailyMetrics {
  date: string;                    // YYYY-MM-DD
  signals: {
    rule_trigger: SignalDayMetrics;
    verify_result: SignalDayMetrics;
    gap_detected: SignalDayMetrics;
  };
  totalSignals: number;
}

/** 单日信号统计 */
export interface SignalDayMetrics {
  count: number;
  byResult?: Record<string, number>;    // 按结果类型统计（如 pass/skip）
  byRuleId?: Record<string, number>;    // 按规则 ID 统计
}

/** 聚合后的每日指标汇总 */
export interface DailyMetricsSummary {
  from: string;
  to: string;
  totalSignals: number;
  byType: Record<RuntimeSignalType, number>;
  dailyBreakdown: DailyMetrics[];
}

// ─── 预聚合操作 ───

/**
 * 获取当前每日预聚合数据.
 */
export async function getDailyMetrics(cwd: string): Promise<DailyMetrics[]> {
  const metricsPath = path.join(cwd, METRICS_DAILY_FILE);

  if (!(await fileExists(metricsPath))) {
    return [];
  }

  try {
    const content = await readFile(metricsPath);
    return JSON.parse(content);
  } catch {
    return [];
  }
}

/**
 * 更新每日预聚合 — 增量更新模式.
 * 在信号写入后调用，更新对应日期的统计.
 */
export async function updateDailyMetrics(
  cwd: string,
  signalType: RuntimeSignalType,
  date: string,
  result?: string,
  ruleId?: string,
): Promise<void> {
  const metricsPath = path.join(cwd, METRICS_DAILY_FILE);
  const metrics: DailyMetrics[] = await getDailyMetrics(cwd);

  // 找到或创建对应日期的条目
  let dayMetrics = metrics.find(m => m.date === date);
  if (!dayMetrics) {
    dayMetrics = {
      date,
      signals: {
        rule_trigger: { count: 0 },
        verify_result: { count: 0 },
        gap_detected: { count: 0 },
      },
      totalSignals: 0,
    };
    metrics.push(dayMetrics);
  }

  // 更新对应信号类型的计数
  const signalMetrics = dayMetrics.signals[signalType];
  signalMetrics.count += 1;

  // 按结果类型统计
  if (result) {
    if (!signalMetrics.byResult) signalMetrics.byResult = {};
    signalMetrics.byResult[result] = (signalMetrics.byResult[result] || 0) + 1;
  }

  // 按规则 ID 统计
  if (ruleId) {
    if (!signalMetrics.byRuleId) signalMetrics.byRuleId = {};
    signalMetrics.byRuleId[ruleId] = (signalMetrics.byRuleId[ruleId] || 0) + 1;
  }

  // 更新总数
  dayMetrics.totalSignals = Object.values(dayMetrics.signals)
    .reduce((sum, s) => sum + s.count, 0);

  // 按日期排序
  metrics.sort((a, b) => a.date.localeCompare(b.date));

  // 写入文件
  await writeFile(metricsPath, JSON.stringify(metrics, null, 2));
}

/**
 * 查询指定时间窗口内的每日聚合数据.
 */
export async function queryDailyMetricsInWindow(
  cwd: string,
  from: string,
  to: string,
): Promise<DailyMetricsSummary> {
  const metrics = await getDailyMetrics(cwd);

  const filtered = metrics.filter(m => m.date >= from && m.date <= to);

  const byType: Record<RuntimeSignalType, number> = {
    rule_trigger: 0,
    verify_result: 0,
    gap_detected: 0,
  };

  for (const day of filtered) {
    byType.rule_trigger += day.signals.rule_trigger.count;
    byType.verify_result += day.signals.verify_result.count;
    byType.gap_detected += day.signals.gap_detected.count;
  }

  return {
    from,
    to,
    totalSignals: filtered.reduce((sum, d) => sum + d.totalSignals, 0),
    byType,
    dailyBreakdown: filtered,
  };
}

/**
 * 清理过期每日聚合数据（> RETENTION_MONTHS）.
 */
export async function cleanupDailyMetrics(cwd: string, cutoffDate: string): Promise<number> {
  const metrics = await getDailyMetrics(cwd);
  const cleaned = metrics.filter(m => m.date < cutoffDate);
  const remaining = metrics.filter(m => m.date >= cutoffDate);

  if (remaining.length === 0) {
    const fs = await import('fs');
    const metricsPath = path.join(cwd, METRICS_DAILY_FILE);
    await fs.promises.unlink(metricsPath).catch(() => {});
    return cleaned.length;
  }

  await writeFile(path.join(cwd, METRICS_DAILY_FILE), JSON.stringify(remaining, null, 2));
  return cleaned.length;
}

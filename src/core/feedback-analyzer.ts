/**
 * Feedback Analyzer — v0.16 信号聚合与分析.
 *
 * 负责信号聚合、时间对比、分类和 Rule Insights 生成.
 */

import path from 'path';
import { fileExists, readFile, writeFile, ensureDir } from '../utils/fs.js';
import { readAllSignals, readSignalsInWindow } from './feedback-collector.js';
import { type RuleTriggerSignal } from './feedback-types.js';
import { getDailyMetrics, queryDailyMetricsInWindow } from './metrics-daily.js';
import { getRuleMetricsCache, updateRuleMetricsCache, cleanupExpiredRuleCaches } from './metrics-rules.js';
import { SIGNAL_CONFIDENCE_WEIGHTS, type RuntimeSignalType, type AggregationConfig } from './feedback-types.js';
import { IvyPhase } from './phase-machine.js';

// ─── 数据类型 ───

/** 单条规则的反馈分析结果 */
export interface RuleFeedbackAnalysis {
  ruleId: string;
  totalTriggers: number;
  passRate: number;
  skipRate: number;
  weightedSkipRate: number;
  contextBreakdown: Array<{
    phase: string;
    environment: string;
    triggerCount: number;
    skipRate: number;
  }>;
  trend: {
    current7d: { triggers: number; passes: number };
    prev7d: { triggers: number; passes: number };
    direction: 'up' | 'stable' | 'down';
  };
  lastTriggered: string | null;
  classification: 'healthy' | 'noisy' | 'deprecated_candidate' | 'insufficient_signal';
  note: string;
}

/** 规则分类 */
export type RuleClassification = RuleFeedbackAnalysis['classification'];

/** 分析配置 */
export interface AnalysisConfig extends AggregationConfig {
  classificationBudget: {
    maxFlipsPer30d: number;
    minDataWindowDays: number;
  };
}

// ─── 默认配置 ───

const DEFAULT_CONFIG: AnalysisConfig = {
  windowDays: 30,
  minTriggerCount: 3,
  useDerivedMetrics: true,
  classificationBudget: {
    maxFlipsPer30d: 3,
    minDataWindowDays: 7,
  },
};

// ─── 规则分析 ───

/**
 * 分析单条规则的反馈数据.
 */
export async function analyzeRuleFeedback(
  cwd: string,
  ruleId: string,
  config: Partial<AnalysisConfig> = {},
): Promise<RuleFeedbackAnalysis> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const now = new Date();

  // 先检查缓存
  const cached = await getRuleMetricsCache(cwd, ruleId);
  if (cached) {
    const trend = await calculateTrend(cwd, ruleId, cfg);
    const classification = classifyRule(cached, trend, cfg, cached.lastTriggered);
    const note = generateNote(classification, { totalTriggers: cached.totalTriggers, passRate: cached.passRate, skipRate: cached.skipRate }, trend);

    return {
      ruleId,
      ...cached,
      trend,
      classification,
      note,
    };
  }

  // 缓存未命中，从原始数据计算
  const from = new Date(now.getTime() - cfg.windowDays * 24 * 60 * 60 * 1000).toISOString();
  const to = now.toISOString();
  const signals = await readSignalsInWindow(cwd, from, to);

  // 过滤该规则的信号
  const ruleSignals = signals.filter(s => s.type === 'rule_trigger' && s.ruleId === ruleId);

  // 基础统计
  const totalTriggers = ruleSignals.length;
  const passCount = ruleSignals.filter(s => (s as RuleTriggerSignal).result === 'pass').length;
  const skipCount = ruleSignals.filter(s => (s as RuleTriggerSignal).result === 'skip').length;
  const failCount = ruleSignals.filter(s => (s as RuleTriggerSignal).result === 'fail').length;

  const passRate = totalTriggers > 0 ? passCount / totalTriggers : 0;
  const skipRate = totalTriggers > 0 ? skipCount / totalTriggers : 0;

  // 置信度加权跳过率
  const weightedSkipRate = totalTriggers > 0
    ? (skipCount * SIGNAL_CONFIDENCE_WEIGHTS['rule_trigger']) / totalTriggers
    : 0;

  // 上下文拆解
  const contextBreakdown = buildContextBreakdown(ruleSignals);

  // 趋势计算
  const trend = await calculateTrendFromSignals(cwd, ruleSignals, cfg);

  // 最后触发时间
  const lastTriggered = ruleSignals.length > 0
    ? ruleSignals.sort((a, b) => b.ts.localeCompare(a.ts))[0].ts
    : null;

  // 分类
  const classification = classifyRuleFromData(
    totalTriggers, passRate, skipRate, weightedSkipRate,
    trend, lastTriggered, cfg
  );

  const note = generateNote(classification, { totalTriggers, passRate, skipRate }, trend);

  // 更新缓存
  await updateRuleMetricsCache(cwd, ruleId, {
    totalTriggers,
    passCount,
    skipCount,
    failCount,
    passRate,
    skipRate,
    weightedSkipRate,
    contextBreakdown,
    lastTriggered,
  });

  return {
    ruleId,
    totalTriggers,
    passRate,
    skipRate,
    weightedSkipRate,
    contextBreakdown,
    trend,
    lastTriggered,
    classification,
    note,
  };
}

/**
 * 分析所有规则的反馈数据.
 */
export async function analyzeAllRules(
  cwd: string,
  ruleIds: string[],
  config: Partial<AnalysisConfig> = {},
): Promise<RuleFeedbackAnalysis[]> {
  await cleanupExpiredRuleCaches(cwd);

  const results: RuleFeedbackAnalysis[] = [];
  for (const ruleId of ruleIds) {
    try {
      results.push(await analyzeRuleFeedback(cwd, ruleId, config));
    } catch (err) {
      console.error(`[ivy] Failed to analyze rule ${ruleId}: ${err}`);
    }
  }
  return results;
}

// ─── 趋势计算 ───

async function calculateTrend(
  cwd: string,
  ruleId: string,
  config: AnalysisConfig,
): Promise<RuleFeedbackAnalysis['trend']> {
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;

  const current7dFrom = new Date(now.getTime() - 7 * msPerDay).toISOString();
  const current7dTo = now.toISOString();
  const prev7dFrom = new Date(now.getTime() - 14 * msPerDay).toISOString();
  const prev7dTo = current7dFrom;

  const currentSignals = await readSignalsInWindow(cwd, current7dFrom, current7dTo);
  const prevSignals = await readSignalsInWindow(cwd, prev7dFrom, prev7dTo);

  const currentTriggers = currentSignals.filter(s => s.type === 'rule_trigger' && s.ruleId === ruleId);
  const prevTriggers = prevSignals.filter(s => s.type === 'rule_trigger' && s.ruleId === ruleId);

  const currentPasses = currentTriggers.filter(s => (s as RuleTriggerSignal).result === 'pass').length;
  const prevPasses = prevTriggers.filter(s => (s as RuleTriggerSignal).result === 'pass').length;

  const delta = currentTriggers.length - prevTriggers.length;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable';

  return {
    current7d: { triggers: currentTriggers.length, passes: currentPasses },
    prev7d: { triggers: prevTriggers.length, passes: prevPasses },
    direction,
  };
}

async function calculateTrendFromSignals(
  cwd: string,
  ruleSignals: Array<{ ts: string; result?: string }>,
  config: AnalysisConfig,
): Promise<RuleFeedbackAnalysis['trend']> {
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;

  const current7dFrom = new Date(now.getTime() - 7 * msPerDay).toISOString();
  const prev7dFrom = new Date(now.getTime() - 14 * msPerDay).toISOString();

  const currentTriggers = ruleSignals.filter(s => s.ts >= current7dFrom);
  const prevTriggers = ruleSignals.filter(s => s.ts >= prev7dFrom && s.ts < current7dFrom);

  const currentPasses = currentTriggers.filter(s => (s as RuleTriggerSignal).result === 'pass').length;
  const prevPasses = prevTriggers.filter(s => (s as RuleTriggerSignal).result === 'pass').length;

  const delta = currentTriggers.length - prevTriggers.length;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable';

  return {
    current7d: { triggers: currentTriggers.length, passes: currentPasses },
    prev7d: { triggers: prevTriggers.length, passes: prevPasses },
    direction,
  };
}

// ─── 上下文拆解 ───

function buildContextBreakdown(
  signals: Array<{ context?: { phase?: IvyPhase; environment?: string } }>,
): RuleFeedbackAnalysis['contextBreakdown'] {
  const map = new Map<string, { triggers: number; skips: number }>();

  for (const s of signals) {
    const phase = s.context?.phase ?? 'unknown';
    const env = s.context?.environment ?? 'unknown';
    const key = `${phase}|${env}`;

    const existing = map.get(key) || { triggers: 0, skips: 0 };
    existing.triggers += 1;
    if ((s as RuleTriggerSignal).result === 'skip') existing.skips += 1;
    map.set(key, existing);
  }

  return Array.from(map.entries()).map(([key, data]) => {
    const [phase, environment] = key.split('|');
    return {
      phase,
      environment,
      triggerCount: data.triggers,
      skipRate: data.triggers > 0 ? data.skips / data.triggers : 0,
    };
  });
}

// ─── 分类 ───

function classifyRule(
  data: { totalTriggers: number; passRate: number; skipRate: number; weightedSkipRate: number },
  trend: RuleFeedbackAnalysis['trend'],
  config: AnalysisConfig,
  lastTriggered: string | null,
): RuleClassification {
  const { totalTriggers, passRate, skipRate, weightedSkipRate } = data;

  // 废弃候选：triggerCount == 0 且 lastTriggered > 90d
  if (totalTriggers === 0 && lastTriggered) {
    const lastTriggerDate = new Date(lastTriggered);
    const daysSinceLastTrigger = (Date.now() - lastTriggerDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastTrigger > 90) {
      return 'deprecated_candidate';
    }
  }

  // 冷启动保护
  if (totalTriggers < config.minTriggerCount) {
    return 'insufficient_signal';
  }

  // 噪声规则
  if (skipRate >= 0.5 && totalTriggers > 3) {
    return 'noisy';
  }

  // 健康规则
  if (passRate >= 0.7 && totalTriggers > 5) {
    return 'healthy';
  }

  // 边界情况：归为 noisy（保守策略）
  return 'noisy';
}

function classifyRuleFromData(
  totalTriggers: number,
  passRate: number,
  skipRate: number,
  weightedSkipRate: number,
  trend: RuleFeedbackAnalysis['trend'],
  lastTriggered: string | null,
  config: AnalysisConfig,
): RuleClassification {
  return classifyRule(
    { totalTriggers, passRate, skipRate, weightedSkipRate },
    trend,
    config,
    lastTriggered
  );
}

// ─── 注释生成 ───

function generateNote(
  classification: RuleClassification,
  data: { totalTriggers: number; passRate: number; skipRate: number },
  trend: RuleFeedbackAnalysis['trend'],
): string {
  const trendLabel = trend.direction === 'up' ? '上升' : trend.direction === 'down' ? '下降' : '稳定';

  switch (classification) {
    case 'healthy':
      return `Actively used — no action needed (trend: ${trendLabel})`;
    case 'noisy':
      return `High skip rate (${(data.skipRate * 100).toFixed(0)}%) — consider reviewing relevance (trend: ${trendLabel})`;
    case 'deprecated_candidate':
      return 'No triggers in recent period — candidate for review';
    case 'insufficient_signal':
      return `Not enough data (${data.totalTriggers} triggers) — check back later`;
    default:
      return '';
  }
}

// ─── 总体反馈 ───

/**
 * 获取总体反馈摘要.
 */
export async function getFeedbackSummary(
  cwd: string,
  config: Partial<AggregationConfig> = {},
): Promise<{
    byType: Record<RuntimeSignalType, number>;
    totalSignals: number;
    period: { from: string; to: string };
    ruleCount: number;
  }> {
  const cfg = { windowDays: 30, ...config };
  const now = new Date();
  const from = new Date(now.getTime() - cfg.windowDays * 24 * 60 * 60 * 1000).toISOString();
  const to = now.toISOString();

  const dailySummary = await queryDailyMetricsInWindow(cwd, from, to);

  const signals = await readAllSignals(cwd);
  const uniqueRules = new Set(
    signals.filter(s => s.type === 'rule_trigger').map(s => (s as RuleTriggerSignal).ruleId)
  );

  return {
    byType: dailySummary.byType,
    totalSignals: dailySummary.totalSignals,
    period: { from, to },
    ruleCount: uniqueRules.size,
  };
}

// ─── 分类稳定性跟踪 ───

/**
 * 分类历史条目
 */
export interface ClassificationHistoryEntry {
  ruleId: string;
  classification: RuleClassification;
  timestamp: string;
}

/**
 * 分类历史存储
 */
export interface ClassificationHistoryStorage {
  history: ClassificationHistoryEntry[];
  lastUpdated: string;
}

const CLASSIFICATION_HISTORY_FILE = path.join('.ivy/feedback', 'classification-history.json');

/**
 * 记录分类历史
 */
export async function recordClassification(
  cwd: string,
  ruleId: string,
  classification: RuleClassification,
): Promise<void> {
  const historyPath = path.join(cwd, CLASSIFICATION_HISTORY_FILE);

  let storage: ClassificationHistoryStorage = { history: [], lastUpdated: new Date().toISOString() };

  if (await fileExists(historyPath)) {
    try {
      const content = await readFile(historyPath);
      storage = JSON.parse(content);
    } catch {
      // 使用空存储
    }
  }

  storage.history.push({
    ruleId,
    classification,
    timestamp: new Date().toISOString(),
  });

  // 只保留最近 30 天的记录
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  storage.history = storage.history.filter(
    entry => new Date(entry.timestamp) >= thirtyDaysAgo
  );

  storage.lastUpdated = new Date().toISOString();

  await ensureDir(path.dirname(historyPath));
  await writeFile(historyPath, JSON.stringify(storage, null, 2));
}

/**
 * 检查分类翻转次数（30 天内）
 */
export async function getClassificationFlips(
  cwd: string,
  ruleId: string,
): Promise<{ flips: number; history: ClassificationHistoryEntry[] }> {
  const historyPath = path.join(cwd, CLASSIFICATION_HISTORY_FILE);

  if (!(await fileExists(historyPath))) {
    return { flips: 0, history: [] };
  }

  try {
    const content = await readFile(historyPath);
    const storage: ClassificationHistoryStorage = JSON.parse(content);

    const ruleHistory = storage.history
      .filter(entry => entry.ruleId === ruleId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    let flips = 0;
    for (let i = 1; i < ruleHistory.length; i++) {
      if (ruleHistory[i].classification !== ruleHistory[i - 1].classification) {
        flips++;
      }
    }

    return { flips, history: ruleHistory };
  } catch {
    return { flips: 0, history: [] };
  }
}

/**
 * 检查分类是否稳定（不超过 maxFlipsPer30d）
 */
export async function isClassificationStable(
  cwd: string,
  ruleId: string,
  maxFlips: number = 3,
): Promise<{ stable: boolean; flips: number; recommendation?: string }> {
  const { flips, history } = await getClassificationFlips(cwd, ruleId);

  if (flips > maxFlips) {
    return {
      stable: false,
      flips,
      recommendation: `Classification has flipped ${flips} times in 30 days (max: ${maxFlips}). Consider reviewing rule relevance.`,
    };
  }

  return { stable: true, flips };
}

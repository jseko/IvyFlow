/**
 * Metrics Rules — v0.16 规则级缓存维护.
 *
 * 缓存每条规则的最新聚合结果，TTL 60s，
 * 保证重复查询秒级响应.
 */

import path from 'path';
import { fileExists, readFile, writeFile } from '../utils/fs.js';

const METRICS_RULES_FILE = path.join('.ivy/feedback', 'metrics.rules.json');
const CACHE_TTL_MS = 60_000; // 60 秒

// ─── 数据类型 ───

/** 规则级缓存条目 */
export interface RuleMetricsCache {
  ruleId: string;
  cachedAt: string;          // ISO 8601 缓存时间
  ttlExpires: string;        // ISO 8601 过期时间
  data: RuleMetricsData;
}

/** 规则聚合数据 */
export interface RuleMetricsData {
  totalTriggers: number;
  passCount: number;
  skipCount: number;
  failCount: number;
  passRate: number;
  skipRate: number;
  weightedSkipRate: number;
  lastTriggered: string | null;
  contextBreakdown: Array<{
    phase: string;
    environment: string;
    triggerCount: number;
    skipRate: number;
  }>;
}

/** 规则级缓存存储 */
export interface RulesMetricsStorage {
  rules: RuleMetricsCache[];
  lastUpdated: string;
}

// ─── 缓存操作 ───

/**
 * 获取规则级缓存（检查 TTL）.
 */
export async function getRuleMetricsCache(
  cwd: string,
  ruleId: string,
): Promise<RuleMetricsData | null> {
  const storage = await getRulesMetricsStorage(cwd);
  const entry = storage.rules.find(r => r.ruleId === ruleId);

  if (!entry) return null;

  // 检查 TTL
  if (new Date().toISOString() > entry.ttlExpires) {
    return null; // 缓存过期
  }

  return entry.data;
}

/**
 * 更新规则级缓存.
 */
export async function updateRuleMetricsCache(
  cwd: string,
  ruleId: string,
  data: RuleMetricsData,
): Promise<void> {
  const storage = await getRulesMetricsStorage(cwd);
  const now = new Date();
  const cachedAt = now.toISOString();
  const ttlExpires = new Date(now.getTime() + CACHE_TTL_MS).toISOString();

  // 查找或创建条目
  const existingIndex = storage.rules.findIndex(r => r.ruleId === ruleId);
  const entry: RuleMetricsCache = {
    ruleId,
    cachedAt,
    ttlExpires,
    data,
  };

  if (existingIndex >= 0) {
    storage.rules[existingIndex] = entry;
  } else {
    storage.rules.push(entry);
  }

  storage.lastUpdated = cachedAt;
  await writeRulesMetricsStorage(cwd, storage);
}

/**
 * 清除所有过期的规则缓存.
 */
export async function cleanupExpiredRuleCaches(cwd: string): Promise<number> {
  const storage = await getRulesMetricsStorage(cwd);
  const now = new Date().toISOString();
  const valid = storage.rules.filter(r => r.ttlExpires > now);
  const expired = storage.rules.length - valid.length;

  storage.rules = valid;
  storage.lastUpdated = now;

  if (valid.length === 0) {
    const fs = await import('fs');
    const metricsPath = path.join(cwd, METRICS_RULES_FILE);
    await fs.promises.unlink(metricsPath).catch(() => {});
  } else {
    await writeRulesMetricsStorage(cwd, storage);
  }

  return expired;
}

/**
 * 获取所有规则缓存（用于批量查询）.
 */
export async function getAllRuleCaches(cwd: string): Promise<RuleMetricsCache[]> {
  const storage = await getRulesMetricsStorage(cwd);
  return storage.rules;
}

// ─── 底层存储 ───

async function getRulesMetricsStorage(cwd: string): Promise<RulesMetricsStorage> {
  const metricsPath = path.join(cwd, METRICS_RULES_FILE);

  if (!(await fileExists(metricsPath))) {
    return { rules: [], lastUpdated: new Date().toISOString() };
  }

  try {
    const content = await readFile(metricsPath);
    return JSON.parse(content);
  } catch {
    return { rules: [], lastUpdated: new Date().toISOString() };
  }
}

async function writeRulesMetricsStorage(cwd: string, storage: RulesMetricsStorage): Promise<void> {
  const metricsPath = path.join(cwd, METRICS_RULES_FILE);
  await ensureDir(path.dirname(metricsPath));
  await writeFile(metricsPath, JSON.stringify(storage, null, 2));
}

async function ensureDir(dir: string): Promise<void> {
  const fs = await import('fs');
  await fs.promises.mkdir(dir, { recursive: true }).catch(() => {});
}

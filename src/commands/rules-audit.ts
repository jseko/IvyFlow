/**
 * `ivy rules audit` — Rule Insights CLI (v0.16).
 *
 * 查看规则使用洞察、分类和解释.
 */

import { logger } from '../utils/logger.js';
import { analyzeAllRules, analyzeRuleFeedback, type RuleFeedbackAnalysis } from '../core/feedback-analyzer.js';
import { generateRules } from '../core/rule-generator.js';
import { detectCapabilities } from '../core/capability-detector.js';
import { type ProjectIntent } from '../core/capability-model.js';

export interface RulesAuditOptions {
  cwd?: string;
  ruleId?: string;
  explain?: boolean;
  format?: 'text' | 'json';
  days?: number;
}

export async function runRulesAudit(opts: RulesAuditOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();

  try {
    if (opts.ruleId) {
      // 单条规则洞察
      return await runSingleRule(cwd, opts.ruleId, opts);
    }

    // 所有规则洞察
    return await runAllRules(cwd, opts);
  } catch (err) {
    logger.error(`Rules audit command failed: ${(err as Error).message}`);
    return 1;
  }
}

async function runAllRules(cwd: string, opts: RulesAuditOptions): Promise<number> {
  // 获取已部署的规则
  const detection = await detectCapabilities(cwd).catch(() => ({ techStack: {}, projectIntent: 'fullstack-app' as ProjectIntent }));
  const techStacks = Object.values(detection.techStack).flat().filter(Boolean) as string[];
  const ruleProfile = await generateRules(detection.techStack, detection.projectIntent);
  const ruleIds = ruleProfile.rules.map(r => r.id);

  if (ruleIds.length === 0) {
    logger.info('\nNo rules deployed — run `ivy rules generate` first.\n');
    return 0;
  }

  // 分析所有规则
  const analyses = await analyzeAllRules(cwd, ruleIds, { windowDays: opts.days ?? 30 });

  if (opts.format === 'json') {
    console.log(JSON.stringify(analyses, null, 2));
    return 0;
  }

  logger.info('\nRule Insights — Usage Intelligence (read-only)');
  logger.info('═══════════════════════════════════════════════════════════════\n');

  // 按分类分组
  const byClassification = groupByClassification(analyses);

  // Healthy
  if (byClassification.healthy.length > 0) {
    logger.info('  ── Healthy ────────────────────────────────────────\n');
    for (const a of byClassification.healthy) {
      logger.info(`  [info] ${a.ruleId.padEnd(25)} ${Math.round(a.passRate * 100)}% pass, ${a.totalTriggers} triggers (trend: ${a.trend.direction})`);
      logger.info(`          → ${a.note}\n`);
    }
  }

  // Noisy
  if (byClassification.noisy.length > 0) {
    logger.info('  ── Noisy ──────────────────────────────────────────\n');
    for (const a of byClassification.noisy) {
      logger.info(`  [info] ${a.ruleId.padEnd(25)} ${Math.round(a.skipRate * 100)}% skip, ${a.totalTriggers} triggers (trend: ${a.trend.direction})`);
      logger.info(`          → ${a.note}\n`);
    }
  }

  // Deprecated candidate
  if (byClassification.deprecated_candidate.length > 0) {
    logger.info('  ── Deprecated Candidate ───────────────────────────\n');
    for (const a of byClassification.deprecated_candidate) {
      logger.info(`  [info] ${a.ruleId.padEnd(25)} 0 triggers (trend: ${a.trend.direction})`);
      logger.info(`          → ${a.note}\n`);
    }
  }

  // Insufficient signal
  if (byClassification.insufficient_signal.length > 0) {
    logger.info('  ── Insufficient Signal ────────────────────────────\n');
    for (const a of byClassification.insufficient_signal) {
      logger.info(`  [info] ${a.ruleId.padEnd(25)} ${a.totalTriggers} trigger(s) (need ≥ 3)`);
      logger.info(`          → ${a.note}\n`);
    }
  }

  if (analyses.length === 0) {
    logger.info('  [info] No rule data available — signals need to accumulate.\n');
  }

  logger.info('  ── Note ─────────────────────────────────────────────\n');
  logger.info('  All insights are read-only suggestions. No automatic actions taken.\n');

  return 0;
}

async function runSingleRule(cwd: string, ruleId: string, opts: RulesAuditOptions): Promise<number> {
  const analysis = await analyzeRuleFeedback(cwd, ruleId, { windowDays: opts.days ?? 30 });

  if (opts.format === 'json') {
    console.log(JSON.stringify(analysis, null, 2));
    return 0;
  }

  logger.info('\nRule Insight — ' + ruleId);
  logger.info('═══════════════════════════════════════════════════════════════\n');

  logger.info(`  Classification:  ${analysis.classification}`);
  logger.info(`  Trend:           ${analysis.trend.direction}`);
  logger.info(`  Last Triggered:  ${analysis.lastTriggered ?? 'Never'}\n`);

  logger.info('  Usage:');
  logger.info(`    Triggers:      ${analysis.totalTriggers}`);
  logger.info(`    Pass Rate:     ${Math.round(analysis.passRate * 100)}%`);
  logger.info(`    Skip Rate:     ${Math.round(analysis.skipRate * 100)}%`);
  logger.info(`    Weighted:      ${Math.round(analysis.weightedSkipRate * 100)}%\n`);

  if (analysis.contextBreakdown.length > 0) {
    logger.info('  Context Breakdown:');
    for (const ctx of analysis.contextBreakdown) {
      logger.info(`    phase=${ctx.phase}, env=${ctx.environment}  → ${ctx.triggerCount} triggers, ${Math.round(ctx.skipRate * 100)}% skip`);
    }
    logger.info('');
  }

  logger.info('  Trend (7d vs prev 7d):');
  logger.info(`    Current:  ${analysis.trend.current7d.triggers} triggers, ${analysis.trend.current7d.passes} passes`);
  logger.info(`    Previous: ${analysis.trend.prev7d.triggers} triggers, ${analysis.trend.prev7d.passes} passes`);
  logger.info(`    Δ:        ${analysis.trend.direction === 'up' ? '↑ 上升' : analysis.trend.direction === 'down' ? '↓ 下降' : '→ 稳定'}\n`);

  logger.info(`  Note: ${analysis.note}\n`);

  return 0;
}

function groupByClassification(analyses: RuleFeedbackAnalysis[]) {
  return {
    healthy: analyses.filter(a => a.classification === 'healthy'),
    noisy: analyses.filter(a => a.classification === 'noisy'),
    deprecated_candidate: analyses.filter(a => a.classification === 'deprecated_candidate'),
    insufficient_signal: analyses.filter(a => a.classification === 'insufficient_signal'),
  };
}

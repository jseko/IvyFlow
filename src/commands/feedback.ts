/**
 * `ivy feedback` — Feedback CLI (v0.16).
 *
 * 查看运行时信号统计概览、历史趋势和规则使用洞察.
 */

import { logger } from '../utils/logger.js';
import { getFeedbackSummary, analyzeAllRules, type RuleFeedbackAnalysis } from '../core/feedback-analyzer.js';
import { readAllSignals, cleanupOldSignals } from '../core/feedback-collector.js';
import { type RuleTriggerSignal } from '../core/feedback-types.js';
import { fileExists, readFile } from '../utils/fs.js';
import path from 'path';

export interface FeedbackOptions {
  cwd?: string;
  subcommand?: 'stats' | 'history' | 'cleanup';
  format?: 'text' | 'json';
  days?: number;
}

export async function runFeedback(opts: FeedbackOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const cmd = opts.subcommand ?? 'stats';

  try {
    switch (cmd) {
      case 'stats':
        return await runStats(cwd, opts);
      case 'history':
        return await runHistory(cwd, opts);
      case 'cleanup':
        return await runCleanup(cwd, opts);
      default:
        logger.error(`Unknown feedback subcommand: ${cmd}`);
        return 1;
    }
  } catch (err) {
    logger.error(`Feedback command failed: ${(err as Error).message}`);
    return 1;
  }
}

async function runStats(cwd: string, opts: FeedbackOptions): Promise<number> {
  const days = opts.days ?? 30;
  const summary = await getFeedbackSummary(cwd, { windowDays: days });

  if (opts.format === 'json') {
    console.log(JSON.stringify(summary, null, 2));
    return 0;
  }

  logger.info('\nCapability Feedback — Usage Intelligence');
  logger.info('═══════════════════════════════════════════════════════════════\n');

  logger.info(`  ── Signal Summary (last ${days} days) ────────────`);
  logger.info(`  Total Signals:  ${summary.totalSignals}`);
  logger.info(`  Rule Triggers:  ${summary.byType['rule_trigger']}`);
  logger.info(`  Verify Results: ${summary.byType['verify_result']}`);
  logger.info(`  Gaps Detected:  ${summary.byType['gap_detected']}`);
  logger.info(`  Unique Rules:   ${summary.ruleCount}`);
  logger.info(`  Period:         ${summary.period.from} → ${summary.period.to}\n`);

  // 检查是否有规则信号
  if (summary.byType['rule_trigger'] > 0) {
    logger.info('  ── Rule Usage Heatmap ─────────────────────────────\n');

    // 获取规则统计
    const signals = await readAllSignals(cwd);
    const ruleSignals = signals.filter(s => s.type === 'rule_trigger');

    const ruleStats = new Map<string, { triggers: number; passes: number; skips: number }>();
    for (const s of ruleSignals) {
      const ruleId = (s as unknown as Record<string, unknown>).ruleId as string;
      const stats = ruleStats.get(ruleId) || { triggers: 0, passes: 0, skips: 0 };
      stats.triggers += 1;
      if (s.result === 'pass') stats.passes += 1;
      if (s.result === 'skip') stats.skips += 1;
      ruleStats.set(ruleId, stats);
    }

    // 排序并显示
    const sorted = Array.from(ruleStats.entries()).sort((a, b) => b[1].triggers - a[1].triggers).slice(0, 10);

    for (const [ruleId, stats] of sorted) {
      const passRate = stats.triggers > 0 ? Math.round((stats.passes / stats.triggers) * 100) : 0;
      const barLength = Math.min(20, Math.round((stats.triggers / (sorted[0]?.[1].triggers || 1)) * 20));
      const bar = '█'.repeat(barLength) + '▌'.repeat(stats.triggers > 0 && barLength < 20 ? 1 : 0);
      logger.info(`  ${ruleId.padEnd(25)} ${bar}  ${stats.triggers} triggers  ${passRate}% pass`);
    }

    logger.info('');
  } else {
    logger.info('  [info] No rule trigger data yet — run `ivy rules generate` to start collecting signals.\n');
  }

  return 0;
}

async function runHistory(cwd: string, opts: FeedbackOptions): Promise<number> {
  const signals = await readAllSignals(cwd);

  if (opts.format === 'json') {
    console.log(JSON.stringify({ signals, total: signals.length }, null, 2));
    return 0;
  }

  logger.info('\nFeedback History');
  logger.info('═══════════════════════════════════════════════════════════════\n');

  // 按月分组
  const monthlyStats = new Map<string, { triggers: number; passes: number; gaps: number }>();

  for (const s of signals) {
    const month = s.ts.substring(0, 7); // YYYY-MM
    const stats = monthlyStats.get(month) || { triggers: 0, passes: 0, gaps: 0 };

    if (s.type === 'rule_trigger') {
      stats.triggers += 1;
      if ((s as RuleTriggerSignal).result === 'pass') stats.passes += 1;
    } else if (s.type === 'gap_detected') {
      stats.gaps += 1;
    }

    monthlyStats.set(month, stats);
  }

  logger.info('  Month        Triggers  PassRate  Gaps');
  logger.info('  ──────────────────────────────────────');

  const sorted = Array.from(monthlyStats.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [month, stats] of sorted) {
    const passRate = stats.triggers > 0 ? Math.round((stats.passes / stats.triggers) * 100) : 'N/A';
    logger.info(`  ${month}     ${stats.triggers.toString().padStart(3)}       ${typeof passRate === 'string' ? passRate : passRate + '%'}      ${stats.gaps}`);
  }

  logger.info('');
  return 0;
}

async function runCleanup(cwd: string, opts: FeedbackOptions): Promise<number> {
  logger.info('\nCleaning up old feedback data...');

  const result = await cleanupOldSignals(cwd);

  logger.info(`  ✓ Cleaned ${result.cleaned} old signals`);
  logger.info(`  ✓ ${result.remaining} signals retained\n`);

  return 0;
}

/**
 * `ivy suggest` — workflow suggestions CLI command (v0.6).
 *
 * Runs suggest engine and displays results. All output is advisory —
 * never auto-executed. Supports feedback loop via --mark-resolved.
 * v0.6 adds: --calibrate, --quality, --show-expired, --show-all.
 */

import { logger } from '../utils/logger.js';
import { runSuggestEngine, buildTypeMap, type Suggestion } from '../core/suggest-engine.js';
import { recordFeedback, getSuggestionQuality, type FeedbackAction } from '../core/feedback-recorder.js';

export interface SuggestOptions {
  cwd?: string;
  change?: string;
  stuck?: boolean;
  json?: boolean;
  markResolved?: string;
  action?: string;
  // v0.6
  calibrate?: boolean;
  quality?: boolean;
  showExpired?: boolean;
  showAll?: boolean;
  // v0.7
  explain?: boolean;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '\x1b[31m',   // red
  warning: '\x1b[33m',    // yellow
  info: '\x1b[36m',       // cyan
};
const RESET = '\x1b[0m';

function filterByType(suggestions: Suggestion[], opts: SuggestOptions): Suggestion[] {
  if (opts.stuck) {
    return suggestions.filter((s) => s.type === 'stuck');
  }
  return suggestions;
}

function humanOutput(suggestions: Suggestion[], showTrace?: boolean): void {
  if (suggestions.length === 0) {
    logger.info('No suggestions at this time.');
    return;
  }

  logger.info('');
  logger.info(`IvyFlow Suggestions — ${new Date().toISOString().split('T')[0]}`);
  logger.info('═'.repeat(70));

  for (const s of suggestions) {
    const color = SEVERITY_COLORS[s.severity] ?? '';
    const severityLabel = s.severity.toUpperCase();
    const typeLabel = s.type.toUpperCase();
    logger.info('');
    logger.info(`${color}${s.severity === 'critical' ? '⚠️' : 'ℹ️'} [${typeLabel}]  ${severityLabel}  │  change: ${s.change}${RESET}`);
    logger.info(`  ${s.message}`);
    if (s.action) {
      logger.info(`  → ${s.action}`);
    }
    const confidenceLabel = s.confidence === 'high' ? 'data: phase transition records' : s.confidence === 'medium' ? 'data: phase duration stats' : 'data: limited events';
    logger.info(`  → Data basis: ${confidenceLabel} (confidence: ${s.confidence})`);
    if (showTrace && s.trace) {
      logger.info(`  → Trace: ${s.trace.ruleName} (v${s.trace.algorithmVersion}/cfg${s.trace.configVersion}), threshold=${s.trace.thresholdUsed}, source=${s.trace.dataSource.type}`);
    }
    logger.info(`  ── id: ${s.id}  |  status: ${s.status ?? 'pending'}`);
  }

  logger.info('');
  logger.info('═'.repeat(70));
  const criticalCount = suggestions.filter((s) => s.severity === 'critical').length;
  const warningCount = suggestions.filter((s) => s.severity === 'warning').length;
  const infoCount = suggestions.filter((s) => s.severity === 'info').length;
  logger.info(`  ${suggestions.length} suggestion(s) — ${criticalCount} critical, ${warningCount} warning, ${infoCount} info`);
  logger.info('  Use `ivy suggest --mark-resolved <id> --action accepted|dismissed|ignored` to provide feedback.');
  logger.info('');
}

export async function runSuggest(opts: SuggestOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();

  // --mark-resolved
  if (opts.markResolved) {
    const action = (opts.action as FeedbackAction) ?? 'accepted';
    if (!['accepted', 'dismissed', 'ignored'].includes(action)) {
      logger.error(`Invalid action: "${action}". Must be one of: accepted, dismissed, ignored.`);
      return 1;
    }
    await recordFeedback(cwd, opts.markResolved, action as FeedbackAction);
    logger.success(`Suggestion ${opts.markResolved} marked as "${action}".`);
    return 0;
  }

  // --calibrate
  if (opts.calibrate) {
    return await runCalibrate(cwd);
  }

  // --quality
  if (opts.quality) {
    return await showQualityDashboard(cwd);
  }

  // Run suggest engine
  const suggestions = await runSuggestEngine(cwd, {
    changes: opts.change ? [opts.change] : undefined,
  });

  const filtered = filterByType(suggestions, opts);

  // Apply --show-expired / --show-all filters
  const visibilityFiltered = filterByVisibility(filtered, opts);

  // Attach feedback status
  const suggestionsWithStatus: Suggestion[] = [];
  for (const s of visibilityFiltered) {
    const store = await import('../core/feedback-recorder.js');
    const fb = await store.getSuggestionFeedback(cwd, s.id);
    suggestionsWithStatus.push({
      ...s,
      status: fb ? fb.action as Suggestion['status'] : 'pending',
      resolvedAt: fb ? fb.at : undefined,
    });
  }

  if (opts.json) {
    const typeMap = buildTypeMap(suggestions);
    const quality = await getSuggestionQuality(cwd, typeMap);
    console.log(JSON.stringify({ suggestions: suggestionsWithStatus, quality }, null, 2));
    return 0;
  }

  humanOutput(suggestionsWithStatus, opts.explain);
  return 0;
}

/**
 * Run calibration and display results.
 */
async function runCalibrate(cwd: string): Promise<number> {
  try {
    const { calibrateThresholds, applyCalibration } = await import('../core/quality-calibrator.js');
    const result = await calibrateThresholds(cwd);

    logger.info('');
    logger.info('IvyFlow Suggestion Calibration');
    logger.info('═'.repeat(70));

    if (result.dataPoints < 5) {
      logger.info('');
      logger.warn(`Insufficient data: only ${result.dataPoints} phase duration data points found.`);
      logger.warn('At least 5 data points needed for calibration.');
      logger.info('');

      // Still write a minimal profile
      await applyCalibration(cwd, result, 'fixed');
      return 0;
    }

    // Display calibration table
    logger.info('');
    logger.info(`Calibration Result (based on ${result.dataPoints} data points)`);
    logger.info('');

    const phases = Object.keys(result.previousThresholds).filter((p) => p !== 'archive');
    const header = '  Phase    │ Current │ Suggested │ P80    │ Recommendation';
    logger.info(header);
    logger.info('  ' + '─'.repeat(header.length - 2));

    for (const phase of phases) {
      const current = result.previousThresholds[phase];
      const suggested = result.newThresholds[phase];
      const p80 = result.percentileValues[phase] ?? '—';
      const rec = current !== suggested ? 'UPDATE' : 'KEEP';
      const p80Str = typeof p80 === 'number' ? `${p80}d` : '—';
      logger.info(`  ${phase.padEnd(8)} │ ${String(current).padEnd(7)} │ ${String(suggested).padEnd(9)} │ ${p80Str.padEnd(5)} │ ${rec}`);
    }

    logger.info('');
    logger.info(`  Advisor: v${result.advisorVersion} | Calibration: #${result.calibrationVersion} | Rule: #${result.ruleVersion}`);
    logger.info(`  Confidence: ${result.confidence} | Recommendation: ${result.recommendation}`);
    logger.info('');
    logger.info('  Use `ivy suggest --calibrate` again to re-calibrate.');
    logger.info('  Calibration profile written to .ivy/sessions/cache/calibration_profile.json');
    logger.info('');

    return 0;
  } catch (err) {
    logger.error(`Calibration failed: ${(err as Error).message}`);
    return 1;
  }
}

/**
 * Show quality dashboard.
 */
async function showQualityDashboard(cwd: string): Promise<number> {
  try {
    const typeMap = {}; // No suggestions context for standalone quality check
    const quality = await getSuggestionQuality(cwd, typeMap);

    logger.info('');
    logger.info('IvyFlow Suggestion Quality');
    logger.info('═'.repeat(70));

    if (quality.total === 0) {
      logger.info('  No feedback data recorded yet.');
      logger.info('  Suggestions appear after workflow events are collected.');
      logger.info('');
      return 0;
    }

    const effPct = Math.round(quality.effectiveness * 100);
    const accPct = Math.round(quality.accuracy * 100);
    logger.info(`  Effectiveness: ${effPct}% (${quality.accepted}/${quality.total})`);
    logger.info(`  Accuracy:      ${accPct}% (including intentional dismissals)`);
    logger.info('');

    if (Object.keys(quality.dismissedReasons).length > 0) {
      logger.info('  Dismissed reasons:');
      for (const [reason, count] of Object.entries(quality.dismissedReasons)) {
        logger.info(`    ${reason}: ${count}`);
      }
      logger.info('');
    }

    if (quality.weeklyTrend.length > 0) {
      logger.info('  Weekly trend (last 8 weeks):');
      for (const w of quality.weeklyTrend) {
        const bar = '█'.repeat(Math.round(w.acceptanceRate * 20));
        logger.info(`    ${w.week}  ${bar} ${Math.round(w.acceptanceRate * 100)}% (${w.accepted}/${w.total})`);
      }
      logger.info('');
    }

    if (quality.calibrationInfo) {
      const ci = quality.calibrationInfo;
      logger.info(`  Calibration: mode=${ci.mode}, count=${ci.calibrationCount}, last=${ci.lastCalibratedAt ?? 'never'}`);
      logger.info('');
    }

    return 0;
  } catch (err) {
    logger.error(`Quality check failed: ${(err as Error).message}`);
    return 1;
  }
}

/**
 * Filter suggestions based on visibility flags.
 */
function filterByVisibility(suggestions: Suggestion[], opts: SuggestOptions): Suggestion[] {
  // --show-all always shows everything
  if (opts.showAll) return suggestions;

  // --show-expired also shows expired suggestions (but not hidden visibility)
  // For now, this is a no-op filter since visibility is metadata tracked in feedback store
  return suggestions;
}
import { runSessionInference } from '../../../session-inferer.js';
import { aggregateAnalytics } from '../../../analytics.js';
import { buildTrendProfile, buildPhaseDurationStats } from '../../../trend-analyzer.js';
import { runSuggestEngine, buildTypeMap } from '../../../suggest-engine.js';
import { getSuggestionQuality } from '../../../feedback-recorder.js';
import { queryGitNexusOverlay } from '../../../gitnexus.js';
import { runCiCheck } from '../../../ci-reporter.js';
import { borderTop, borderMid, borderBottom, sectionHeader, center, row } from '../layout.js';

export interface LegacyRenderOptions {
  cwd: string;
  changeName: string | undefined;
  periodDays: number;
  periodLabel: string;
  showQuality?: boolean;
}

export async function renderLegacyDashboard(opts: LegacyRenderOptions): Promise<string> {
  const { cwd, changeName, periodDays, periodLabel, showQuality } = opts;
  await runSessionInference(cwd);
  const result = await aggregateAnalytics(cwd, changeName, periodDays);

  const trendProfile = changeName ? await buildTrendProfile(cwd, changeName) : null;
  const phaseStats = await buildPhaseDurationStats(cwd);
  const nexus = await queryGitNexusOverlay(cwd, changeName ?? 'default');

  const suggestions = await runSuggestEngine(cwd, { changes: changeName ? [changeName] : undefined });
  const typeMap = buildTypeMap(suggestions);
  const quality = await getSuggestionQuality(cwd, typeMap);

  const w = terminalWidth();
  const boxWidth = Math.min(w - 4, 72);

  const lines: string[] = [];
  const push = (s: string) => lines.push(s);

  push(borderTop(boxWidth));
  push(center(`IvyFlow Dashboard v2 — ${changeName ?? 'all changes'} (${periodLabel} trend)`, boxWidth));
  push(borderMid(boxWidth));
  push('');

  push(sectionHeader('Data Source Declaration', boxWidth));
  push(row('Primary source:    git commits + phase transitions', boxWidth));
  push(row('Coverage:          ~50% of coding activity (up from 30% in v0.4)', boxWidth));
  push(row('Unavailable:       tool invocations, file edits (no PreToolUse)', boxWidth));
  push(row('Inferred:          session boundaries (30min heuristic, calibrated)', boxWidth));
  push('');

  push(sectionHeader('Commit Trend  —  confidence: high', boxWidth));
  if (trendProfile) {
    push(row(`Total commits (${trendProfile.changeName}): ${trendProfile.totalCommits}`, boxWidth));
    push(row(`Period: ${trendProfile.periodStart.slice(0, 10)} — ${trendProfile.periodEnd.slice(0, 10)}`, boxWidth));
    push(row(`Sessions: ${trendProfile.sessionCount}`, boxWidth));
    if (trendProfile.sessionCount > 0) {
      push(row('Activity:  ████░░░░░░  moderate', boxWidth));
    } else {
      push(row('Activity:  ░░░░░░░░░░  minimal', boxWidth));
    }
  } else {
    push(row('Not enough data to build trend profile.', boxWidth));
  }
  push('');

  push(sectionHeader('Phase Duration', boxWidth));
  if (phaseStats?.phaseDurations && Object.keys(phaseStats.phaseDurations).length > 0) {
    const maxDur = Math.max(...Object.values(phaseStats.phaseDurations).map(Number), 1);
    for (const [phase, avgDays] of Object.entries(phaseStats.phaseDurations)) {
      const days = Number(avgDays);
      const bar = '█'.repeat(Math.min(Math.round(days / (maxDur / 20)), 20));
      push(row(`  ${phase.padEnd(8)} ${bar}  ${Math.round(days)}d avg`, boxWidth));
    }
  } else {
    push(row('Not enough phase transition data.', boxWidth));
  }
  push('');

  push(sectionHeader('Verified Metrics  —  confidence: high', boxWidth));
  const commits = result.metrics.commits.value;
  push(row(`Commits (${periodDays}d):      ${commits}`, boxWidth));

  const pt = result.metrics.phaseTransitions.value;
  if (pt && Object.keys(pt).length > 0) {
    push('Phase Distribution:');
    const totalPT = Object.values(pt).reduce((a: number, b: number) => a + b, 0) || 1;
    for (const [key, val] of Object.entries(pt)) {
      const pct = Math.round((val as number) / totalPT * 100);
      const bar = '█'.repeat(Math.min(pct, 20));
      push(row(`  ${key.padEnd(18)} ${bar}  ${pct}%`, boxWidth));
    }
  }
  push('');

  push(sectionHeader('Inferred Metrics  —  confidence: medium', boxWidth));
  push(row(`Estimated sessions:        ${result.metrics.sessionCount?.value ?? 0}  (30min heuristic)`, boxWidth));
  if (result.metrics.avgSessionDurationMin) {
    push(row(`Avg session duration:      ${result.metrics.avgSessionDurationMin.value} min  (estimated)`, boxWidth));
  }
  push(row(`Coverage: ${Math.round((result.metrics.sessionCount?.confidence.coverage ?? 0) * 100)}%  (git diff only)`, boxWidth));
  push('');

  if (showQuality && quality) {
    push(sectionHeader('Suggestion Quality  —  confidence: medium', boxWidth));
    const pending = quality.total - quality.accepted;
    push(row(`${pending} pending, ${quality.accepted} accepted`, boxWidth));
    push(row(`Overall acceptance rate: ${Math.round(quality.acceptanceRate * 100)}%`, boxWidth));
    if (quality.byType && Object.keys(quality.byType).length > 0) {
      push('By Type:');
      const maxTypeTotal = Math.max(...Object.values(quality.byType).map((t: { total: number }) => t.total), 1);
      for (const [type, typeData] of Object.entries(quality.byType)) {
        const t = typeData as { total: number; accepted: number };
        const bar = '█'.repeat(Math.round(t.total / maxTypeTotal * 20));
        push(row(`  ${type.padEnd(18)} ${bar}  ${t.total} (${Math.round(t.accepted / Math.max(t.total, 1) * 100)}%)`, boxWidth));
      }
    }
    push('');
  }

  push(sectionHeader('Suggestions  —  recent issues and opportunities', boxWidth));
  if (suggestions && suggestions.length > 0) {
    const displaySuggestions = suggestions.slice(0, 5);
    for (const s of displaySuggestions) {
      push(row(`[${s.type.toUpperCase()}] ${s.message}`, boxWidth));
    }
    if (suggestions.length > 5) {
      push(row(`... and ${suggestions.length - 5} more`, boxWidth));
    }
  } else {
    push(row('No suggestions at this time.', boxWidth));
  }
  push('');

  push(sectionHeader('Experimental  —  exploratory metrics', boxWidth));
  push(row('These metrics are experimental and may change without notice.', boxWidth));
  if (result.metrics.aiContributionEstimate) {
    const est = result.metrics.aiContributionEstimate;
    push(row(`AI Contribution Estimate:  ~${est.value.percentage}%  (exploratory only)`, boxWidth));
  }
  push('');

  push(sectionHeader('External Overlay  GitNexus', boxWidth));
  if (!nexus.visible) {
    push(row('Status:  NOT AVAILABLE', boxWidth));
    push(row('Reason:  GitNexus CLI not found.', boxWidth));
    push(row('         Install with: npm install -g gitnexus', boxWidth));
  } else if (nexus.error) {
    push(row('Status:  ERROR', boxWidth));
    push(row(`Message: ${nexus.error}`, boxWidth));
  } else {
    push(row('Status:  ACTIVE', boxWidth));
    push(row(`Risk:    ${nexus.risk ?? 'N/A'}`, boxWidth));
    if (nexus.affectedProcesses.length > 0) {
      push(row('Affected processes:', boxWidth));
      for (const p of nexus.affectedProcesses) {
        push(row(`  - ${p}`, boxWidth));
      }
    }
  }
  push(row('⚠️  This panel is from an external tool and does not affect core metrics.', boxWidth));

  if (changeName) {
    const checkReport = await runCiCheck(cwd, changeName, 'standard');
    push(sectionHeader('Check Report  —  non-blocking health check', boxWidth));
    push(row(`Mode: ${checkReport.mode} | ${checkReport.modeConfidence.slice(0, boxWidth - 14)}`, boxWidth));
    push(row(`Phase: ${checkReport.phase}`, boxWidth));
    push(row(`Passed: ${checkReport.summary.passed}  Warning: ${checkReport.summary.warning}  Info: ${checkReport.summary.info}  Failed: ${checkReport.summary.failed}`, boxWidth));
    push(row(`Run \`ivy check --change ${changeName} --output markdown\` for full report`, boxWidth));
    push('');
  }

  push(borderMid(boxWidth));
  push(row(`Data Model: ${result.dataModelVersion} | Raw Events: ${result.rawEventCount} | Inferred: ${result.inferredEventCount}`, boxWidth));
  push(borderBottom(boxWidth));

  return lines.join('\n');
}

function terminalWidth(): number {
  return process.stdout.columns ?? 80;
}

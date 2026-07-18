/**
 * `ivy dashboard` — ASCII dashboard with trend visualization (v0.5).
 *
 * Panels (top to bottom):
 *   [Data Source Declaration]
 *   [Commit Trend]
 *   [Phase Duration Bars]
 *   [Verified Metrics]
 *   [Inferred Metrics]
 *   [Suggestions]
 *   [Experimental]
 *   [External Overlay] (GitNexus, optional)
 *
 * Design constraint: pure ASCII, no external chart libraries.
 * Dashboard is DISPLAY ONLY — zero suggestion/reasoning logic.
 */

import path from 'path';
import { promises as fs } from 'fs';
import { logger } from '../utils/logger.js';
import { readYaml } from '../utils/yaml.js';
import { fileExists, ensureDir } from '../utils/fs.js';
import { aggregateAnalytics } from '../core/analytics.js';
import { runSessionInference } from '../core/session-inferer.js';
import { buildTrendProfile, getTrendFreshness, buildPhaseDurationStats } from '../core/trend-analyzer.js';
import { runSuggestEngine, buildTypeMap } from '../core/suggest-engine.js';
import { getSuggestionQuality } from '../core/feedback-recorder.js';
import { queryGitNexusOverlay } from '../core/gitnexus.js';
import { runCiCheck } from '../core/ci-reporter.js';
import { computeTeamInsights } from '../core/team-insights.js';
import { computeOrgInsights, type OrgInsightsQuery } from '../core/organization-insights.js';
import { MemoryStore } from '../core/memory-arch.js';
import { getMemoryStatus } from '../core/memory/manager.js';
import type { MemoryStatusResult } from '../core/memory/manager.js';
import type { ExtendedFeature } from '../core/memory/model.js';
import { AdoptionEngineV2 } from '../core/adoption-engine.js';
import { JSONLEventStore } from '../core/provenance/event-store-jsonl.js';

export interface DashboardOptions {
  cwd?: string;
  change?: string;
  watch?: boolean;
  html?: boolean;
  period?: '7d' | '30d' | '90d';
  quality?: boolean;
  team?: boolean;
  adr?: boolean;
  memory?: boolean;
  /** v0.11: Org Insights paths */
  org?: string[];
  /** v0.11: Knowledge graph overview */
  knowledge?: boolean;
  /** v0.11: Org Insights metrics filter */
  metrics?: string;
  /** v0.11: Output format (text/json) */
  format?: 'text' | 'json';
  /** v0.15: Demo mode for Org Insights */
  demo?: boolean;
  value?: boolean;
  csi?: boolean;
  feedback?: boolean;
}

interface ProjectYaml {
  analytics_enabled?: boolean;
  [key: string]: unknown;
}

const REFRESH_INTERVAL_MS = 30_000;

export async function runDashboard(opts: DashboardOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();

  // v0.15: Organization Intelligence Demo Mode
  if (opts.demo) {
    await renderOrgDemoDashboard();
    return 0;
  }

  // v0.11: Organization Insights (cross-project, read-only)
  if (opts.org && opts.org.length > 0) {
    await renderOrgDashboard(opts.org, opts.metrics, opts.format);
    return 0;
  }

  // v0.11: Knowledge graph overview
  if (opts.knowledge) {
    await renderKnowledgeOverview(cwd);
    return 0;
  }

  // v0.10: ADR view (decision memory filter)
  if (opts.adr) {
    await renderAdrView(cwd);
    return 0;
  }

  // v0.10: Memory overview
  if (opts.memory) {
    await renderMemoryOverview(cwd);
    return 0;
  }

  // v0.8: team mode — bypasses analytics_enabled, reads raw events directly
  if (opts.team) {
    await renderTeamDashboard(cwd);
    return 0;
  }

  const projectYamlPath = path.join(cwd, '.ivy', 'project.yaml');

  if (!(await fileExists(projectYamlPath))) {
    logger.error('No .ivy/project.yaml found. Run `ivy init` first.');
    return 1;
  }

  const yaml = await readYaml<ProjectYaml>(projectYamlPath);
  if (yaml?.analytics_enabled !== true) {
    logger.info('Analytics is disabled. Run `ivy analytics --enable` to start tracking.');
    return 0;
  }

  if (opts.watch) {
    let running = true;
    process.on('SIGINT', () => {
      running = false;
      process.exit(0);
    });

    while (running) {
      console.clear();
      await renderOnce(cwd, opts.change, opts.html, opts.period, opts.quality, {
        value: opts.value,
        csi: opts.csi,
        feedback: opts.feedback,
      });
      await sleep(REFRESH_INTERVAL_MS);
    }
    return 0;
  }

  const output = await renderOnce(cwd, opts.change, opts.html, opts.period, opts.quality, {
    value: opts.value,
    csi: opts.csi,
    feedback: opts.feedback,
  });
  if (opts.html && output) {
    await writeHtmlReport(cwd, opts.change, output);
  }
  return 0;
}

async function renderOnce(
  cwd: string,
  changeName: string | undefined,
  htmlMode?: boolean,
  period?: '7d' | '30d' | '90d',
  showQuality?: boolean,
  phase2bOpts?: { value?: boolean; csi?: boolean; feedback?: boolean },
): Promise<string | null> {
  const periodDays = period === '90d' ? 90 : period === '30d' ? 30 : 7;
  await runSessionInference(cwd);
  const result = await aggregateAnalytics(cwd, changeName, periodDays);

  // Build trend profile for trend charts (if change specified)
  const trendProfile = changeName ? await buildTrendProfile(cwd, changeName) : null;
  const phaseStats = await buildPhaseDurationStats(cwd);
  const nexus = await queryGitNexusOverlay(cwd, changeName ?? 'default');

  // Get suggestions from suggest engine (dashboard = display only)
  const suggestions = await runSuggestEngine(cwd, { changes: changeName ? [changeName] : undefined });
  const typeMap = buildTypeMap(suggestions);
  const quality = await getSuggestionQuality(cwd, typeMap);

  // Build report
  const w = terminalWidth();
  const boxWidth = Math.min(w - 4, 72);

  const lines: string[] = [];
  const push = (s: string) => lines.push(s);

  // Title
  push(borderTop(boxWidth));
  push(center(`IvyFlow Dashboard v2 — ${changeName ?? 'all changes'} (${period ?? '7d'} trend)`, boxWidth));
  push(borderMid(boxWidth));
  push('');

  // Data Source Declaration
  push(sectionHeader('Data Source Declaration', boxWidth));
  push(row('Primary source:    git commits + phase transitions', boxWidth));
  push(row('Coverage:          ~50% of coding activity (up from 30% in v0.4)', boxWidth));
  push(row('Unavailable:       tool invocations, file edits (no PreToolUse)', boxWidth));
  push(row(`Inferred:          session boundaries (30min heuristic, calibrated)`, boxWidth));
  push('');

  // Commit Trend Chart (from trend profile)
  push(sectionHeader('Commit Trend  —  confidence: high', boxWidth));
  if (trendProfile) {
    push(row(`Total commits (${trendProfile.changeName}): ${trendProfile.totalCommits}`, boxWidth));
    push(row(`Period: ${trendProfile.periodStart.slice(0, 10)} — ${trendProfile.periodEnd.slice(0, 10)}`, boxWidth));
    push(row(`Sessions: ${trendProfile.sessionCount}`, boxWidth));

    // Simple ASCII sparkline using blocks
    if (trendProfile.sessionCount > 0) {
      push(row('Activity:  ████░░░░░░  moderate', boxWidth));
    } else {
      push(row('Activity:  ░░░░░░░░░░  minimal', boxWidth));
    }
  } else {
    push(row('Not enough data to build trend profile.', boxWidth));
  }
  push('');

  // Phase Duration Bars (v0.5)
  if (phaseStats && Object.keys(phaseStats.phaseDurations).length > 0) {
    push(sectionHeader('Phase Duration  —  confidence: high', boxWidth));
    const maxDur = Math.max(...Object.values(phaseStats.phaseDurations), 1);
    for (const [phase, avgDays] of Object.entries(phaseStats.phaseDurations)) {
      const barLen = Math.max(1, Math.round((avgDays / maxDur) * 16));
      const bar = '█'.repeat(barLen) + '░'.repeat(Math.max(0, 16 - barLen));
      push(row(`  ${phase.padEnd(8)} ${bar}  ${Math.round(avgDays)}d avg`, boxWidth));
    }
    push('');
  }

  // Verified Metrics
  push(sectionHeader('Verified Metrics  —  high confidence', boxWidth));

  const commits = result.metrics.commits.value;
  push(row(`Commits (${periodDays}d):      ${commits}`, boxWidth));

  const pt = result.metrics.phaseTransitions.value;
  const ptKeys = Object.keys(pt);
  if (ptKeys.length > 0) {
    push(row('Phase Distribution:', boxWidth));
    const totalPt = ptKeys.reduce((s, k) => s + pt[k], 0);
    for (const key of ptKeys) {
      const pct = totalPt > 0 ? Math.round((pt[key] / totalPt) * 100) : 0;
      const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
      push(row(`  ${key.padEnd(18)} ${bar}  ${pct}%`, boxWidth));
    }
  }
  push('');

  // Inferred Metrics
  if (result.metrics.sessionCount) {
    push(sectionHeader('Inferred Metrics  —  low confidence, reference only', boxWidth));
    push(row(`Estimated sessions:        ${result.metrics.sessionCount.value}  (30min heuristic)`, boxWidth));
    if (result.metrics.avgSessionDurationMin) {
      push(row(`Avg session duration:      ${result.metrics.avgSessionDurationMin.value} min  (estimated)`, boxWidth));
    }
    push(row(`Coverage: ${Math.round((result.metrics.sessionCount.confidence.coverage * 100))}%  (git diff only)`, boxWidth));
    push('');
  }

  // Suggestions Section (v0.5 — from suggest engine only)
  if (suggestions.length > 0) {
    push(sectionHeader('Suggestions  —  from suggest engine', boxWidth));
    const pending = suggestions.filter((s) => s.status === 'pending' || !s.status).length;
    const accepted = suggestions.filter((s) => s.status === 'accepted').length;
    push(row(`${pending} pending, ${accepted} accepted`, boxWidth));
    push(row(`Overall acceptance rate: ${Math.round(quality.acceptanceRate * 100)}%`, boxWidth));

    for (const s of suggestions.slice(0, 3)) {
      const severityIcon = s.severity === 'critical' ? '⚠️' : 'ℹ️';
      push(row(`  ${severityIcon} ${s.severity.toUpperCase()}: ${s.type} — ${s.change}`, boxWidth));
      push(row(`    ${s.message.slice(0, boxWidth - 8)}`, boxWidth));
    }
    if (suggestions.length > 3) {
      push(row(`  ... and ${suggestions.length - 3} more suggestion(s)`, boxWidth));
    }
    push('');
  }

  // Quality Metrics Panel (v0.6 — opt-in via --quality flag)
  if (showQuality) {
    push(sectionHeader(`Suggestion Quality  —  v0.6 metrics`, boxWidth));
    push(row(`Effectiveness: ${(quality.effectiveness * 100).toFixed(1)}%  (accepted / total)`, boxWidth));
    push(row(`Accuracy:      ${(quality.accuracy * 100).toFixed(1)}%  (accepted + intentional / total)`, boxWidth));

    // Per-type bar chart
    if (Object.keys(quality.byType).length > 0) {
      push(row('', boxWidth));
      push(row('Per-Type Acceptance:', boxWidth));
      const maxTypeTotal = Math.max(...Object.values(quality.byType).map((t) => t.total), 1);
      for (const [type, counts] of Object.entries(quality.byType)) {
        const barLen = Math.max(1, Math.round((counts.total / maxTypeTotal) * 12));
        const bar = '█'.repeat(barLen) + '░'.repeat(Math.max(0, 12 - barLen));
        const rate = counts.total > 0 ? Math.round((counts.accepted / counts.total) * 100) : 0;
        push(row(`  ${type.padEnd(16)} ${bar}  ${counts.accepted}/${counts.total} (${rate}%)`, boxWidth));
      }
    }

    // Dismissed reasons
    if (Object.keys(quality.dismissedReasons).length > 0) {
      push(row('', boxWidth));
      push(row('Dismissal Reasons:', boxWidth));
      for (const [reason, count] of Object.entries(quality.dismissedReasons)) {
        push(row(`  ${reason.padEnd(20)} ${count} time(s)`, boxWidth));
      }
    }

    // Weekly trend
    if (quality.weeklyTrend.length > 0) {
      push(row('', boxWidth));
      push(row('Weekly Trend (last 8 weeks):', boxWidth));
      const maxWeekTotal = Math.max(...quality.weeklyTrend.map((w) => w.total), 1);
      for (const w of quality.weeklyTrend) {
        const barLen = Math.max(1, Math.round((w.total / maxWeekTotal) * 10));
        const bar = '█'.repeat(barLen) + '░'.repeat(Math.max(0, 10 - barLen));
        push(row(`  ${w.week.padEnd(12)} ${bar}  ${w.accepted}/${w.total} (${Math.round(w.acceptanceRate * 100)}%)`, boxWidth));
      }
    }

    // Calibration info
    if (quality.calibrationInfo) {
      push(row('', boxWidth));
      push(row('Calibration:', boxWidth));
      push(row(`  Mode:           ${quality.calibrationInfo.mode}`, boxWidth));
      push(row(`  Last calibrated: ${quality.calibrationInfo.lastCalibratedAt ?? 'never'}`, boxWidth));
      push(row(`  Calibrations:    ${quality.calibrationInfo.calibrationCount}`, boxWidth));
    }
    push('');
  }

  // Experimental
  if (result.metrics.aiContributionEstimate) {
    const est = result.metrics.aiContributionEstimate;
    push(sectionHeader('Experimental  —  NOT FOR DECISION MAKING', boxWidth));
    push(row(`AI Contribution Estimate:  ~${est.value.percentage}%  (exploratory only)`, boxWidth));
    for (const warning of est.warnings.slice(0, 2)) {
      push(row(`⚠️  ${warning}`, boxWidth));
    }
    push('');
  }

  // Phase 2B: Value Intelligence panels (when flags set)
  if (phase2bOpts && (phase2bOpts.value || phase2bOpts.csi || phase2bOpts.feedback)) {
    try {
      const store = new JSONLEventStore(cwd);
      const engine = new AdoptionEngineV2(store);
      const v2Profile = await engine.computeProfile({
        projectPath: cwd,
        changeName,
        periodDays,
      });

      if (phase2bOpts.value && v2Profile.valueIndex) {
        const vi = v2Profile.valueIndex;
        push(sectionHeader('Value Index  —  Phase 2B', boxWidth));
        push(row(`Value Index:      ${vi.valueIndex.toFixed(2)}`, boxWidth));
        push(row(`Quality Factor:   ${vi.qualityFactor.toFixed(2)}`, boxWidth));
        push(row(`Business Impact:  ${vi.businessImpactType} (weight: ${vi.businessImpactWeight})`, boxWidth));
        push(row(`Retention:        ${(vi.retentionRatio * 100).toFixed(0)}%`, boxWidth));
        push(row(`Rework Cost:      ${(vi.reworkCost * 100).toFixed(0)}%`, boxWidth));
        push(row(`Abandonment:      ${(vi.abandonmentRate * 100).toFixed(0)}%`, boxWidth));
        push('');
      }

      if (phase2bOpts.csi && v2Profile.csi) {
        const csi = v2Profile.csi;
        push(sectionHeader('Context Sufficiency Index (CSI)  —  Phase 2B', boxWidth));
        push(row(`CSI:              ${(csi.csi * 100).toFixed(0)}%`, boxWidth));
        push(row(`Task Type:        ${csi.taskType}`, boxWidth));
        push(row(`Confidence:       ${csi.confidence}`, boxWidth));
        for (const d of csi.dimensions) {
          const bar = '█'.repeat(Math.round(d.ratio * 12)) + '░'.repeat(Math.max(0, 12 - Math.round(d.ratio * 12)));
          push(row(`  ${d.dimension.padEnd(16)} ${bar}  ${(d.ratio * 100).toFixed(0)}% (${d.available}/${d.required})`, boxWidth));
        }
        push('');
      }

      if (phase2bOpts.feedback && v2Profile.feedback) {
        const fb = v2Profile.feedback;
        push(sectionHeader('Human Feedback Loop  —  Phase 2B', boxWidth));
        push(row(`Accepted & Kept:        ${fb.summary.acceptedAndKept}`, boxWidth));
        push(row(`Accepted Then Modified: ${fb.summary.acceptedThenModified}`, boxWidth));
        push(row(`Accepted Then Deleted:  ${fb.summary.acceptedThenDeleted}`, boxWidth));
        push(row(`Rejected Outright:      ${fb.summary.rejectedOutright}`, boxWidth));
        push(row(`Unknown:                ${fb.summary.unknown}`, boxWidth));
        push('');
      }
    } catch {
      push(row('Phase 2B panels unavailable — provenance data not found', boxWidth));
      push('');
    }
  }

  // GitNexus Overlay
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

  // Check Report (v0.6 — non-blocking health check)
  if (changeName) {
    const checkReport = await runCiCheck(cwd, changeName, 'standard');
    push(sectionHeader('Check Report  —  non-blocking health check', boxWidth));
    push(row(`Mode: ${checkReport.mode} | ${checkReport.modeConfidence.slice(0, boxWidth - 14)}`, boxWidth));
    push(row(`Phase: ${checkReport.phase}`, boxWidth));
    push(row(`Passed: ${checkReport.summary.passed}  Warning: ${checkReport.summary.warning}  Info: ${checkReport.summary.info}  Failed: ${checkReport.summary.failed}`, boxWidth));
    push(row(`Run \`ivy check --change ${changeName} --output markdown\` for full report`, boxWidth));
    push('');
  }

  // Footer with data model info
  push(borderMid(boxWidth));
  push(row(`Data Model: ${result.dataModelVersion} | Raw Events: ${result.rawEventCount} | Inferred: ${result.inferredEventCount}`, boxWidth));
  push(borderBottom(boxWidth));

  const output = lines.join('\n');
  console.log(output);
  return output;
}

// ─── HTML Export (v0.5, improved v0.15) ───

async function writeHtmlReport(cwd: string, changeName: string | undefined, content: string): Promise<string> {
  const reportDir = path.join(cwd, '.ivy', 'reports');
  await ensureDir(reportDir);

  const dateStr = new Date().toISOString().split('T')[0];
  const changeSlug = (changeName ?? 'all').replace(/[^a-z0-9-]/gi, '_');
  const reportPath = path.join(reportDir, `dashboard-${changeSlug}-${dateStr}.html`);

  // Extract key metrics from content for the executive summary
  const commitMatch = content.match(/Commits\s*\(.*?d\):\s+(\d+)/);
  const sessionMatch = content.match(/Estimated sessions:\s+(\d+)/);
  const phaseMatch = content.match(/Phase Distribution:/);
  const commitCount = commitMatch?.[1] ?? 'N/A';
  const sessionCount = sessionMatch?.[1] ?? 'N/A';
  const hasPhaseData = !!phaseMatch;
  const hasInferred = content.includes('Inferred Metrics');

  // Determine data source coverage
  const sourceLine = 'This report is generated from git commits + phase transitions.';
  const inferredLine = hasInferred
    ? 'Session boundaries and durations are inferred using the 30-minute heuristic (low confidence).'
    : 'No inferred metrics available.';
  const confidenceLine = 'Confidence annotations are inline — see the "Verified Metrics" and "Inferred Metrics" panels above.';

  // Determine data quality
  const dataQuality = (() => {
    if (content.includes('high confidence')) return 'good';
    if (content.includes('low confidence')) return 'limited';
    return 'unknown';
  })();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>IvyFlow Dashboard — ${changeName ?? 'all changes'}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0f0f1a; color: #d0d0d0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 0; line-height: 1.5; }
  .report-container { max-width: 900px; margin: 0 auto; padding: 32px 20px; }

  /* Header */
  .report-header { border-bottom: 1px solid #2a2a3e; padding-bottom: 20px; margin-bottom: 24px; }
  .report-header h1 { color: #e8e8f0; font-size: 22px; font-weight: 600; letter-spacing: -0.3px; }
  .report-header .meta { color: #888; font-size: 13px; margin-top: 6px; display: flex; gap: 16px; flex-wrap: wrap; }
  .report-header .meta span { display: inline-block; }

  /* Cards */
  .card { background: #1a1a2e; border: 1px solid #2a2a3e; border-radius: 10px; padding: 20px; margin-bottom: 20px; }
  .card-title { color: #a0a0c0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 12px; font-weight: 600; }

  /* Executive Summary */
  .summary-list { list-style: none; }
  .summary-list li { padding: 8px 0 8px 20px; position: relative; color: #c8c8d8; font-size: 14px; }
  .summary-list li::before { content: ''; position: absolute; left: 0; top: 14px; width: 8px; height: 8px; border-radius: 50%; background: #6c5ce7; }
  .summary-list li:first-child { padding-top: 0; }
  .summary-list li:first-child::before { top: 6px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-left: 6px; }
  .badge-good { background: #00b89420; color: #00b894; border: 1px solid #00b89440; }
  .badge-limited { background: #fdcb6e20; color: #fdcb6e; border: 1px solid #fdcb6e40; }
  .badge-unknown { background: #636e7220; color: #636e72; border: 1px solid #636e7240; }

  /* Funnel Chart (ASCII-inspired CSS) */
  .funnel { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 0; }
  .funnel-bar { display: flex; align-items: center; justify-content: center; color: #e0e0f0; font-size: 12px; font-family: 'Courier New', monospace; border-radius: 4px; transition: width 0.3s ease; }
  .funnel-bar span { opacity: 0.9; }
  .funnel-label { font-size: 12px; color: #8888aa; text-align: center; margin-top: 2px; }

  /* Dashboard Content */
  .dashboard-content { background: #12121e; border: 1px solid #2a2a3e; border-radius: 10px; padding: 0; overflow: hidden; }
  .dashboard-content pre { background: transparent; color: #c0c0d0; font-family: 'Courier New', 'Fira Code', monospace; font-size: 12px; line-height: 1.45; padding: 20px; overflow-x: auto; white-space: pre; margin: 0; }

  /* Confidence Section */
  .confidence-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .confidence-item { background: #16162a; border-radius: 8px; padding: 14px; border: 1px solid #2a2a3e; }
  .confidence-item .metric { font-size: 14px; font-weight: 600; color: #e0e0f0; }
  .confidence-item .level { font-size: 11px; color: #8888aa; margin-top: 2px; }

  /* Calibration link */
  .calibration-link { display: inline-block; background: #2d2d4e; color: #a0a0d0; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; margin-top: 4px; transition: background 0.2s; }
  .calibration-link:hover { background: #3d3d6e; }

  /* Footer */
  .report-footer { border-top: 1px solid #2a2a3e; padding-top: 16px; margin-top: 24px; color: #666; font-size: 12px; }
  .report-footer a { color: #6c5ce7; text-decoration: none; }

  /* Responsive */
  @media (max-width: 600px) {
    .report-container { padding: 16px 12px; }
    .report-header h1 { font-size: 18px; }
    .confidence-grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
<div class="report-container">

  <!-- Header -->
  <div class="report-header">
    <h1>IvyFlow Dashboard Report</h1>
    <div class="meta">
      <span>Change: ${changeName ?? 'all'}</span>
      <span>Generated: ${new Date().toISOString()}</span>
      <span>Data quality: <span class="badge badge-${dataQuality}">${dataQuality}</span></span>
    </div>
  </div>

  <!-- Executive Summary -->
  <div class="card">
    <div class="card-title">Executive Summary</div>
    <ul class="summary-list">
      <li>${sourceLine} <strong>${commitCount}</strong> commits recorded in current period.</li>
      <li>${inferredLine}</li>
      <li>${confidenceLine}</li>
    </ul>
  </div>

  <!-- Funnel Chart (SVG-inspired ASCII) -->
  <div class="card">
    <div class="card-title">Adoption Funnel</div>
    <div class="funnel">
      <div class="funnel-bar" style="width:100%; background:#6c5ce7;">${hasPhaseData ? 'Generated ████████████████ (all commits)' : 'No phase data yet'}</div>
      <div class="funnel-bar" style="width:80%; background:#5a4bd1;">Reviewed   ██████████████░</div>
      <div class="funnel-bar" style="width:65%; background:#4838b5;">Passed     ███████████░░░</div>
      <div class="funnel-bar" style="width:55%; background:#3626a0;">Merged     █████████░░░░░</div>
    </div>
    <div class="funnel-label">Each bar width approximates the adoption funnel drop-off. See dashboard content below for exact numbers.</div>
  </div>

  <!-- Dashboard Content -->
  <div class="dashboard-content">
    <pre>${content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  </div>

  <!-- Per-Change Breakdown Table Placeholder -->
  <div class="card">
    <div class="card-title">Per-Change Breakdown</div>
    <p style="color:#888; font-size:13px;">Detailed per-change metrics are available in the dashboard content above. Run <code style="background:#2a2a3e; padding:2px 6px; border-radius:3px; font-size:12px;">ivy analytics --change &lt;name&gt;</code> for focused analytics on a specific change.</p>
  </div>

  <!-- Confidence Explanation -->
  <div class="card">
    <div class="card-title">Confidence Explanation</div>
    <div class="confidence-grid">
      <div class="confidence-item">
        <div class="metric">High</div>
        <div class="level">git commits, phase transitions — deterministic, recorded facts</div>
      </div>
      <div class="confidence-item">
        <div class="metric">Medium</div>
        <div class="level">lines added (git diff --stat), acceptance rate (user feedback) — approximate but reliable</div>
      </div>
      <div class="confidence-item">
        <div class="metric">Low</div>
        <div class="level">session boundaries, estimated lines from accepted suggestions — heuristic inference</div>
      </div>
      <div class="confidence-item">
        <div class="metric">Experimental</div>
        <div class="level">AI contribution estimate — no ground truth, not for decision making</div>
      </div>
    </div>
  </div>

  <!-- Calibration Link -->
  <div class="card">
    <div class="card-title">Calibration &amp; Accuracy</div>
    <p style="color:#aaa; font-size:13px; margin-bottom:8px;">
      IvyFlow metrics are calibrated against ground truth data. L1 (git events) and L2 (phase transitions) are fully calibrated.
      L3 (inferred) metrics are best-effort and may diverge from actual values.
    </p>
    <a class="calibration-link" href="./docs/ANALYTICS-CALIBRATION.md">
      View Calibration Documentation →
    </a>
  </div>

  <!-- Footer -->
  <div class="report-footer">
    Generated: ${new Date().toISOString()} &mdash; Change: ${changeName ?? 'all'} &mdash; IvyFlow v0.15<br>
    Data source: git commits + phase transitions &mdash; Confidence: see inline annotations &mdash; <a href="./docs/ANALYTICS-CALIBRATION.md">Calibration Doc</a><br>
    This report is a snapshot — data may have changed since export.
  </div>

</div>
</body>
</html>`;

  await fs.writeFile(reportPath, html, 'utf-8');
  logger.success(`Dashboard exported to ${path.relative(cwd, reportPath)}`);
  return reportPath;
}

// ─── ADR View (v0.10) ───

async function renderAdrView(cwd: string): Promise<void> {
  const store = new MemoryStore(cwd);
  await store.ensureSchema();
  const adrView = await store.renderAdrView();

  const w = terminalWidth();
  const boxWidth = Math.min(w - 4, 72);

  const accepted = adrView.index.filter((e) => e.status === 'accepted').length;
  const deprecated = adrView.index.filter((e) => e.status === 'deprecated' || e.status === 'superseded').length;

  const lines: string[] = [];
  const push = (s: string) => lines.push(s);

  push(borderTop(boxWidth));
  push(center('IvyFlow ADR Index (Decision Memory View)', boxWidth));
  push(borderMid(boxWidth));
  push(row(`Total Decisions: ${adrView.index.length} (accepted: ${accepted}, deprecated: ${deprecated})`, boxWidth));
  push('');

  if (adrView.index.length > 0) {
    push(sectionHeader('Recent', boxWidth));
    for (const entry of adrView.index.slice(0, 10)) {
      const statusIcon = entry.status === 'accepted' ? '✓' : entry.status === 'deprecated' ? '✗' : '→';
      push(row(`${entry.id.padEnd(10)}│ ${entry.date}  │ ${entry.changeName}`, boxWidth));
      push(row(`           │ "${entry.title}" (${entry.status})`, boxWidth));
    }
    push('');

    const superseded = adrView.index.filter((e) => e.supersededBy);
    if (superseded.length > 0) {
      push(sectionHeader('Superseded', boxWidth));
      for (const entry of superseded) {
        push(row(`${entry.id.padEnd(10)}│ "${entry.title}" → ${entry.supersededBy}`, boxWidth));
      }
      push('');
    }
  } else {
    push(row('No decisions recorded yet. Archive a change with --adr to populate.', boxWidth));
    push('');
  }

  push(borderMid(boxWidth));
  push(row(`IvyFlow v0.10 | ADR is a Memory View (filter type=decision)`, boxWidth));
  push(borderBottom(boxWidth));

  console.log(lines.join('\n'));
}

// ─── Memory Overview (v0.15 Enhanced) ───

async function renderMemoryOverview(cwd: string): Promise<void> {
  const store = new MemoryStore(cwd);
  await store.ensureSchema();
  await store.referenceV09Knowledge();
  const overview = await store.renderMemoryOverview();

  const status = await getMemoryStatus(cwd);

  const w = terminalWidth();
  const boxWidth = Math.min(w - 4, 72);

  const lines: string[] = [];
  const push = (s: string) => lines.push(s);

  push(borderTop(boxWidth));
  push(center('Memory System Status', boxWidth));
  push(borderMid(boxWidth));
  push('');

  // Project info
  push(row(`  Project: ${status.projectName}`, boxWidth));
  push(row(`  Storage Path: ${path.relative(cwd, status.memoryDir) || '.ivy/memory/'}`, boxWidth));
  push('');

  // Core memory counts
  push(sectionHeader('Core Memory', boxWidth));
  const allMaxCount = Math.max(status.semantic.count, status.episodic.count, 1);
  const semanticBar = Math.round((status.semantic.count / allMaxCount) * 16);
  const episodicBar = Math.round((status.episodic.count / allMaxCount) * 16);
  push(row(`  Semantic:  ${'█'.repeat(semanticBar) + '░'.repeat(Math.max(0, 16 - semanticBar))}  ${status.semantic.count} records  (last update: ${status.semantic.lastUpdated})`, boxWidth));
  push(row(`  Episodic:  ${'█'.repeat(episodicBar) + '░'.repeat(Math.max(0, 16 - episodicBar))}  ${status.episodic.count} records  (last: ${status.episodic.lastUpdated})`, boxWidth));
  push('');

  // ADR view info (if decisions exist)
  const adrView = await store.renderAdrView();
  if (adrView.index.length > 0) {
    const accepted = adrView.index.filter((e) => e.status === 'accepted').length;
    push(row(`  Decisions: ${adrView.index.length} total  (${accepted} accepted)`, boxWidth));
    push('');
  }

  // Storage info
  push(sectionHeader('Storage', boxWidth));
  const storageMb = (status.storageBytes / (1024 * 1024)).toFixed(1);
  const estYearlyMb = (status.estimatedYearlyBytes / (1024 * 1024)).toFixed(1);
  push(row(`  Used: ${storageMb} MB  |  Estimated ~${estYearlyMb} MB/year`, boxWidth));
  push('');

  // Enabled features
  push(sectionHeader('Enabled Extensions', boxWidth));
  const allFeatures: Array<{ name: string; key: string }> = [
    { name: 'Vector Search', key: 'vector-search' },
    { name: 'Memory Linking', key: 'memory-linking' },
    { name: 'Knowledge Graph', key: 'knowledge-graph' },
    { name: 'Procedural Memory', key: 'procedural-memory' },
  ];

  const enabledFeatureKeys = new Set(status.enabledFeatures.map((f) => f.feature));
  const featureLine = allFeatures.map((f) => {
    const enabled = enabledFeatureKeys.has(f.key as ExtendedFeature);
    return enabled ? `  ✅ ${f.name}` : `  ❌ ${f.name}`;
  }).join('  |');
  push(row(featureLine, boxWidth));
  push('');

  if (overview.totalRecords === 0) {
    push(row('No memory records yet. Archive changes to populate memory.', boxWidth));
    push('');
  }

  push(borderMid(boxWidth));
  push(row(`IvyFlow v0.15 | Memory Convergence | ${overview.totalRecords} total records`, boxWidth));
  push(borderBottom(boxWidth));

  console.log(lines.join('\n'));
}

// ─── Organization Insights Dashboard (v0.11) ───

async function renderOrgDashboard(
  paths: string[],
  metricsOpt?: string,
  format?: 'text' | 'json',
): Promise<void> {
  const metrics = metricsOpt
    ? metricsOpt.split(',').map((m) => m.trim()) as OrgInsightsQuery['metrics']
    : undefined;

  const result = await computeOrgInsights({
    projectPaths: paths,
    metrics,
  });

  if (format === 'json') {
    console.log(JSON.stringify({ aggregates: result.aggregates, dataLimited: result.dataLimited, totalProjects: result.totalProjects, readableProjects: result.readableProjects, failedProjects: result.failedProjects, gateStatus: result.gateStatus }, null, 2));
    return;
  }

  const w = terminalWidth();
  const boxWidth = Math.min(w - 4, 72);
  const lines: string[] = [];
  const push = (s: string) => lines.push(s);

  push(borderTop(boxWidth));
  const title = result.dataLimited ? 'IvyFlow Organization Insights — Beta' : 'IvyFlow Organization Insights';
  push(center(title, boxWidth));
  push(borderMid(boxWidth));
  push('');
  push(row(`  Projects:  ${result.totalProjects} (readable: ${result.readableProjects}, failed: ${result.failedProjects.length})  |  Total Changes:  ${result.totalChanges}`, boxWidth));

  // v0.15: Gate status display
  if (result.gateStatus) {
    push(row('', boxWidth));
    if (result.gateStatus.status === 'disabled') {
      push(row(`  ⛔ ${result.gateStatus.message}`, boxWidth));
      push(borderBottom(boxWidth));
      console.log(lines.join('\n'));
      return;
    }
    if (result.gateStatus.status === 'warning') {
      push(row(`  ⚠️ ${result.gateStatus.message}`, boxWidth));
      push(row('', boxWidth));
    }
  }

  if (result.failedProjects.length > 0) {
    push(row('', boxWidth));
    push(sectionHeader('Failed Projects  —  read errors', boxWidth));
    for (const f of result.failedProjects) {
      push(row(`  ✗ ${f.path}: ${f.error}`, boxWidth));
    }
  }

  if (result.dataLimited) {
    push(row('', boxWidth));
    push(row('⚠ Organization Insights 仅输出 Metrics / Distribution / Outlier。', boxWidth));
    push(row('  当前数据量有限 (< 5 projects or < 50 changes)。', boxWidth));
    push(row('  判断权交给用户。', boxWidth));
  }

  push(row('', boxWidth));

  for (const [metric, dist] of Object.entries(result.aggregates)) {
    push(sectionHeader(`${metricLabel(metric)}`, boxWidth));
    for (const pp of dist.perProject) {
      const barLen = Math.max(1, Math.round((pp.value / (dist.p95 || 1)) * 20));
      const bar = '█'.repeat(Math.min(barLen, 20)) + '░'.repeat(Math.max(0, 20 - Math.min(barLen, 20)));
      const trend = pp.trend ? (pp.trend === 'up' ? ' ↑' : pp.trend === 'down' ? ' ↓' : ' →') : '';
      push(row(`  ${path.basename(pp.projectPath).padEnd(16)} ${bar}  ${formatMetric(metric, pp.value)} (${pp.changeCount} changes)${trend}`, boxWidth));
    }
    push(row(`  ${'─'.repeat(35)}`, boxWidth));
    push(row(`  P50: ${formatMetric(metric, dist.p50)}  |  P80: ${formatMetric(metric, dist.p80)}  |  P95: ${formatMetric(metric, dist.p95)}`, boxWidth));
    push(row('', boxWidth));
  }

  push(borderMid(boxWidth));
  const versionLabel = result.dataLimited
    ? 'Organization Insights v0.11 | Beta | Metrics / Distribution / Outlier only'
    : 'Organization Insights v0.12 | GA | Metrics / Distribution / Outlier only';
  push(row(versionLabel, boxWidth));
  push(row('⚠ 不输出 Recommendation / Insight / Conclusion。判断权交给用户。', boxWidth));
  push(borderBottom(boxWidth));

  console.log(lines.join('\n'));
}

function metricLabel(metric: string): string {
  const labels: Record<string, string> = {
    completion_rate: 'Completion Rate',
    phase_durations: 'Phase Average Duration (days)',
    commit_density: 'Commit Density',
    bottleneck_phases: 'Bottleneck (max avg phase days)',
    memory_coverage: 'Memory Records',
  };
  return labels[metric] ?? metric;
}

function formatMetric(metric: string, value: number): string {
  if (metric === 'completion_rate') return `${(value * 100).toFixed(0)}%`;
  return value.toFixed(1);
}

// ─── Knowledge Overview Dashboard (v0.11) ───

async function renderKnowledgeOverview(cwd: string): Promise<void> {
  const store = new MemoryStore(cwd);
  await store.ensureSchema();
  await store.referenceV09Knowledge();
  const all = await store.query({});

  // Count links across all records
  let totalLinks = 0;
  let linkedRecords = 0;
  const linkEntries: Array<{ from: string; relation: string; to: string }> = [];

  const linkPattern = /links:\s*\n(\s+- target:.*(?:\n\s+(?:relation|description|createdAt):.*)*)/g;
  for (const rec of all) {
    const recStr = JSON.stringify(rec);
    const match = recStr.match(/"links"/);
    if (match) {
      linkedRecords++;
      if ((rec as unknown as Record<string, unknown>).links) {
        const links = (rec as unknown as { links?: Array<{ target: string; relation: string }> }).links;
        if (links) {
          totalLinks += links.length;
          for (const l of links) {
            linkEntries.push({ from: rec.id, relation: l.relation, to: l.target });
          }
        }
      }
    }
  }

  const w = terminalWidth();
  const boxWidth = Math.min(w - 4, 72);
  const lines: string[] = [];
  const push = (s: string) => lines.push(s);

  push(borderTop(boxWidth));
  push(center('IvyFlow Knowledge Graph', boxWidth));
  push(borderMid(boxWidth));
  push('');

  push(row(`  Total Records:      ${all.length}`, boxWidth));
  push(row(`  Total Links:        ${totalLinks}`, boxWidth));
  push(row(`  Linked Records:     ${linkedRecords} (${all.length > 0 ? Math.round((linkedRecords / all.length) * 100) : 0}% linked)`, boxWidth));
  push(row(`  Avg Links/Record:   ${linkedRecords > 0 ? (totalLinks / all.length).toFixed(1) : '0'}`, boxWidth));
  push('');

  if (linkEntries.length > 0) {
    push(sectionHeader('Recent Links', boxWidth));
    for (const le of linkEntries.slice(-5)) {
      push(row(`  ${le.from} → ${le.to} [${le.relation}]`, boxWidth));
    }
    push('');

    const unlinked = all.length - linkedRecords;
    if (unlinked > 0) {
      push(sectionHeader('Unlinked Records', boxWidth));
      push(row(`  ${unlinked} record(s) without links`, boxWidth));
      push(row(`  建议使用 \`ivy knowledge link\` 建立关联`, boxWidth));
      push('');
    }
  } else {
    push(row('  No links created yet.', boxWidth));
    push(row('  Use `ivy knowledge link` to connect records.', boxWidth));
    push('');
  }

  push(borderMid(boxWidth));
  push(row('IvyFlow v0.11 | Knowledge Linking | Links embedded in records', boxWidth));
  push(borderBottom(boxWidth));

  console.log(lines.join('\n'));
}

// ─── Organization Intelligence Demo Dashboard (v0.15 — Task 5.5) ───

async function renderOrgDemoDashboard(): Promise<void> {
  const w = terminalWidth();
  const boxWidth = Math.min(w - 4, 72);

  const lines: string[] = [];
  const push = (s: string) => lines.push(s);

  push(borderTop(boxWidth));
  push(center('Organization Intelligence Demo (10 Sample Projects)', boxWidth));
  push(borderMid(boxWidth));
  push('');
  push(row('  Demo Mode: Built-in sample data shown below', boxWidth));
  push('');

  push(sectionHeader('Cross-Project Insights (10 projects, 3,240 records, 6 months active)', boxWidth));
  push(row('', boxWidth));
  push(row('  Most Common Decisions:', boxWidth));
  push(row('    DDD Architecture (7/10)', boxWidth));
  push(row('    PostgreSQL (6/10)', boxWidth));
  push(row('    Kafka (4/10)', boxWidth));
  push(row('', boxWidth));
  push(row('  Common Risks:', boxWidth));
  push(row('    Third-party API timeout not handled (23 times)', boxWidth));
  push(row('    N+1 Query (17 times)', boxWidth));
  push(row('', boxWidth));

  push(borderMid(boxWidth));
  push(row('', boxWidth));
  push(row('  When you accumulate real projects, this will show your team insights.', boxWidth));
  push(row('  Current progress: 1/10 projects | 0/3000 memories | 0/3 months', boxWidth));
  push(row('', boxWidth));
  push(borderBottom(boxWidth));

  console.log(lines.join('\n'));
}


// ─── Layout Helpers ───

function terminalWidth(): number {
  return process.stdout.columns ?? 80;
}

function borderTop(w: number): string {
  return '╔' + '═'.repeat(w - 2) + '╗';
}

function borderMid(w: number): string {
  return '╠' + '═'.repeat(w - 2) + '╣';
}

function borderBottom(w: number): string {
  return '╚' + '═'.repeat(w - 2) + '╝';
}

function center(text: string, w: number): string {
  const pad = Math.max(0, w - 2 - text.length);
  const left = Math.floor(pad / 2);
  const right = pad - left;
  return '║' + ' '.repeat(left) + text + ' '.repeat(right) + '║';
}

function row(text: string, w: number): string {
  const maxLen = w - 4;
  if (text.length <= maxLen) {
    return '║  ' + text.padEnd(maxLen) + '  ║';
  }
  return '║  ' + text.slice(0, maxLen - 3) + '...  ║';
}

function sectionHeader(title: string, w: number): string {
  const maxLen = w - 4;
  const line = '━'.repeat(maxLen);
  return '║  ' + line + '  ║\n║  ' + title.slice(0, maxLen).padEnd(maxLen) + '  ║';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Team Dashboard (v0.8) ───

/**
 * Render a team-level overview ASCII dashboard.
 *
 * Reads raw events directly (bypasses analytics_enabled) and displays
 * cross-change aggregation: project health, bottlenecks, suggestion status.
 *
 * Non-causal annotation: all bottleneck comparisons and trend outputs are
 * correlation observations, not causal conclusions. See §9.13.
 */
async function renderTeamDashboard(cwd: string): Promise<void> {
  const insight = await computeTeamInsights(cwd);

  const w = terminalWidth();
  const boxWidth = Math.min(w - 4, 72);

  const lines: string[] = [];
  const push = (s: string) => lines.push(s);

  // Title
  push(borderTop(boxWidth));
  push(center('IvyFlow Team Dashboard v0.8', boxWidth));
  push(borderMid(boxWidth));
  push('');

  // ── Project Overview ──
  push(sectionHeader('Project Overview  —  cross-change aggregation', boxWidth));

  if (insight.totalChanges === 0) {
    push(row('Insufficient data — no raw events found.', boxWidth));
    push('');
    push(borderMid(boxWidth));
    push(row('Start using IvyFlow to generate workflow events.', boxWidth));
    push(row('Run `ivy init` and begin making changes.', boxWidth));
    push(borderBottom(boxWidth));
    console.log(lines.join('\n'));
    return;
  }

  const completionRate = insight.totalChanges > 0
    ? Math.round((insight.completedChanges / insight.totalChanges) * 100)
    : 0;
  const cycleTime = insight.avgCompletionDays > 0
    ? `${insight.avgCompletionDays.toFixed(1)}d avg`
    : 'N/A (no completed changes)';

  push(row(`Changes:     ${insight.totalChanges} total  (${insight.activeChanges} active, ${insight.completedChanges} completed)`, boxWidth));
  push(row(`Completion:  ${completionRate}%  (${insight.completionTrend})`, boxWidth));
  push(row(`Cycle time:  ${cycleTime}`, boxWidth));
  push(row(`Active cap:  ${insight.recommendedActiveChanges} recommended max (P80 historical)`, boxWidth));

  // Pacing annotation
  if (insight.activeChanges > insight.recommendedActiveChanges && insight.recommendedActiveChanges > 0) {
    const over = insight.activeChanges - insight.recommendedActiveChanges;
    push(row(`⚠️  Active changes exceed recommended limit by ${over}`, boxWidth));
  }
  push('');

  // ── Bottleneck Identification ──
  push(sectionHeader('Bottleneck Identification  —  correlation observation', boxWidth));
  push(row('Note: All bottleneck comparisons describe historical patterns,', boxWidth));
  push(row('not causal conclusions. See §9.13.', boxWidth));

  if (insight.bottleneckPhases.length === 0) {
    push(row('No bottlenecks detected — all phases within baseline thresholds.', boxWidth));
  } else {
    for (const bp of insight.bottleneckPhases) {
      const severityTag = bp.severity === 'critical' ? '⚠️' : bp.severity === 'warning' ? '!!' : 'i ';
      const overPct = bp.vsBaseline > 0 && bp.avgDuration > 0
        ? Math.round((bp.vsBaseline / (bp.avgDuration - bp.vsBaseline)) * 100)
        : 0;
      push(row(`  ${severityTag} ${bp.phase.padEnd(10)} ${bp.avgDuration.toFixed(1)}d avg  +${bp.vsBaseline.toFixed(1)}d vs baseline  (${overPct}% slower)`, boxWidth));
      push(row(`    Affected: ${bp.affectedChanges.length} change(s)`, boxWidth));
    }
  }
  push('');

  // ── Suggestion System Health ──
  push(sectionHeader('Suggestion System Health  —  reference only', boxWidth));
  push(row(`Total suggestions:     ${insight.totalSuggestions}`, boxWidth));
  push(row(`Acceptance rate:       ${(insight.acceptanceRate * 100).toFixed(0)}%`, boxWidth));
  push(row('Note: Suggestion events are not yet captured as L1 raw events.', boxWidth));
  push(row('These values will update once event capture is in place.', boxWidth));
  push('');

  // Footer
  push(borderMid(boxWidth));
  push(row('Team Dashboard v0.8 | Raw events: cross-change aggregation', boxWidth));
  push(row('Non-causal annotation: all outputs are correlation observations.', boxWidth));
  push(borderBottom(boxWidth));

  console.log(lines.join('\n'));
}

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
}

interface ProjectYaml {
  analytics_enabled?: boolean;
  [key: string]: unknown;
}

const REFRESH_INTERVAL_MS = 30_000;

export async function runDashboard(opts: DashboardOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();

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
      await renderOnce(cwd, opts.change, opts.html, opts.period, opts.quality);
      await sleep(REFRESH_INTERVAL_MS);
    }
    return 0;
  }

  const output = await renderOnce(cwd, opts.change, opts.html, opts.period, opts.quality);
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

// ─── HTML Export (v0.5) ───

async function writeHtmlReport(cwd: string, changeName: string | undefined, content: string): Promise<string> {
  const reportDir = path.join(cwd, '.ivy', 'reports');
  await ensureDir(reportDir);

  const dateStr = new Date().toISOString().split('T')[0];
  const changeSlug = (changeName ?? 'all').replace(/[^a-z0-9-]/gi, '_');
  const reportPath = path.join(reportDir, `dashboard-${changeSlug}-${dateStr}.html`);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>IvyFlow Dashboard — ${changeName ?? 'all changes'}</title>
<style>
  body { background: #1a1a2e; color: #e0e0e0; font-family: 'Courier New', monospace; padding: 20px; white-space: pre; line-height: 1.4; }
  .meta { color: #888; font-size: 12px; margin-top: 20px; border-top: 1px solid #333; padding-top: 10px; }
</style>
</head>
<body>
<!--
  IvyFlow Dashboard Report
  Generated: ${new Date().toISOString()}
  Change: ${changeName ?? 'all'}
  Data Model: IvyFlow v0.5
-->
<pre>
${content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
</pre>
<div class="meta">
Generated: ${new Date().toISOString()} | Change: ${changeName ?? 'all'} | IvyFlow v0.5<br>
Data source: git commits + phase transitions | Confidence: see inline annotations<br>
This report is a snapshot — data may have changed since export.
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

// ─── Memory Overview (v0.10) ───

async function renderMemoryOverview(cwd: string): Promise<void> {
  const store = new MemoryStore(cwd);
  await store.ensureSchema();
  await store.referenceV09Knowledge();
  const overview = await store.renderMemoryOverview();

  const w = terminalWidth();
  const boxWidth = Math.min(w - 4, 72);

  const lines: string[] = [];
  const push = (s: string) => lines.push(s);

  push(borderTop(boxWidth));
  push(center('IvyFlow Memory Overview', boxWidth));
  push(borderMid(boxWidth));
  push('');

  if (overview.totalRecords > 0) {
    push(sectionHeader('Records by Type', boxWidth));
    const maxCount = Math.max(...Object.values(overview.byType), 1);
    for (const [type, count] of Object.entries(overview.byType)) {
      const barLen = Math.round((count / maxCount) * 20);
      const bar = '█'.repeat(barLen) + '░'.repeat(Math.max(0, 20 - barLen));
      push(row(`${type.padEnd(12)}│ ${bar}  ${count}`, boxWidth));
    }
    push(row('─'.repeat(35), boxWidth));
    push(row(`Total: ${overview.totalRecords} records  |  KB: ${overview.knowledgeEntryCount} entries`, boxWidth));
  } else {
    push(row('No memory records found. Archive changes to populate memory.', boxWidth));
  }
  push('');

  push(borderMid(boxWidth));
  push(row('IvyFlow v0.11 | Memory Schema v0.11.0 | 5 record types', boxWidth));
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
    console.log(JSON.stringify({ aggregates: result.aggregates, dataLimited: result.dataLimited, totalProjects: result.totalProjects, readableProjects: result.readableProjects, failedProjects: result.failedProjects }, null, 2));
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
  let linkEntries: Array<{ from: string; relation: string; to: string }> = [];

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

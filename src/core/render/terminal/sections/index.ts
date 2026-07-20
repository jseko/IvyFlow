import { box, bar, row, section } from '../layout.js';
import type { DashboardData } from '../../types/render-context.js';

export function renderHeader(data: DashboardData, width?: number): string {
  const { meta } = data;
  return box('AI Engineering Intelligence', [
    row(`Repository: ${meta.repository}`, `Period: ${meta.period.start} ~ ${meta.period.end}`, width),
    row(`Model: ${meta.model}`, `Confidence: ${meta.confidence.toUpperCase()}`, width),
  ].join('\n'), width);
}

export function renderFunnel(data: DashboardData, width?: number): string {
  const f = data.metrics.funnel;
  if (!f) return section('AI Development Funnel', 'No funnel data available.', width);

  const total = f.totalLinesAdded || 1;
  const stages = [
    { label: 'AI Generated', value: total, pct: 100 },
    { label: 'Integrated', value: Math.round(total * f.completionRate), pct: Math.round(f.completionRate * 100) },
  ];

  const lines = stages.map((s) => bar(s.label, s.value, total, width));
  return section('AI Development Funnel', lines.join('\n'), width);
}

export function renderLifecycle(data: DashboardData, width?: number): string {
  const lc = data.metrics.lifecycle;
  if (!lc) return section('Lifecycle Distribution', 'No lifecycle data available.', width);

  const parts: string[] = [];
  parts.push('AI Lifecycle:');
  for (const [state, count] of Object.entries(lc.aiLifecycle)) {
    parts.push(bar(`  ${state}`, count, Math.max(...Object.values(lc.aiLifecycle), 1), width));
  }
  parts.push('');
  parts.push('Git Lifecycle:');
  for (const [state, count] of Object.entries(lc.gitLifecycle)) {
    parts.push(bar(`  ${state}`, count, Math.max(...Object.values(lc.gitLifecycle), 1), width));
  }
  return section('Lifecycle Distribution', parts.join('\n'), width);
}

export function renderAbandonment(data: DashboardData, width?: number): string {
  const a = data.metrics.abandonment;
  if (!a) return section('Abandonment Reasons', 'No abandonment data available.', width);

  const entries = Object.entries(a.byReason);
  const maxVal = Math.max(...entries.map(([, c]) => c), 1);
  const lines = entries.map(([reason, count]) => bar(reason, count, maxVal, width));
  lines.push(row(`Total Abandonment Rate: ${Math.round(a.abandonmentRate * 100)}%`, '', width));
  return section('Abandonment Reasons', lines.join('\n'), width);
}

export function renderFailure(data: DashboardData, width?: number): string {
  const fi = data.metrics.failure;
  if (!fi) return section('Failure Intelligence', 'No failure data available.', width);

  const parts: string[] = [];
  parts.push('Phase Failure Rates:');
  for (const [phase, data] of Object.entries(fi.byPhase)) {
    parts.push(`  ${phase}: ${Math.round(data.rate * 100)}%`);
  }
  if (fi.topFailureModes?.length) {
    parts.push('');
    parts.push('Top Failure Patterns:');
    fi.topFailureModes.forEach((p, i) => {
      parts.push(`  ${i + 1}. ${p.pattern} (${p.count})`);
    });
  }
  return section('Failure Intelligence', parts.join('\n'), width);
}

export function renderValueIndex(data: DashboardData, width?: number): string {
  const vi = data.metrics.value;
  if (!vi) return section('Value Index', 'No value index data available.', width);

  const parts = [
    row(`Value Index: ${vi.valueIndex.toFixed(2)}`, '', width),
    row(`Retention: ${Math.round(vi.retentionRatio * 100)}%`, '', width),
    row(`Rework: ${Math.round(vi.reworkCost * 100)}%`, '', width),
    row(`Abandonment: ${Math.round(vi.abandonmentRate * 100)}%`, '', width),
  ];
  return section('Value Index', parts.join('\n'), width);
}

export function renderCSI(data: DashboardData, width?: number): string {
  const csi = data.metrics.csi;
  if (!csi) return section('Context Intelligence', 'No CSI data available.', width);

  const parts = [
    row(`CSI: ${Math.round(csi.csi * 100)}%`, `Task Type: ${csi.taskType}`, width),
    row(`Confidence: ${csi.confidence}`, '', width),
  ];
  return section('Context Intelligence', parts.join('\n'), width);
}

export function renderFeedback(data: DashboardData, width?: number): string {
  const fb = data.metrics.feedback;
  if (!fb) return section('Feedback Loop', 'No feedback data available.', width);

  const { summary } = fb;
  const entries: [string, number][] = [
    ['Accepted & Kept', summary.acceptedAndKept],
    ['Accepted Then Modified', summary.acceptedThenModified],
    ['Accepted Then Deleted', summary.acceptedThenDeleted],
    ['Rejected Outright', summary.rejectedOutright],
    ['Unknown', summary.unknown],
  ];
  const maxVal = Math.max(...entries.map(([, c]) => c), 1);
  const parts = entries.map(([label, count]) => bar(label, count, maxVal, width));
  return section('Feedback Loop', parts.join('\n'), width);
}

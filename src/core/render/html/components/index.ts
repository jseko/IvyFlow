import { escapeHtml } from '../../utils/escape-html.js';
import type { DashboardData, DashboardMeta } from '../../types/render-context.js';

export function renderHeader(meta: DashboardMeta): string {
  return `
<header>
  <h1>IvyFlow AI Engineering Intelligence</h1>
  <div class="meta">
    Repository: ${escapeHtml(meta.repository)} &nbsp;|&nbsp;
    Period: ${escapeHtml(meta.period.start)} ~ ${escapeHtml(meta.period.end)} &nbsp;|&nbsp;
    Model: ${escapeHtml(meta.model)} &nbsp;|&nbsp;
    Confidence: ${escapeHtml(meta.confidence.toUpperCase())}
  </div>
</header>`;
}

export function renderExecutiveSummary(data: DashboardData): string {
  const { metrics } = data;
  const kpis: { val: string; lbl: string }[] = [];

  if (metrics.value) {
    kpis.push({ val: metrics.value.valueIndex.toFixed(2), lbl: 'Value Index' });
    kpis.push({ val: `${Math.round(metrics.value.retentionRatio * 100)}%`, lbl: 'Retention' });
    kpis.push({ val: `${Math.round(metrics.value.reworkCost * 100)}%`, lbl: 'Rework' });
    kpis.push({ val: `${Math.round(metrics.value.abandonmentRate * 100)}%`, lbl: 'Abandonment' });
  }
  if (metrics.csi) {
    kpis.push({ val: `${Math.round(metrics.csi.csi * 100)}%`, lbl: 'CSI' });
  }

  if (kpis.length === 0) return '';

  return `<div class="kpi-grid">${kpis.map((k) => `<div class="kpi"><div class="val">${escapeHtml(k.val)}</div><div class="lbl">${escapeHtml(k.lbl)}</div></div>`).join('')}</div>`;
}

export function renderFunnel(data: DashboardData): string {
  const f = data.metrics.funnel;
  if (!f) return '';

  const total = f.totalLinesAdded || 1;
  const stages = [
    { label: 'AI Generated', value: total, pct: 100 },
    { label: 'Integrated', value: Math.round(total * f.completionRate), pct: Math.round(f.completionRate * 100) },
  ];

  const bars = stages.map((s) => `
    <div class="bar-wrap">
      <span class="bar-label">${escapeHtml(s.label)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${s.pct}%"></div></div>
      <span class="bar-pct">${s.value.toLocaleString()} (${s.pct}%)</span>
    </div>`).join('');

  return `<section><h2>AI Development Funnel</h2>${bars}</section>`;
}

export function renderLifecycle(data: DashboardData): string {
  const lc = data.metrics.lifecycle;
  if (!lc) return '';

  const renderDim = (title: string, dim: Record<string, number>) => {
    const maxVal = Math.max(...Object.values(dim), 1);
    const bars = Object.entries(dim).map(([k, v]) => `
      <div class="bar-wrap">
        <span class="bar-label">${escapeHtml(k)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round(v / maxVal * 100)}%"></div></div>
        <span class="bar-pct">${v}</span>
      </div>`).join('');
    return `<details open><summary>${escapeHtml(title)}</summary><div class="content">${bars}</div></details>`;
  };

  return `<section><h2>Lifecycle Distribution</h2>
    ${renderDim('AI Lifecycle', lc.aiLifecycle)}
    ${renderDim('Git Lifecycle', lc.gitLifecycle)}
    ${renderDim('Runtime Lifecycle', lc.runtimeLifecycle)}
  </section>`;
}

export function renderAbandonment(data: DashboardData): string {
  const a = data.metrics.abandonment;
  if (!a) return '';

  const byReason = a.byReason;
  const entries = Object.entries(byReason);
  if (entries.length === 0) return '';
  const maxVal = Math.max(...entries.map(([, c]) => c), 1);
  const bars = entries.map(([k, v]) => `
    <div class="bar-wrap">
      <span class="bar-label">${escapeHtml(k)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(v / maxVal * 100)}%"></div></div>
      <span class="bar-pct">${v}</span>
    </div>`).join('');

  return `<section><h2>Abandonment Reasons</h2>${bars}
    <div class="row"><span class="label">Total Rate</span><span class="value">${Math.round(a.abandonmentRate * 100)}%</span></div>
  </section>`;
}

export function renderFailure(data: DashboardData): string {
  const fi = data.metrics.failure;
  if (!fi) return '';

  const rates = Object.entries(fi.byPhase).map(([k, v]) =>
    `<div class="row"><span class="label">${escapeHtml(k)}</span><span class="value">${Math.round(v.rate * 100)}%</span></div>`
  ).join('');

  const patterns = fi.topFailureModes?.map((p, i) =>
    `<div class="row"><span class="label">${i + 1}. ${escapeHtml(p.pattern)}</span><span class="value">${p.count}</span></div>`
  ).join('') ?? '';

  return `<section><h2>Failure Intelligence</h2>${rates}${patterns ? `<br>${patterns}` : ''}</section>`;
}

export function renderValueIndex(data: DashboardData): string {
  const vi = data.metrics.value;
  if (!vi) return '';

  return `<section><h2>Value Index</h2>
    <div class="row"><span class="label">Value Index</span><span class="value">${vi.valueIndex.toFixed(2)}</span></div>
    <div class="row"><span class="label">Quality Factor</span><span class="value">${vi.qualityFactor.toFixed(2)}</span></div>
    <div class="row"><span class="label">Business Impact</span><span class="value">${escapeHtml(vi.businessImpactType)} (${vi.businessImpactWeight})</span></div>
    <div class="row"><span class="label">Retention</span><span class="value">${Math.round(vi.retentionRatio * 100)}%</span></div>
    <div class="row"><span class="label">Rework</span><span class="value">${Math.round(vi.reworkCost * 100)}%</span></div>
    <div class="row"><span class="label">Abandonment</span><span class="value">${Math.round(vi.abandonmentRate * 100)}%</span></div>
  </section>`;
}

export function renderCSI(data: DashboardData): string {
  const csi = data.metrics.csi;
  if (!csi) return '';

  const dimBars = csi.dimensions.map((d) => `
    <div class="bar-wrap">
      <span class="bar-label">${escapeHtml(d.dimension)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(d.ratio * 100)}%"></div></div>
      <span class="bar-pct">${Math.round(d.ratio * 100)}% (${d.available}/${d.required})</span>
    </div>`).join('');

  return `<section><h2>Context Intelligence</h2>
    <div class="row"><span class="label">CSI</span><span class="value">${Math.round(csi.csi * 100)}%</span></div>
    <div class="row"><span class="label">Task Type</span><span class="value">${escapeHtml(csi.taskType)}</span></div>
    <div class="row"><span class="label">Confidence</span><span class="value">${escapeHtml(csi.confidence)}</span></div>
    ${dimBars}
  </section>`;
}

export function renderFeedback(data: DashboardData): string {
  const fb = data.metrics.feedback;
  if (!fb) return '';

  const { summary } = fb;
  const entries: [string, number][] = [
    ['Accepted & Kept', summary.acceptedAndKept],
    ['Accepted Then Modified', summary.acceptedThenModified],
    ['Accepted Then Deleted', summary.acceptedThenDeleted],
    ['Rejected Outright', summary.rejectedOutright],
    ['Unknown', summary.unknown],
  ];
  const maxVal = Math.max(...entries.map(([, c]) => c), 1);
  const bars = entries.map(([label, count]) => `
    <div class="bar-wrap">
      <span class="bar-label">${escapeHtml(label)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(count / maxVal * 100)}%"></div></div>
      <span class="bar-pct">${count}</span>
    </div>`).join('');

  return `<section><h2>Feedback Loop</h2>${bars}</section>`;
}

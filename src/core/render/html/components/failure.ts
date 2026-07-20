import { escapeHtml } from '../../utils/escape-html.js';
import type { DashboardData } from '../../types/render-context.js';

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

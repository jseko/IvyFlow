import { escapeHtml } from '../../utils/escape-html.js';
import type { DashboardData } from '../../types/render-context.js';

export function renderAbandonment(data: DashboardData): string {
  const a = data.metrics.abandonment;
  if (!a) return '';
  const entries = Object.entries(a.byReason);
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

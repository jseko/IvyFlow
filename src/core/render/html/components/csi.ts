import { escapeHtml } from '../../utils/escape-html.js';
import type { DashboardData } from '../../types/render-context.js';

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

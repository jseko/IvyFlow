import { escapeHtml } from '../../utils/escape-html.js';
import type { DashboardData } from '../../types/render-context.js';

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

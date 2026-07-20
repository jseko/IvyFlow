import { escapeHtml } from '../../utils/escape-html.js';
import type { DashboardData } from '../../types/render-context.js';

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

import { escapeHtml } from '../../utils/escape-html.js';
import type { DashboardData } from '../../types/render-context.js';

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

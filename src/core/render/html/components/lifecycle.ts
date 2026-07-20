import { escapeHtml } from '../../utils/escape-html.js';
import type { DashboardData } from '../../types/render-context.js';

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

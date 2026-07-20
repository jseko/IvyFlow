import { escapeHtml } from '../../utils/escape-html.js';
import type { DashboardData } from '../../types/render-context.js';

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

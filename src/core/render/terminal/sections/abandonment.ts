import { bar, row, section } from '../layout.js';
import type { DashboardData } from '../../types/render-context.js';

export function renderAbandonment(data: DashboardData, width?: number): string {
  const a = data.metrics.abandonment;
  if (!a) return section('Abandonment Reasons', 'No abandonment data available.', width);

  const entries = Object.entries(a.byReason);
  const maxVal = Math.max(...entries.map(([, c]) => c), 1);
  const lines = entries.map(([reason, count]) => bar(reason, count, maxVal, width));
  lines.push(row(`Total Abandonment Rate: ${Math.round(a.abandonmentRate * 100)}%`, '', width));
  return section('Abandonment Reasons', lines.join('\n'), width);
}

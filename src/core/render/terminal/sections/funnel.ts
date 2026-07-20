import { bar, section } from '../layout.js';
import type { DashboardData } from '../../types/render-context.js';

export function renderFunnel(data: DashboardData, width?: number): string {
  const f = data.metrics.funnel;
  if (!f) return section('AI Development Funnel', 'No funnel data available.', width);

  const total = f.totalLinesAdded || 1;
  const stages = [
    { label: 'AI Generated', value: total, pct: 100 },
    { label: 'Integrated', value: Math.round(total * f.completionRate), pct: Math.round(f.completionRate * 100) },
  ];

  const lines = stages.map((s) => bar(s.label, s.value, total, width));
  return section('AI Development Funnel', lines.join('\n'), width);
}

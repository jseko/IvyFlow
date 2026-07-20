import { row, section } from '../layout.js';
import type { DashboardData } from '../../types/render-context.js';

export function renderValueIndex(data: DashboardData, width?: number): string {
  const vi = data.metrics.value;
  if (!vi) return section('Value Index', 'No value index data available.', width);

  const parts = [
    row(`Value Index: ${vi.valueIndex.toFixed(2)}`, '', width),
    row(`Retention: ${Math.round(vi.retentionRatio * 100)}%`, '', width),
    row(`Rework: ${Math.round(vi.reworkCost * 100)}%`, '', width),
    row(`Abandonment: ${Math.round(vi.abandonmentRate * 100)}%`, '', width),
  ];
  return section('Value Index', parts.join('\n'), width);
}

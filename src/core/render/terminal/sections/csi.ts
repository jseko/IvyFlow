import { row, section } from '../layout.js';
import type { DashboardData } from '../../types/render-context.js';

export function renderCSI(data: DashboardData, width?: number): string {
  const csi = data.metrics.csi;
  if (!csi) return section('Context Intelligence', 'No CSI data available.', width);

  const parts = [
    row(`CSI: ${Math.round(csi.csi * 100)}%`, `Task Type: ${csi.taskType}`, width),
    row(`Confidence: ${csi.confidence}`, '', width),
  ];
  return section('Context Intelligence', parts.join('\n'), width);
}

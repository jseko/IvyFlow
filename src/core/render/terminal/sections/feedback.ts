import { bar, section } from '../layout.js';
import type { DashboardData } from '../../types/render-context.js';

export function renderFeedback(data: DashboardData, width?: number): string {
  const fb = data.metrics.feedback;
  if (!fb) return section('Feedback Loop', 'No feedback data available.', width);

  const { summary } = fb;
  const entries: [string, number][] = [
    ['Accepted & Kept', summary.acceptedAndKept],
    ['Accepted Then Modified', summary.acceptedThenModified],
    ['Accepted Then Deleted', summary.acceptedThenDeleted],
    ['Rejected Outright', summary.rejectedOutright],
    ['Unknown', summary.unknown],
  ];
  const maxVal = Math.max(...entries.map(([, c]) => c), 1);
  const parts = entries.map(([label, count]) => bar(label, count, maxVal, width));
  return section('Feedback Loop', parts.join('\n'), width);
}

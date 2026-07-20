import { bar, section } from '../layout.js';
import type { DashboardData } from '../../types/render-context.js';

export function renderLifecycle(data: DashboardData, width?: number): string {
  const lc = data.metrics.lifecycle;
  if (!lc) return section('Lifecycle Distribution', 'No lifecycle data available.', width);

  const parts: string[] = [];
  parts.push('AI Lifecycle:');
  for (const [state, count] of Object.entries(lc.aiLifecycle)) {
    parts.push(bar(`  ${state}`, count, Math.max(...Object.values(lc.aiLifecycle), 1), width));
  }
  parts.push('');
  parts.push('Git Lifecycle:');
  for (const [state, count] of Object.entries(lc.gitLifecycle)) {
    parts.push(bar(`  ${state}`, count, Math.max(...Object.values(lc.gitLifecycle), 1), width));
  }
  return section('Lifecycle Distribution', parts.join('\n'), width);
}

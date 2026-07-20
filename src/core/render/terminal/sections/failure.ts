import { section } from '../layout.js';
import type { DashboardData } from '../../types/render-context.js';

export function renderFailure(data: DashboardData, width?: number): string {
  const fi = data.metrics.failure;
  if (!fi) return section('Failure Intelligence', 'No failure data available.', width);

  const parts: string[] = [];
  parts.push('Phase Failure Rates:');
  for (const [phase, phaseData] of Object.entries(fi.byPhase)) {
    parts.push(`  ${phase}: ${Math.round(phaseData.rate * 100)}%`);
  }
  if (fi.topFailureModes?.length) {
    parts.push('');
    parts.push('Top Failure Patterns:');
    fi.topFailureModes.forEach((p, i) => {
      parts.push(`  ${i + 1}. ${p.pattern} (${p.count})`);
    });
  }
  return section('Failure Intelligence', parts.join('\n'), width);
}

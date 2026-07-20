import { box, row } from '../layout.js';
import type { DashboardData } from '../../types/render-context.js';

export function renderHeader(data: DashboardData, width?: number): string {
  const { meta } = data;
  return box('AI Engineering Intelligence', [
    row(`Repository: ${meta.repository}`, `Period: ${meta.period.start} ~ ${meta.period.end}`, width),
    row(`Model: ${meta.model}`, `Confidence: ${meta.confidence.toUpperCase()}`, width),
  ].join('\n'), width);
}

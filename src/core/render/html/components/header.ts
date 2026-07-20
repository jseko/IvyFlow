import { escapeHtml } from '../../utils/escape-html.js';
import type { DashboardMeta } from '../../types/render-context.js';

export function renderHeader(meta: DashboardMeta): string {
  return `
<header>
  <h1>IvyFlow AI Engineering Intelligence</h1>
  <div class="meta">
    Repository: ${escapeHtml(meta.repository)} &nbsp;|&nbsp;
    Period: ${escapeHtml(meta.period.start)} ~ ${escapeHtml(meta.period.end)} &nbsp;|&nbsp;
    Model: ${escapeHtml(meta.model)} &nbsp;|&nbsp;
    Confidence: ${escapeHtml(meta.confidence.toUpperCase())}
  </div>
</header>`;
}

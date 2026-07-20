import type { DashboardRenderer, RenderResult } from '../types/renderer.js';
import type { RenderContext } from '../types/render-context.js';
import { assembleHtmlDoc } from './template.js';
import {
  renderHeader,
  renderExecutiveSummary,
  renderFunnel,
  renderLifecycle,
  renderAbandonment,
  renderFailure,
  renderValueIndex,
  renderCSI,
  renderFeedback,
} from './components/index.js';

export class HtmlRenderer implements DashboardRenderer {
  render(ctx: RenderContext): RenderResult {
    const { data, options } = ctx;
    const sections: string[] = [];

    sections.push(renderHeader(data.meta));
    sections.push(renderExecutiveSummary(data));

    const { panels } = options;
    if (panels.includes('funnel')) sections.push(renderFunnel(data));
    if (panels.includes('lifecycle')) sections.push(renderLifecycle(data));
    if (panels.includes('abandonment')) sections.push(renderAbandonment(data));
    if (panels.includes('failure')) sections.push(renderFailure(data));
    if (panels.includes('value')) sections.push(renderValueIndex(data));
    if (panels.includes('csi')) sections.push(renderCSI(data));
    if (panels.includes('feedback')) sections.push(renderFeedback(data));

    return {
      content: assembleHtmlDoc(data.meta, sections),
      mimeType: 'text/html',
      extension: '.html',
    };
  }
}

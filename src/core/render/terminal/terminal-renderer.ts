import type { DashboardRenderer, RenderResult } from '../types/renderer.js';
import type { RenderContext } from '../types/render-context.js';
import {
  renderHeader,
  renderFunnel,
  renderLifecycle,
  renderAbandonment,
  renderFailure,
  renderValueIndex,
  renderCSI,
  renderFeedback,
} from './sections/index.js';

export class TerminalRenderer implements DashboardRenderer {
  render(ctx: RenderContext): RenderResult {
    const { data, options } = ctx;
    const width = options.width;
    const sections: string[] = [];

    sections.push(renderHeader(data, width));

    const { panels } = options;
    if (panels.includes('funnel')) sections.push(renderFunnel(data, width));
    if (panels.includes('lifecycle')) sections.push(renderLifecycle(data, width));
    if (panels.includes('abandonment')) sections.push(renderAbandonment(data, width));
    if (panels.includes('failure')) sections.push(renderFailure(data, width));
    if (panels.includes('value')) sections.push(renderValueIndex(data, width));
    if (panels.includes('csi')) sections.push(renderCSI(data, width));
    if (panels.includes('feedback')) sections.push(renderFeedback(data, width));

    return {
      content: sections.join('\n'),
      mimeType: 'text/plain',
      extension: '.txt',
    };
  }
}

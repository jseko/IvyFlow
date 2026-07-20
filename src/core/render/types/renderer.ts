export interface RenderResult {
  content: string;
  mimeType: string;
  extension: string;
}

export interface DashboardRenderer {
  render(ctx: import('./render-context.js').RenderContext): RenderResult;
}

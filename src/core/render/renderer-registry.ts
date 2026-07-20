import type { DashboardRenderer } from './types/renderer.js';
import type { RenderFormat } from './types/render-context.js';

const registry = new Map<string, () => DashboardRenderer>();

export function registerRenderer(format: RenderFormat, factory: () => DashboardRenderer): void {
  registry.set(format, factory);
}

export function getRenderer(format: RenderFormat): DashboardRenderer {
  const factory = registry.get(format);
  if (!factory) {
    const supported = [...registry.keys()].join(', ');
    throw new Error(`Unknown render format: ${format}. Supported: ${supported}`);
  }
  return factory();
}

export function getSupportedFormats(): RenderFormat[] {
  return [...registry.keys()] as RenderFormat[];
}

import { describe, it, expect } from 'vitest';
import { HtmlRenderer } from './html-renderer.js';
import type { RenderContext } from '../types/render-context.js';

const baseCtx: RenderContext = {
  data: {
    meta: {
      repository: 'test-repo',
      period: { start: '2026-07-01', end: '2026-07-17' },
      model: 'heuristic-v0.1',
      confidence: 'medium',
    },
    metrics: {},
  },
  options: { panels: [], format: 'html', width: 80 },
};

describe('HtmlRenderer', () => {
  it('renders valid HTML document', () => {
    const result = new HtmlRenderer().render(baseCtx);
    expect(result.mimeType).toBe('text/html');
    expect(result.extension).toBe('.html');
    expect(result.content).toContain('<!DOCTYPE html>');
    expect(result.content).toContain('<html');
    expect(result.content).toContain('<head>');
    expect(result.content).toContain('<body>');
    expect(result.content).toContain('IvyFlow');
  });

  it('escapes script tag in repository name', () => {
    const ctx: RenderContext = {
      ...baseCtx,
      data: {
        ...baseCtx.data,
        meta: { ...baseCtx.data.meta, repository: '<script>alert(1)</script>' },
      },
    };
    const result = new HtmlRenderer().render(ctx);
    expect(result.content).not.toContain('<script>alert(1)</script>');
    expect(result.content).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('renders funnel panel', () => {
    const ctx: RenderContext = {
      ...baseCtx,
      data: {
        ...baseCtx.data,
        metrics: {
          funnel: {
            totalCommits: 10, totalFilesChanged: 5, totalLinesAdded: 1000,
            totalChanges: 3, completedChanges: 2, completionRate: 0.67,
          },
        },
      },
      options: { ...baseCtx.options, panels: ['funnel'] },
    };
    const result = new HtmlRenderer().render(ctx);
    expect(result.content).toContain('AI Development Funnel');
    expect(result.content).toContain('AI Generated');
  });

  it('respects panel flags', () => {
    const ctx: RenderContext = {
      ...baseCtx,
      data: {
        ...baseCtx.data,
        metrics: {
          value: { valueIndex: 0.68, qualityFactor: 0.80, businessImpactType: 'unknown', businessImpactWeight: 1.0, retentionRatio: 0.85, reworkCost: 0.15, abandonmentRate: 0.26 },
          csi: { csi: 0.72, taskType: 'GENERATE', confidence: 'medium', dimensions: [] },
        },
      },
      options: { ...baseCtx.options, panels: ['value', 'csi'] },
    };
    const result = new HtmlRenderer().render(ctx);
    expect(result.content).toContain('Value Index');
    expect(result.content).toContain('Context Intelligence');
    expect(result.content).not.toContain('AI Development Funnel');
  });

  it('no external CDN or script references', () => {
    const result = new HtmlRenderer().render(baseCtx);
    expect(result.content).not.toContain('http://');
    expect(result.content).not.toContain('https://');
    expect(result.content).not.toContain('<script src=');
  });
});

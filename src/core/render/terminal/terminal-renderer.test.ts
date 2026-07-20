import { describe, it, expect } from 'vitest';
import { TerminalRenderer } from './terminal-renderer.js';
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
  options: { panels: [], format: 'terminal', width: 80 },
};

describe('TerminalRenderer', () => {
  it('renders header with meta', () => {
    const result = new TerminalRenderer().render(baseCtx);
    expect(result.mimeType).toBe('text/plain');
    expect(result.extension).toBe('.txt');
    expect(result.content).toContain('AI Engineering Intelligence');
    expect(result.content).toContain('test-repo');
  });

  it('renders funnel panel', () => {
    const ctx: RenderContext = {
      ...baseCtx,
      data: {
        ...baseCtx.data,
        metrics: {
          funnel: {
            totalCommits: 10,
            totalFilesChanged: 5,
            totalLinesAdded: 1000,
            totalChanges: 3,
            completedChanges: 2,
            completionRate: 0.67,
          },
        },
      },
      options: { ...baseCtx.options, panels: ['funnel'] },
    };
    const result = new TerminalRenderer().render(ctx);
    expect(result.content).toContain('AI Development Funnel');
    expect(result.content).toContain('AI Generated');
  });

  it('renders lifecycle panel', () => {
    const ctx: RenderContext = {
      ...baseCtx,
      data: {
        ...baseCtx.data,
        metrics: {
          lifecycle: {
            aiLifecycle: { CREATED: 100, GENERATED: 80, ADOPTED: 60 },
            gitLifecycle: { NONE: 40, COMMITTED: 30, MERGED: 20 },
            runtimeLifecycle: { NONE: 80, DEPLOYED: 10, STABLE: 5 },
          },
        },
      },
      options: { ...baseCtx.options, panels: ['lifecycle'] },
    };
    const result = new TerminalRenderer().render(ctx);
    expect(result.content).toContain('Lifecycle Distribution');
    expect(result.content).toContain('AI Lifecycle');
    expect(result.content).toContain('Git Lifecycle');
  });

  it('respects panel flags', () => {
    const ctx: RenderContext = {
      ...baseCtx,
      options: { ...baseCtx.options, panels: ['funnel', 'value'] },
    };
    const result = new TerminalRenderer().render(ctx);
    expect(result.content).toContain('AI Development Funnel');
    expect(result.content).toContain('Value Index');
    expect(result.content).not.toContain('Lifecycle Distribution');
    expect(result.content).not.toContain('Context Intelligence');
  });

  it('produces deterministic output', () => {
    const r1 = new TerminalRenderer().render(baseCtx);
    const r2 = new TerminalRenderer().render(baseCtx);
    expect(r1.content).toBe(r2.content);
  });
});

import { describe, it, expect } from 'vitest';
import { getRenderer, registerRenderer, getSupportedFormats, escapeHtml } from './index.js';
import type { DashboardRenderer } from './index.js';

describe('Renderer Registry', () => {
  it('throws for unknown format', () => {
    expect(() => getRenderer('terminal')).toThrow('Unknown render format');
  });

  it('returns registered renderer', () => {
    const mock: DashboardRenderer = {
      render: () => ({ content: 'test', mimeType: 'text/plain', extension: '.txt' }),
    };
    registerRenderer('terminal', () => mock);
    expect(getRenderer('terminal')).toBe(mock);
  });

  it('lists supported formats', () => {
    expect(getSupportedFormats()).toContain('terminal');
  });
});

describe('escapeHtml', () => {
  it('escapes script tag', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('passes safe strings unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

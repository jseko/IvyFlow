/**
 * Per-platform rule/hook rendering — physical-split entry point.
 * Pure switch forwarding only. design.md §9.1 / D2: ≤ 30 lines, no interfaces.
 *
 * v0.32: Also exports Dashboard Renderer types and utilities.
 */
import { renderRuleAsMdc } from './rule-mdc.js';
import { renderRuleAsCopilot } from './rule-copilot.js';
import { renderHookForWindsurf } from './hook-windsurf.js';
import { renderHookForCursor } from './hook-cursor.js';
import { renderHookForGemini } from './hook-gemini.js';
import { renderHookForQwen } from './hook-qwen.js';
import { renderHookForKiro } from './hook-kiro.js';
import type { RuleFormat, HookFormat } from '../platforms.js';

// Dashboard Renderer types (v0.32)
export {
  type DashboardRenderer,
  type RenderResult,
} from './types/renderer.js';
export {
  type DashboardData,
  type DashboardMeta,
  type DashboardMetrics,
  type LifecycleDistribution,
  type RenderFormat,
  type RenderOptions,
  type RenderContext,
} from './types/render-context.js';
export { escapeHtml } from './utils/escape-html.js';
export { registerRenderer, getRenderer, getSupportedFormats } from './renderer-registry.js';

export function renderRule(format: RuleFormat, mdContent: string): string {
  if (format === 'md') return mdContent;
  if (format === 'mdc') return renderRuleAsMdc(mdContent);
  if (format === 'copilot') return renderRuleAsCopilot(mdContent);
  throw new Error(`unsupported ruleFormat: ${String(format)}`);
}
export function renderHook(format: HookFormat): string {
  if (format === 'windsurf-json') return renderHookForWindsurf();
  if (format === 'cursor-json') return renderHookForCursor();
  if (format === 'gemini') return renderHookForGemini();
  if (format === 'qwen') return renderHookForQwen();
  if (format === 'kiro') return renderHookForKiro();
  throw new Error(`unsupported hookFormat: ${String(format)}`);
}

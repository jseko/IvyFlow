/**
 * Per-platform rule/hook rendering — physical-split entry point.
 * Pure switch forwarding only. design.md §9.1 / D2: ≤ 30 lines, no interfaces.
 */

import { renderRuleAsMdc } from './rule-mdc.js';
import { renderRuleAsCopilot } from './rule-copilot.js';
import { renderHookForWindsurf } from './hook-windsurf.js';
import type { RuleFormat, HookFormat } from '../platforms.js';

export function renderRule(format: RuleFormat, mdContent: string): string {
  if (format === 'md') return mdContent;
  if (format === 'mdc') return renderRuleAsMdc(mdContent);
  if (format === 'copilot') return renderRuleAsCopilot(mdContent);
  throw new Error(`unsupported ruleFormat: ${String(format)}`);
}

export function renderHook(format: HookFormat): string {
  if (format === 'windsurf-json') return renderHookForWindsurf();
  if (format === 'claude-code') {
    throw new Error('claude-code hook is shipped as static asset, not rendered');
  }
  throw new Error(`unsupported hookFormat: ${String(format)}`);
}

export { renderRuleAsMdc, renderRuleAsCopilot, renderHookForWindsurf };

import { describe, it, expect } from 'vitest';
import {
  renderRule,
  renderHook,
  renderRuleAsMdc,
  renderRuleAsCopilot,
  renderHookForWindsurf,
  renderHookForGemini,
  renderHookForQwen,
  renderHookForKiro,
} from './index.js';

describe('render/index', () => {
  it('md format passes through unchanged', () => {
    const md = '# hello\n- ✅ rule a\n';
    expect(renderRule('md', md)).toBe(md);
  });

  it('mdc format wraps with frontmatter', () => {
    const out = renderRule('mdc', '# body');
    expect(out.startsWith('---')).toBe(true);
    expect(out).toContain('alwaysApply: true');
    expect(out).toContain('# body');
  });

  it('copilot format flattens to DO/DO NOT', () => {
    const md = '- ✅ keep tasks small\n- ❌ skip tests\n';
    const out = renderRule('copilot', md);
    expect(out).toContain('## DO');
    expect(out).toContain('## DO NOT');
  });

  it('throws for unsupported ruleFormat', () => {
    expect(() => renderRule('xxx' as never, 'a')).toThrowError(/unsupported ruleFormat/);
  });

  it('windsurf-json hook renders valid JSON with PreToolUse event', () => {
    const out = renderHook('windsurf-json');
    const parsed = JSON.parse(out);
    expect(parsed.event).toBe('PreToolUse');
    expect(parsed.name).toBe('ivy-phase-guard');
    expect(Array.isArray(parsed.match.tools)).toBe(true);
  });

  it('claude-code hook is shipped statically and rejects render', () => {
    expect(() => renderHook('claude-code')).toThrowError(/static asset/);
  });

  it('gemini hook renders valid JSON with beforeTool and Certified command', () => {
    const out = renderHook('gemini');
    const parsed = JSON.parse(out);
    expect(parsed.beforeTool).toBeDefined();
    expect(parsed.beforeTool.command).toContain('ivy validate');
  });

  it('qwen hook renders valid JSON with preToolUse and Experimental label', () => {
    const out = renderHook('qwen');
    const parsed = JSON.parse(out);
    expect(parsed.preToolUse).toBeDefined();
    expect(parsed.preToolUse.enabled).toBe(true);
    expect(parsed.preToolUse.description).toContain('Experimental');
  });

  it('kiro hook renders valid JSON with preToolUse type and Experimental label', () => {
    const out = renderHook('kiro');
    const parsed = JSON.parse(out);
    expect(parsed.hook).toBeDefined();
    expect(parsed.hook.type).toBe('preToolUse');
    expect(parsed.hook.label).toContain('Experimental');
  });
});

describe('renderHookForGemini', () => {
  it('renders beforeTool command with ivy validate', () => {
    const parsed = JSON.parse(renderHookForGemini());
    expect(parsed.beforeTool.command).toContain('ivy validate');
  });
});

describe('renderHookForQwen', () => {
  it('renders preToolUse with enabled script and Experimental label', () => {
    const parsed = JSON.parse(renderHookForQwen());
    expect(parsed.preToolUse.enabled).toBe(true);
    expect(parsed.preToolUse.script).toContain('.ivy/hooks/ivy-phase-guard.sh');
    expect(parsed.preToolUse.description).toContain('Experimental');
  });
});

describe('renderHookForKiro', () => {
  it('renders hook with type preToolUse and Experimental label', () => {
    const parsed = JSON.parse(renderHookForKiro());
    expect(parsed.hook.type).toBe('preToolUse');
    expect(parsed.hook.command).toContain('ivy-phase-guard.sh');
    expect(parsed.hook.label).toContain('Experimental');
  });
});

describe('renderRuleAsMdc', () => {
  it('normalises CRLF to LF', () => {
    const out = renderRuleAsMdc('a\r\nb');
    expect(out).not.toContain('\r');
    expect(out.endsWith('a\nb')).toBe(true);
  });
});

describe('renderRuleAsCopilot', () => {
  it('extracts ✅ as DO and ❌ as DO NOT', () => {
    const out = renderRuleAsCopilot('- ✅ alpha\n- ❌ beta\n# heading\nrandom');
    expect(out).toMatch(/## DO\n- ✅ alpha/);
    expect(out).toMatch(/## DO NOT\n- ❌ beta/);
  });

  it('falls back to placeholder when nothing matches', () => {
    const out = renderRuleAsCopilot('# only a heading\nrandom prose');
    expect(out).toContain('(no DO rules extracted)');
    expect(out).toContain('(no DO NOT rules extracted)');
  });

  it('classifies MUST / MUST NOT keywords', () => {
    const out = renderRuleAsCopilot('MUST run tests\nMUST NOT push to main');
    expect(out).toContain('- MUST run tests');
    expect(out).toContain('- MUST NOT push to main');
  });
});

describe('renderHookForWindsurf', () => {
  it('blocks Edit/Write/NotebookEdit by default', () => {
    const parsed = JSON.parse(renderHookForWindsurf());
    expect(parsed.match.tools).toContain('Edit');
    expect(parsed.match.tools).toContain('Write');
    expect(parsed.blockOnNonZeroExit).toBe(true);
  });
});

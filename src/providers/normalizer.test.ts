import { describe, it, expect } from 'vitest';
import { ProviderNormalizer } from './normalizer.js';

describe('ProviderNormalizer', () => {
  const normalizer = new ProviderNormalizer();

  it('normalizes a Claude Code intermediate event to AIAction', () => {
    const action = normalizer.normalize({
      name: 'claude-code',
      operation: 'GENERATE',
      rawEvent: {
        tool_name: 'Write',
        tool_input: { file_path: 'src/index.ts', content: 'hello' },
      },
    });
    expect(action.id).toMatch(/^act_/);
    expect(action.provider).toBe('claude-code');
    expect(action.operation).toBe('GENERATE');
    expect(action.artifact.path).toBe('src/index.ts');
    expect(action.metadata.toolName).toBe('Write');
  });

  it('normalizes an Edit event to AIAction with EDIT operation', () => {
    const action = normalizer.normalize({
      name: 'claude-code',
      operation: 'EDIT',
      rawEvent: {
        tool_name: 'Edit',
        tool_input: { file_path: 'src/index.ts', old_string: 'a', new_string: 'b' },
      },
    });
    expect(action.operation).toBe('EDIT');
    expect(action.artifact.path).toBe('src/index.ts');
  });

  it('generates unique IDs for each call', () => {
    const event = { name: 'test', operation: 'GENERATE' as const, rawEvent: { tool_input: { file_path: 'a.ts' } } };
    const a1 = normalizer.normalize(event);
    const a2 = normalizer.normalize(event);
    expect(a1.id).not.toBe(a2.id);
  });

  it('falls back to unknown path when file_path is missing', () => {
    const action = normalizer.normalize({
      name: 'unknown-provider',
      operation: 'GENERATE',
      rawEvent: {},
    });
    expect(action.artifact.path).toBe('unknown');
  });

  it('marks confidence as low for unrecognized provider', () => {
    const action = normalizer.normalize({
      name: 'unknown-provider',
      operation: 'GENERATE',
      rawEvent: {},
    });
    expect(action.metadata.confidence).toBe('low');
  });

  it('marks confidence as high for recognized providers', () => {
    const action = normalizer.normalize({
      name: 'claude-code',
      operation: 'GENERATE',
      rawEvent: { tool_name: 'Write', tool_input: { file_path: 'a.ts' } },
    });
    expect(action.metadata.confidence).toBe('high');
  });
});

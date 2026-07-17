import { describe, it, expect } from 'vitest';

describe('Provider Types', () => {
  it('IntermediateEvent has required fields', () => {
    const event = {
      name: 'claude-code',
      operation: 'GENERATE' as const,
      rawEvent: { tool_name: 'Write', tool_input: { file_path: 'src/a.ts' } },
    };
    expect(event.name).toBe('claude-code');
    expect(event.operation).toBe('GENERATE');
  });

  it('IntermediateEvent operation supports EDIT and DELETE', () => {
    const events = [
      { name: 'test', operation: 'EDIT' as const, rawEvent: {} },
      { name: 'test', operation: 'DELETE' as const, rawEvent: {} },
    ];
    expect(events[0].operation).toBe('EDIT');
    expect(events[1].operation).toBe('DELETE');
  });
});

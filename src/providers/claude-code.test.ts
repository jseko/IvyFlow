import { describe, it, expect } from 'vitest';
import { ClaudeCodeAdapter } from './claude-code.js';

describe('ClaudeCodeAdapter', () => {
  const adapter = new ClaudeCodeAdapter();

  it('has name "claude-code"', () => {
    expect(adapter.name).toBe('claude-code');
  });

  it('adapts Write tool event to GENERATE', () => {
    const result = adapter.adapt({
      tool_name: 'Write',
      tool_input: { file_path: 'src/index.ts', content: 'hello' },
    });
    expect(result).not.toBeNull();
    expect(result!.operation).toBe('GENERATE');
    expect(result!.name).toBe('claude-code');
  });

  it('adapts Edit tool event to EDIT', () => {
    const result = adapter.adapt({
      tool_name: 'Edit',
      tool_input: { file_path: 'src/index.ts', old_string: 'a', new_string: 'b' },
    });
    expect(result).not.toBeNull();
    expect(result!.operation).toBe('EDIT');
  });

  it('adapts MultiEdit tool event to EDIT', () => {
    const result = adapter.adapt({
      tool_name: 'MultiEdit',
      tool_input: { file_path: 'src/index.ts', edits: [] },
    });
    expect(result).not.toBeNull();
    expect(result!.operation).toBe('EDIT');
  });

  it('adapts NotebookEdit tool event to EDIT', () => {
    const result = adapter.adapt({
      tool_name: 'NotebookEdit',
      tool_input: { file_path: 'src/notebook.ipynb' },
    });
    expect(result).not.toBeNull();
    expect(result!.operation).toBe('EDIT');
  });

  it('returns null for non-code tool events', () => {
    expect(adapter.adapt({ tool_name: 'Bash' })).toBeNull();
    expect(adapter.adapt({ tool_name: 'Read' })).toBeNull();
    expect(adapter.adapt({ tool_name: 'TodoWrite' })).toBeNull();
  });

  it('returns null for empty or missing tool_name', () => {
    expect(adapter.adapt({})).toBeNull();
    expect(adapter.adapt({ tool_name: '' })).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { DefaultAIProviderGateway } from './gateway.js';
import { ClaudeCodeAdapter } from './claude-code.js';
import type { AIProviderAdapter } from './types.js';

describe('DefaultAIProviderGateway', () => {
  it('returns null when no adapter matches', () => {
    const gateway = new DefaultAIProviderGateway();
    const result = gateway.process({ tool_name: 'UnknownTool' });
    expect(result).toBeNull();
  });

  it('processes Claude Code Write event through full pipeline', () => {
    const gateway = new DefaultAIProviderGateway();
    gateway.register(new ClaudeCodeAdapter());

    const result = gateway.process({
      tool_name: 'Write',
      tool_input: { file_path: 'src/hello.ts', content: 'console.log("hi");' },
    });

    expect(result).not.toBeNull();
    expect(result!.provider).toBe('claude-code');
    expect(result!.operation).toBe('GENERATE');
    expect(result!.artifact.path).toBe('src/hello.ts');
    expect(result!.id).toMatch(/^act_/);
  });

  it('processes Claude Code Edit event', () => {
    const gateway = new DefaultAIProviderGateway();
    gateway.register(new ClaudeCodeAdapter());

    const result = gateway.process({
      tool_name: 'Edit',
      tool_input: { file_path: 'src/hello.ts' },
    });

    expect(result).not.toBeNull();
    expect(result!.operation).toBe('EDIT');
  });

  it('skips adapters that return null and falls through', () => {
    const gateway = new DefaultAIProviderGateway();
    const nullAdapter: AIProviderAdapter = {
      name: 'null-adapter',
      adapt: () => null,
    };
    gateway.register(nullAdapter);
    gateway.register(new ClaudeCodeAdapter());

    const result = gateway.process({
      tool_name: 'Write',
      tool_input: { file_path: 'src/test.ts' },
    });

    expect(result).not.toBeNull();
    expect(result!.provider).toBe('claude-code');
  });

  it('returns null when no adapters registered', () => {
    const gateway = new DefaultAIProviderGateway();
    expect(gateway.process({})).toBeNull();
  });
});

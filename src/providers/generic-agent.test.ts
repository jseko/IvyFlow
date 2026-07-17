import { describe, it, expect } from 'vitest';
import { GenericAgentAdapter } from './generic-agent.js';

describe('GenericAgentAdapter', () => {
  const adapter = new GenericAgentAdapter();

  it('has name "generic-agent"', () => {
    expect(adapter.name).toBe('generic-agent');
  });

  it('adapts event with file_path to GENERATE', () => {
    const result = adapter.adapt({
      provider: 'unknown-ai-tool',
      file_path: 'src/hello.ts',
      content: 'console.log("hi");',
    });
    expect(result).not.toBeNull();
    expect(result!.operation).toBe('GENERATE');
    expect(result!.name).toBe('generic-agent');
    expect((result!.rawEvent as Record<string, unknown>).file_path).toBe('src/hello.ts');
  });

  it('adapts event with path field', () => {
    const result = adapter.adapt({
      provider: 'unknown-ai-tool',
      path: 'src/foo.ts',
    });
    expect(result).not.toBeNull();
    expect(result!.operation).toBe('GENERATE');
  });

  it('adapts event with target_file field', () => {
    const result = adapter.adapt({
      provider: 'unknown-ai-tool',
      target_file: 'src/bar.ts',
    });
    expect(result).not.toBeNull();
    expect(result!.operation).toBe('GENERATE');
  });

  it('returns null for events without any file path field', () => {
    expect(adapter.adapt({ provider: 'unknown', text: 'hello' })).toBeNull();
  });

  it('returns null for empty object', () => {
    expect(adapter.adapt({})).toBeNull();
  });
});

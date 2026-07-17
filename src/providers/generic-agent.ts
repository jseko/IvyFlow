import type { AIProviderAdapter, IntermediateEvent } from './types.js';

const FILE_PATH_KEYS = ['file_path', 'path', 'target_file'];

export class GenericAgentAdapter implements AIProviderAdapter {
  readonly name = 'generic-agent';

  adapt(rawEvent: Record<string, unknown>): IntermediateEvent | null {
    for (const key of FILE_PATH_KEYS) {
      if (typeof rawEvent[key] === 'string' && rawEvent[key] !== '') {
        return {
          name: this.name,
          operation: 'GENERATE',
          rawEvent,
        };
      }
    }
    return null;
  }
}

import type { AIProviderAdapter, IntermediateEvent } from './types.js';
import type { AIOperation } from '../core/provenance/types.js';

const CODE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

const TOOL_OPERATION_MAP: Record<string, AIOperation> = {
  Write: 'GENERATE',
  Edit: 'EDIT',
  MultiEdit: 'EDIT',
  NotebookEdit: 'EDIT',
};

export class ClaudeCodeAdapter implements AIProviderAdapter {
  readonly name = 'claude-code';

  adapt(rawEvent: Record<string, unknown>): IntermediateEvent | null {
    const toolName = typeof rawEvent.tool_name === 'string' ? rawEvent.tool_name : '';
    if (!toolName || !CODE_TOOLS.has(toolName)) {
      return null;
    }

    const operation = TOOL_OPERATION_MAP[toolName];
    if (!operation) {
      return null;
    }

    return {
      name: this.name,
      operation,
      rawEvent,
    };
  }
}

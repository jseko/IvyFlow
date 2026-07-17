import type { IntermediateEvent, Normalizer } from './types.js';
import type { AIAction } from '../core/provenance/types.js';

const RECOGNIZED_PROVIDERS = new Set(['claude-code']);

function extractFilePath(rawEvent: Record<string, unknown>): string {
  const toolInput = rawEvent.tool_input as Record<string, unknown> | undefined;
  if (toolInput && typeof toolInput.file_path === 'string') {
    return toolInput.file_path;
  }
  return 'unknown';
}

export class ProviderNormalizer implements Normalizer {
  normalize(event: IntermediateEvent): AIAction {
    const id = `act_${crypto.randomUUID()}`;

    return {
      id,
      provider: event.name,
      operation: event.operation,
      artifact: { path: extractFilePath(event.rawEvent) },
      metadata: {
        toolName: event.rawEvent.tool_name ?? null,
        confidence: RECOGNIZED_PROVIDERS.has(event.name) ? 'high' : 'low',
      },
    };
  }
}

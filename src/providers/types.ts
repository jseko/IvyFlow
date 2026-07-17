import type { AIAction, AIOperation } from '../core/provenance/types.js';

export interface IntermediateEvent {
  name: string;
  operation: AIOperation;
  rawEvent: Record<string, unknown>;
}

export interface AIProviderAdapter {
  readonly name: string;
  adapt(rawEvent: Record<string, unknown>): IntermediateEvent | null;
}

export interface Normalizer {
  normalize(event: IntermediateEvent): AIAction;
}

export interface AIProviderGateway {
  register(adapter: AIProviderAdapter): void;
  process(rawEvent: Record<string, unknown>): AIAction | null;
}

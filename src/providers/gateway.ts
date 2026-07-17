import type { AIProviderGateway, AIProviderAdapter } from './types.js';
import type { AIAction } from '../core/provenance/types.js';
import { ProviderNormalizer } from './normalizer.js';

export class DefaultAIProviderGateway implements AIProviderGateway {
  private adapters: AIProviderAdapter[] = [];
  private normalizer = new ProviderNormalizer();

  register(adapter: AIProviderAdapter): void {
    this.adapters.push(adapter);
  }

  process(rawEvent: Record<string, unknown>): AIAction | null {
    for (const adapter of this.adapters) {
      const intermediate = adapter.adapt(rawEvent);
      if (intermediate) {
        return this.normalizer.normalize(intermediate);
      }
    }
    return null;
  }
}

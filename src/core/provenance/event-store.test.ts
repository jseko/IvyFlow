import { describe, it, expect } from 'vitest';
import type { OriginEventStore } from './event-store.js';

describe('OriginEventStore interface', () => {
  it('defines the required methods (type-level check)', () => {
    const methods: (keyof OriginEventStore)[] = [
      'append',
      'query',
      'stream',
      'rebuildProjection',
      'getProjection',
    ];
    expect(methods.length).toBe(5);
  });
});

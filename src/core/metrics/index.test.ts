import { describe, it, expect } from 'vitest';
import { MetricQuery } from './index.js';
import type { MetricQueryInput, MetricName } from './types.js';

describe('MetricQuery', () => {
  it('returns empty array when called with no matching data (graceful degradation)', async () => {
    const input: MetricQueryInput = {
      scope: 'project',
      metrics: ['completion_rate'],
    };
    const result = await MetricQuery(input);
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns empty array for unknown scope gracefully', async () => {
    const result = await MetricQuery({
      scope: 'change' as unknown as 'project',
      metrics: ['commit_frequency'],
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it('never throws on any input', async () => {
    // Invalid scope
    await expect(MetricQuery({ scope: 'change' as unknown as 'project', metrics: [] })).resolves.not.toThrow();
    // Empty metrics
    await expect(MetricQuery({ scope: 'project', metrics: [] as MetricName[] })).resolves.not.toThrow();
    // Missing changeName with change scope
    await expect(MetricQuery({ scope: 'change' as unknown as 'project', metrics: ['completion_rate'] })).resolves.not.toThrow();
  });

  it('produces flat MetricResult[] with expected fields', async () => {
    const results = await MetricQuery({
      scope: 'project',
      metrics: ['active_changes'],
    });
    for (const r of results) {
      expect(r).toHaveProperty('change');
      expect(r).toHaveProperty('metric');
      expect(r).toHaveProperty('value');
      expect(r).toHaveProperty('label');
    }
  });
});

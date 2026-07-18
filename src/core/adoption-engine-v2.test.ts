import { describe, it, expect } from 'vitest';
import type { AdoptionProfile, RetentionMetrics, ReworkMetrics, AbandonmentMetrics, LineageMetrics, FailureMetrics } from './adoption-engine.js';

describe('AdoptionProfile V2 types', () => {
  it('should accept V2 optional fields', () => {
    const metrics: RetentionMetrics = {
      totalGeneratedLines: 1000,
      surviveLines: 800,
      retentionRatio: 0.8,
      trackedCommits: 5,
      confidence: 'medium',
    };

    const profile: AdoptionProfile = {
      changeName: 'test',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      funnel: {
        totalCommits: 10,
        totalFilesChanged: 5,
        totalLinesAdded: 1000,
        totalChanges: 3,
        completedChanges: 2,
        completionRate: 0.67,
      },
      suggestionImpact: {
        totalSuggestions: 20,
        acceptedSuggestions: 15,
        estimatedLinesFromAccepted: 750,
        avgTimeToResolve: 0,
      },
      weeklyTrend: [],
      confidence: { overall: 'medium', note: '' },
      retention: metrics,
      rework: undefined,
      abandonment: undefined,
      lineage: undefined,
      failureIntelligence: undefined,
    };

    expect(profile.retention?.retentionRatio).toBe(0.8);
    expect(profile.rework).toBeUndefined();
  });
});

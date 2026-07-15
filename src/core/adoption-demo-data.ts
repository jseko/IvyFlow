/**
 * Demo data for IvyFlow adoption analytics.
 *
 * Built-in sample data used by `ivy analytics --demo` to showcase
 * the analytics output format without requiring real project data.
 *
 * v0.15 — Demo Experience.
 */

export const DEMO_ADOPTION_DATA = {
  project: 'demo/e-commerce-platform',
  period: 'last 30 days',
  sessions: 47,
  funnel: {
    generated: 28340,
    reviewed: 24680,
    reviewedRate: 0.871,
    passedReview: 21450,
    passedReviewRate: 0.757,
    merged: 19820,
    mergedRate: 0.699,
  },
  byConfidence: {
    high: { lines: 11240, pct: 0.567, source: '会话边界' },
    medium: { lines: 5830, pct: 0.294, source: 'Git Notes' },
    low: { lines: 2750, pct: 0.139, source: '文件估算' },
  },
  tokenEfficiency: {
    avgTokensPerLine: 318,
    estimatedHoursSaved: 127,
  },
};

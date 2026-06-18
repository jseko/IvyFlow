/**
 * Analytics — L3 metrics computation with confidence provenance.
 *
 * Every metric carries a structured confidence object that declares:
 *   - level (none/low/medium/high)
 *   - sources (what data feeds the metric)
 *   - coverage (what fraction of true events we captured)
 *   - gaps (what data we are missing)
 *   - calibrated (has it been checked against ground truth?)
 *
 * Design constraints (design.md D3/D5):
 *   - No metric leaves this module without confidence provenance.
 *   - AI contribution estimate is experimental (level: 'none').
 *   - L3 is computed in-memory only; never persisted.
 */

import { readRawEvents, readInferredEvents, type RawEvent, type InferredEvent } from './sessions.js';

// ─── Confidence Provenance ───

export interface ConfidenceProvenance {
  level: 'none' | 'low' | 'medium' | 'high';
  sources: string[];
  coverage: number;
  gaps: string[];
  inferenceRule?: string;
  calibrated: boolean;
}

export interface Metric<T> {
  value: T;
  confidence: ConfidenceProvenance;
}

export interface ExperimentalMetric<T> extends Metric<T> {
  experimental: true;
  warnings: string[];
}

// ─── Preset Templates ───

export const CONFIDENCE_TEMPLATES = {
  gitDiffOnly: (): ConfidenceProvenance => ({
    level: 'low',
    sources: ['git-diff'],
    coverage: 0.3,
    gaps: [
      'no tool telemetry (PreToolUse Hook unavailable)',
      'no file-level edit trace',
      'no intermediate edit history',
      'session boundary is heuristic (30min rule)',
    ],
    calibrated: false,
  }),

  phaseTransition: (): ConfidenceProvenance => ({
    level: 'high',
    sources: ['validate', 'git-hook'],
    coverage: 1.0,
    gaps: [],
    calibrated: true,
  }),

  experimentalAiEstimate: (): ConfidenceProvenance => ({
    level: 'none',
    sources: ['git-diff-heuristic'],
    coverage: 0.15,
    gaps: [
      'heuristic rule: insertions>50 && deletions===0',
      'no ground truth dataset',
      'no calibration mechanism',
      'high false positive: format scripts, generated code, bulk refactor',
    ],
    calibrated: false,
    inferenceRule: 'ai_contribution_heuristic_v1',
  }),
};

// ─── Types ───

export interface CommitMeta {
  hash: string;
  insertions: number;
  deletions: number;
  hasAiMarker: boolean;
}

export interface AnalyticsResult {
  period: { start: Date; end: Date };
  dataModelVersion: string;
  rawEventCount: number;
  inferredEventCount: number;
  metrics: {
    commits: Metric<number>;
    phaseTransitions: Metric<Record<string, number>>;
    sessionCount?: Metric<number>;
    avgSessionDurationMin?: Metric<number>;
    aiContributionEstimate?: ExperimentalMetric<{ estimatedLines: number; percentage: number }>;
  };
}

// ─── Aggregator ───

export async function aggregateAnalytics(
  projectPath: string,
  changeName: string | undefined,
  periodDays: number,
): Promise<AnalyticsResult> {
  const end = new Date();
  const start = new Date(end.getTime() - periodDays * 24 * 60 * 60 * 1000);

  // Collect L1 raw events
  const rawEvents: RawEvent[] = [];
  for await (const evt of readRawEvents(projectPath)) {
    const ts = new Date(evt.ts).getTime();
    if (ts < start.getTime() || ts > end.getTime()) continue;
    if (changeName && evt.change !== changeName) continue;
    rawEvents.push(evt);
  }

  // Collect L2 inferred events
  const inferredEvents: InferredEvent[] = [];
  for await (const evt of readInferredEvents(projectPath)) {
    const ts = new Date(evt.ts).getTime();
    if (ts < start.getTime() || ts > end.getTime()) continue;
    if (changeName && evt.change !== changeName) continue;
    inferredEvents.push(evt);
  }

  // Commits (verified)
  const commits = rawEvents.filter(e => e.event === 'git_commit');
  const commitCount = commits.length;

  // Phase transitions (verified)
  const phaseTransitions: Record<string, number> = {};
  for (const evt of rawEvents) {
    if (evt.event === 'phase_transition' && evt.meta) {
      const from = String((evt.meta as Record<string, unknown>).from ?? 'unknown');
      const to = String((evt.meta as Record<string, unknown>).to ?? 'unknown');
      const key = `${from} → ${to}`;
      phaseTransitions[key] = (phaseTransitions[key] ?? 0) + 1;
    }
  }

  // Sessions (inferred)
  const sessionStarts = inferredEvents.filter(e => e.event === 'session_start');
  const sessionEnds = inferredEvents.filter(e => e.event === 'session_end');
  const sessionCount = sessionStarts.length;

  let avgSessionDurationMin: number | undefined;
  if (sessionEnds.length > 0) {
    const totalDuration = sessionEnds.reduce((sum, e) => {
      const dur = Number((e.meta as Record<string, unknown>)?.durationSec ?? 0);
      return sum + dur;
    }, 0);
    avgSessionDurationMin = Math.round((totalDuration / sessionEnds.length / 60) * 10) / 10;
  }

  // Build metrics object
  const metrics: AnalyticsResult['metrics'] = {
    commits: {
      value: commitCount,
      confidence: {
        level: 'high',
        sources: ['git-hook'],
        coverage: 1.0,
        gaps: [],
        calibrated: true,
      },
    },
    phaseTransitions: {
      value: phaseTransitions,
      confidence: CONFIDENCE_TEMPLATES.phaseTransition(),
    },
  };

  if (sessionCount > 0) {
    metrics.sessionCount = {
      value: sessionCount,
      confidence: {
        ...CONFIDENCE_TEMPLATES.gitDiffOnly(),
        inferenceRule: 'session_boundary_30min',
      },
    };
    if (avgSessionDurationMin !== undefined) {
      metrics.avgSessionDurationMin = {
        value: avgSessionDurationMin,
        confidence: {
          ...CONFIDENCE_TEMPLATES.gitDiffOnly(),
          inferenceRule: 'session_boundary_30min',
        },
      };
    }
  }

  // AI contribution estimate (experimental)
  if (commits.length > 0) {
    const commitMetas: CommitMeta[] = commits.map(c => ({
      hash: String((c.meta as Record<string, unknown>)?.hash ?? ''),
      insertions: Number((c.meta as Record<string, unknown>)?.insertions ?? 0),
      deletions: Number((c.meta as Record<string, unknown>)?.deletions ?? 0),
      hasAiMarker: false, // v0.4 does not scan content for markers
    }));
    metrics.aiContributionEstimate = estimateAiContribution(commitMetas);
  }

  return {
    period: { start, end },
    dataModelVersion: 'L1L2L3-v1',
    rawEventCount: rawEvents.length,
    inferredEventCount: inferredEvents.length,
    metrics,
  };
}

// ─── AI Contribution Estimate (Experimental) ───

function estimateAiContribution(
  commits: CommitMeta[],
): ExperimentalMetric<{ estimatedLines: number; percentage: number }> {
  let estimate = 0;
  const warnings: string[] = [];

  for (const c of commits) {
    if (c.insertions > 50 && c.deletions === 0) {
      estimate += c.insertions * 0.6;
      if (warnings.length < 3) {
        warnings.push(`commit ${c.hash.slice(0, 7)}: large insertion block may be format script or generated code`);
      }
    } else if (c.hasAiMarker) {
      estimate += c.insertions;
    } else {
      estimate += c.insertions * 0.05; // conservative baseline
    }
  }

  const totalAdded = commits.reduce((sum, c) => sum + c.insertions, 0);
  const percentage = totalAdded > 0 ? Math.round((estimate / totalAdded) * 100) : 0;

  return {
    value: { estimatedLines: Math.round(estimate), percentage },
    experimental: true,
    confidence: CONFIDENCE_TEMPLATES.experimentalAiEstimate(),
    warnings: [
      'HIGH FALSE POSITIVE: format scripts, generated code, bulk refactor are misclassified as AI-generated',
      'NO GROUND TRUTH: this estimate has not been calibrated against manual review',
      'NOT FOR DECISION MAKING: do not use for performance review or resource allocation',
      ...warnings,
    ],
  };
}

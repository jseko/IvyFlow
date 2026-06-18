/**
 * Suggest Engine — orchestrates stuck/rollback/phase-review checks (v0.5).
 *
 * Reads L1 raw events, runs all detection checks, and produces Suggestions.
 * Contains ZERO rendering logic — output is structured data consumed by
 * the suggest CLI and dashboard.
 */

import { readRawEvents, type RawEvent } from './sessions.js';
import { detectStuck, detectRollbacks, getPhaseDuration, DEFAULT_STUCK_CONFIG, type StuckConfig } from './stuck-detector.js';

// ─── Suggestion Type ───

export type SuggestionType = 'stuck' | 'phase_review' | 'rollback_warning' | 'milestone' | 'cleanup';
export type SuggestionSeverity = 'info' | 'warning' | 'critical';
export type SuggestionStatus = 'pending' | 'accepted' | 'dismissed' | 'ignored' | 'snoozed' | 'expired' | 'actioned';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type SuggestionVisibility = 'normal' | 'quiet' | 'hidden';

// v0.7: Trace snapshot (immutable, attached at generation time)
export interface SuggestionTraceSnapshot {
  ruleName: string;
  algorithmVersion: number;
  configVersion: number;
  thresholdUsed: number;
  confidence: 'high' | 'medium' | 'low';
  dataSource: {
    type: 'phase_history' | 'feedback' | 'session_inference';
    recordsCount: number;
  };
}

export interface Suggestion {
  id: string;
  type: SuggestionType;
  severity: SuggestionSeverity;
  change: string;
  message: string;
  action?: string;
  confidence: ConfidenceLevel;
  status?: SuggestionStatus;
  createdAt?: string;
  resolvedAt?: string;
  // v0.6
  expiresAt?: string;
  qualityScore?: number;
  dismissedReason?: string;
  advisorVersion?: string;
  calibrationVersion?: number;
  visibility?: SuggestionVisibility;
  // v0.7
  trace?: SuggestionTraceSnapshot;
}

// ─── ID Generation ───

let _suggestionCounter = 0;

export function resetSuggestionCounter(): void {
  _suggestionCounter = 0;
}

export function generateSuggestionId(type: SuggestionType): string {
  _suggestionCounter++;
  const typePrefix = type === 'stuck' ? 'st' : type === 'phase_review' ? 'pr' : type === 'rollback_warning' ? 'rb' : type === 'cleanup' ? 'cl' : 'ms';
  return `sugg_${typePrefix}_${String(_suggestionCounter).padStart(2, '0')}`;
}

// ─── Engine Options ───

export interface SuggestEngineOptions {
  stuckConfig?: Partial<StuckConfig>;
  /** Filter to specific changes. Empty = all changes. */
  changes?: string[];
}

// ─── Main Engine ───

function collectChanges(rawEvents: RawEvent[]): string[] {
  const changes = new Set(rawEvents.map((e) => e.change));
  return [...changes].sort();
}

export async function runSuggestEngine(
  projectPath: string,
  options?: SuggestEngineOptions,
): Promise<Suggestion[]> {
  resetSuggestionCounter();

  // Read all L1 events
  const rawEvents: RawEvent[] = [];
  for await (const evt of readRawEvents(projectPath)) {
    rawEvents.push(evt);
  }

  if (rawEvents.length === 0) return [];

  // Count phase_history records for trace dataSource
  const phaseHistoryCount = rawEvents.filter((e) => e.event === 'phase_transition').length;

  const changes = options?.changes?.length
    ? options.changes
    : collectChanges(rawEvents);
  const suggestions: Suggestion[] = [];

  for (const change of changes) {
    // 1. Stuck detection
    const stuckResult = detectStuck(rawEvents, change, options?.stuckConfig);
    if (stuckResult) {
      suggestions.push({
        id: generateSuggestionId('stuck'),
        type: 'stuck',
        severity: 'critical',
        change,
        message: stuckResult.suggestion,
        action: 'Consider reviewing scope or splitting into smaller changes.',
        confidence: 'high',
        status: 'pending',
        createdAt: new Date().toISOString(),
        // v0.7: trace snapshot
        trace: {
          ruleName: 'stuck_detection',
          algorithmVersion: 3,
          configVersion: 2,
          thresholdUsed: stuckResult.thresholdDays,
          confidence: 'high',
          dataSource: { type: 'phase_history', recordsCount: phaseHistoryCount },
        },
      });
    }

    // 2. Rollback detection
    const rollbackResult = detectRollbacks(rawEvents, change, options?.stuckConfig);
    if (rollbackResult) {
      suggestions.push({
        id: generateSuggestionId('rollback_warning'),
        type: 'rollback_warning',
        severity: 'warning',
        change,
        message: rollbackResult.suggestion,
        action: 'Review current design clarity and documentation.',
        confidence: 'high',
        status: 'pending',
        createdAt: new Date().toISOString(),
        // v0.7: trace snapshot
        trace: {
          ruleName: 'rollback_detection',
          algorithmVersion: 1,
          configVersion: 1,
          thresholdUsed: options?.stuckConfig?.thresholdByPhase?.build ?? 30,
          confidence: 'high',
          dataSource: { type: 'phase_history', recordsCount: rollbackResult.rollbackCount },
        },
      });
    }

    // 3. Phase review
    const durationInfo = getPhaseDuration(rawEvents, change);
    if (durationInfo && durationInfo.avgDaysInPhase !== null && durationInfo.daysInPhase > durationInfo.avgDaysInPhase) {
      suggestions.push({
        id: generateSuggestionId('phase_review'),
        type: 'phase_review',
        severity: 'info',
        change,
        message: `Phase "${durationInfo.currentPhase}" is at ${durationInfo.daysInPhase} days (avg: ${durationInfo.avgDaysInPhase} days). Consider reviewing current progress.`,
        action: 'Review whether the current phase is on track.',
        confidence: 'medium',
        status: 'pending',
        createdAt: new Date().toISOString(),
        // v0.7: trace snapshot
        trace: {
          ruleName: 'phase_review',
          algorithmVersion: 2,
          configVersion: 1,
          thresholdUsed: durationInfo.avgDaysInPhase,
          confidence: 'medium',
          dataSource: { type: 'phase_history', recordsCount: phaseHistoryCount },
        },
      });
    }
  }

  return suggestions;
}

/**
 * Build a mapping of suggestionId → type for quality metrics lookup.
 */
export function buildTypeMap(suggestions: Suggestion[]): Record<string, string[]> {
  const byType: Record<string, string[]> = {};
  for (const s of suggestions) {
    if (!byType[s.type]) byType[s.type] = [];
    byType[s.type].push(s.id);
  }
  return byType;
}

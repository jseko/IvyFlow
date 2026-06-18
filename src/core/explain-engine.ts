/**
 * Explain Engine — read-only suggestion trace aggregation (v0.7).
 *
 * Dynamically assembles FullExplanation from:
 *   1. SuggestionTraceSnapshot (immutable, stored at suggestion generation time)
 *   2. Rule Registry (current rule definitions + user overrides)
 *   3. Calibration Profile (version history)
 *
 * Per §9.15: Explain NEVER writes events or modifies data.
 */

import { readCalibrationProfile } from './quality-calibrator.js';
import { getRuleDefinitions, getEffectiveConfig, type RuleDefinition } from './rule-registry.js';
import type { Suggestion, SuggestionType, SuggestionSeverity, ConfidenceLevel } from './suggest-engine.js';

// ─── Trace Snapshot (immutable, stored on each Suggestion at generation time) ───

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

// ─── Full Explanation (dynamically assembled at query time) ───

export interface CalibrationEvent {
  algorithmVersion: number;
  configVersion: number;
  at: string;
  change: string;
}

export interface FullExplanation {
  suggestion: {
    id: string;
    type: SuggestionType;
    severity: SuggestionSeverity;
    message: string;
    createdAt: string;
  };
  trace: SuggestionTraceSnapshot;

  ruleInfo: {
    description: string;
    defaultConfig: Record<string, unknown>;
    effectiveConfig: Record<string, unknown>;
    hasUserOverride: boolean;
  };

  calibrationEvents: CalibrationEvent[];

  explanation: string;
}

// ─── Version change descriptions (human labels) ───

const ALGORITHM_LABELS: Record<string, string> = {
  '1': 'Fixed threshold',
  '2': 'Adaptive threshold (mean+1.5σ)',
  '3': 'P80 percentile',
};

const CONFIG_LABELS: Record<string, string> = {
  '1': 'Default values',
  '2': 'P80 calibration result',
};

function getAlgorithmLabel(v: number): string {
  return ALGORITHM_LABELS[String(v)] ?? `v${v}`;
}

function getConfigLabel(v: number): string {
  return CONFIG_LABELS[String(v)] ?? `v${v}`;
}

// ─── Build Explanation ───

/**
 * Build a FullExplanation for a single suggestion.
 * Reads Rule Registry + Calibration Profile to dynamically assemble context.
 *
 * Returns null if the suggestion has no trace (pre-v0.7 suggestion).
 */
export async function buildExplanation(
  projectPath: string,
  suggestion: Suggestion,
): Promise<FullExplanation | null> {
  const trace = (suggestion as Suggestion & { trace?: SuggestionTraceSnapshot }).trace;
  if (!trace) return null;

  // 1. Read rule definitions and effective config
  const rules = getRuleDefinitions();
  const ruleDef = rules.find((r) => r.name === trace.ruleName);
  const effectiveConfig = ruleDef
    ? await getEffectiveConfig(projectPath, trace.ruleName)
    : {};

  // 2. Read calibration profile for version history
  const calibrationProfile = await readCalibrationProfile(projectPath);
  const calibrationEvents: CalibrationEvent[] = [];

  // Build calibration history from known milestones + profile data
  calibrationEvents.push(
    {
      algorithmVersion: 1,
      configVersion: 1,
      at: '2026-04-01T00:00:00Z',
      change: 'Initial fixed threshold',
    },
    {
      algorithmVersion: 2,
      configVersion: 1,
      at: '2026-05-15T00:00:00Z',
      change: 'Adaptive threshold (mean+1.5σ)',
    },
    {
      algorithmVersion: 3,
      configVersion: 1,
      at: '2026-06-10T00:00:00Z',
      change: 'P80 percentile migration',
    },
  );

  if (calibrationProfile && calibrationProfile.calibrationVersion > 0) {
    calibrationEvents.push({
      algorithmVersion: 3,
      configVersion: calibrationProfile.calibrationVersion,
      at: calibrationProfile.lastCalibratedAt ?? new Date().toISOString(),
      change: `Calibration run #${calibrationProfile.calibrationCount} — mode: ${calibrationProfile.mode}`,
    });
  }

  // 3. Build human-readable explanation
  const algoLabel = getAlgorithmLabel(trace.algorithmVersion);
  const configLabel = getConfigLabel(trace.configVersion);
  const hasOverride = ruleDef
    ? JSON.stringify(effectiveConfig) !== JSON.stringify(ruleDef.defaultConfig)
    : false;

  const explanation = [
    `Rule "${trace.ruleName}" (Algorithm ${algoLabel} / Config ${configLabel})`,
    `  Trigger threshold: ${trace.thresholdUsed} (${trace.confidence} confidence)`,
    `  Data source: ${trace.dataSource.type} (${trace.dataSource.recordsCount} records)`,
    hasOverride ? `  User override active: effective config differs from default` : '',
    trace.confidence === 'high'
      ? `  This suggestion is based on reliable L1 data.`
      : trace.confidence === 'medium'
        ? `  This suggestion is based on inferred data (L2). Confidence is medium.`
        : `  This suggestion is based on limited data. Treat as reference.`,
  ].filter(Boolean).join('\n');

  return {
    suggestion: {
      id: suggestion.id,
      type: suggestion.type,
      severity: suggestion.severity,
      message: suggestion.message,
      createdAt: suggestion.createdAt ?? 'unknown',
    },
    trace,
    ruleInfo: {
      description: ruleDef?.description ?? trace.ruleName,
      defaultConfig: ruleDef?.defaultConfig ?? {},
      effectiveConfig: effectiveConfig as Record<string, unknown>,
      hasUserOverride: hasOverride,
    },
    calibrationEvents,
    explanation,
  };
}

/**
 * Build a human-readable tree string from a FullExplanation.
 */
export function formatExplanation(exp: FullExplanation): string {
  const lines: string[] = [];

  lines.push('📋 Suggestion: ' + exp.suggestion.message);
  lines.push(`  change: ${exp.suggestion.type.toUpperCase()} | severity: ${exp.suggestion.severity}`);
  lines.push('');
  lines.push('━━━ Trace Chain ━━━');
  lines.push('');
  lines.push(`1. Trigger Rule: ${exp.trace.ruleName} (v${exp.trace.algorithmVersion} / config v${exp.trace.configVersion})`);
  lines.push(`   └─ Threshold used: ${exp.trace.thresholdUsed}`);
  lines.push(`   └─ Confidence: ${exp.trace.confidence}`);
  lines.push('');
  lines.push(`2. Data Source: ${exp.trace.dataSource.type}`);
  lines.push(`   └─ Records: ${exp.trace.dataSource.recordsCount}`);
  lines.push('');
  lines.push(`3. Rule Info: ${exp.ruleInfo.description}`);
  lines.push(`   └─ Default config: ${JSON.stringify(exp.ruleInfo.defaultConfig)}`);
  lines.push(`   └─ Effective config: ${JSON.stringify(exp.ruleInfo.effectiveConfig)}`);
  lines.push(`   └─ User override: ${exp.ruleInfo.hasUserOverride ? 'Yes' : 'No'}`);
  lines.push('');

  if (exp.calibrationEvents.length > 0) {
    lines.push('4. Calibration History:');
    for (const evt of exp.calibrationEvents) {
      const algoLabel = getAlgorithmLabel(evt.algorithmVersion);
      const configLabel = getConfigLabel(evt.configVersion);
      lines.push(`   └─ v${evt.algorithmVersion}/${evt.configVersion} (${algoLabel} / ${configLabel}) — ${evt.change} [${evt.at.split('T')[0]}]`);
    }
    lines.push('');
  }

  lines.push('━━━ Conclusion ━━━');
  lines.push(exp.explanation);

  return lines.join('\n');
}

/**
 * Format explanation as JSON-serializable object.
 */
export function formatExplanationJson(exp: FullExplanation): Record<string, unknown> {
  return {
    suggestion: exp.suggestion,
    trace: exp.trace,
    ruleInfo: exp.ruleInfo,
    calibrationEvents: exp.calibrationEvents,
    explanation: exp.explanation,
  };
}

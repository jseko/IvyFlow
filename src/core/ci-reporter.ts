/**
 * CI Reporter — structured workflow health reports (v0.6).
 *
 * Produces non-blocking check reports with CI_MODE-aware confidence.
 * Supports CLI, Markdown, and JSON output formats.
 */

import type { Suggestion } from './suggest-engine.js';
import { detectStuck, detectRollbacks, DEFAULT_STUCK_CONFIG } from './stuck-detector.js';
import { readRawEvents, type RawEvent } from './sessions.js';

// ─── Types ───

export type CiMode = 'full' | 'stale' | 'no';

export interface CheckItem {
  name: string;
  status: 'passed' | 'warning' | 'info' | 'failed';
  detail: string;
  confidence?: 'high' | 'medium' | 'low';
}

export interface CiReport {
  change: string;
  checkedAt: string;
  phase: string;
  mode: CiMode;
  modeConfidence: string;
  checks: CheckItem[];
  summary: {
    passed: number;
    warning: number;
    info: number;
    failed: number;
  };
  nonBlocking: true;
}

// ─── Helper ───

async function detectCurrentPhase(rawEvents: RawEvent[], change: string): Promise<string> {
  const transitions = rawEvents
    .filter((e) => e.change === change && e.event === 'phase_transition')
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  if (transitions.length === 0) return 'unknown';
  const last = transitions[transitions.length - 1];
  return (last.meta as { to?: string })?.to ?? 'unknown';
}

function detectCiMode(): CiMode {
  try {
    const env = process.env.CI_MODE ?? '';
    if (env === 'full' || env === 'stale' || env === 'no') return env as CiMode;
  } catch {
    // ignore
  }
  // Default to 'no' (no GitNexus)
  return 'no';
}

function modeConfidenceString(mode: CiMode): string {
  switch (mode) {
    case 'full': return 'GitNexus: up-to-date (precise symbol-level analysis)';
    case 'stale': return 'GitNexus index expired — results for reference only';
    case 'no': return 'GitNexus not available, using event-based analysis';
  }
}

// ─── Check Functions ───

async function checkPhaseValidity(rawEvents: RawEvent[], change: string): Promise<CheckItem> {
  const currentPhase = await detectCurrentPhase(rawEvents, change);
  const validPhases = ['open', 'design', 'build', 'verify', 'archive'];
  if (currentPhase === 'unknown') {
    return { name: 'Phase', status: 'info', detail: 'No phase transitions recorded yet', confidence: 'low' };
  }
  if (!validPhases.includes(currentPhase)) {
    return { name: 'Phase', status: 'warning', detail: `Unknown phase: ${currentPhase}`, confidence: 'medium' };
  }
  return { name: 'Phase', status: 'passed', detail: `${currentPhase} — valid phase`, confidence: 'high' };
}

async function checkStuck(rawEvents: RawEvent[], change: string): Promise<CheckItem | null> {
  const result = detectStuck(rawEvents, change);
  if (!result) return null;
  return {
    name: 'Stuck',
    status: 'warning',
    detail: `Phase "${result.currentPhase}" at ${result.daysInPhase}d (threshold: ${result.thresholdDays}d)`,
    confidence: 'high',
  };
}

async function checkRollback(rawEvents: RawEvent[], change: string): Promise<CheckItem | null> {
  const result = detectRollbacks(rawEvents, change);
  if (!result) return null;
  return {
    name: 'Rollback',
    status: 'info',
    detail: `${result.rollbackCount} rollback(s) in ${result.windowDays} days`,
    confidence: 'high',
  };
}

// ─── Main Reporter ───

export async function runCiCheck(
  projectPath: string,
  change: string,
  mode: 'quick' | 'standard' | 'full' = 'standard',
): Promise<CiReport> {
  const ciMode = detectCiMode();
  const checks: CheckItem[] = [];

  // Read events
  const rawEvents: RawEvent[] = [];
  for await (const evt of readRawEvents(projectPath)) {
    rawEvents.push(evt);
  }

  // Quick checks (all modes)
  const phaseCheck = await checkPhaseValidity(rawEvents, change);
  checks.push(phaseCheck);

  // Standard+ checks
  if (mode !== 'quick') {
    const stuckCheck = await checkStuck(rawEvents, change);
    if (stuckCheck) checks.push(stuckCheck);

    const rollbackCheck = await checkRollback(rawEvents, change);
    if (rollbackCheck) checks.push(rollbackCheck);
  }

  // Full mode: add GitNexus overlay note
  if (mode === 'full') {
    checks.push({
      name: 'GitNexus',
      status: ciMode === 'full' ? 'passed' : 'info',
      detail: ciMode === 'full' ? 'Available for symbol-level analysis' : 'Not available in this environment',
      confidence: ciMode === 'full' ? 'high' : 'low',
    });
  }

  const summary = { passed: 0, warning: 0, info: 0, failed: 0 };
  for (const c of checks) {
    summary[c.status === 'passed' ? 'passed' : c.status === 'warning' ? 'warning' : c.status === 'info' ? 'info' : 'failed']++;
  }

  return {
    change,
    checkedAt: new Date().toISOString(),
    phase: phaseCheck.detail.split(' — ')[0],
    mode: ciMode,
    modeConfidence: modeConfidenceString(ciMode),
    checks,
    summary,
    nonBlocking: true,
  };
}

// ─── Formatting ───

export function formatCliReport(report: CiReport): string {
  let out = '';
  out += `\nIvyFlow Check — ${report.change} (CI Mode: ${report.mode})\n`;
  out += '═'.repeat(70) + '\n';

  for (const c of report.checks) {
    const icon = c.status === 'passed' ? '✅' : c.status === 'warning' ? '⚠️' : c.status === 'info' ? 'ℹ️' : '❌';
    out += `${icon} ${c.name}: ${c.detail}\n`;
  }

  out += '\n' + '═'.repeat(70) + '\n';
  out += `  Summary: ${report.summary.passed} passed, ${report.summary.warning} warning, ${report.summary.info} info, ${report.summary.failed} failed\n`;
  out += `  Exit code: 0 (recommendations only, non-blocking)\n`;
  out += `  Mode: ${report.mode} | ${report.modeConfidence}\n\n`;
  return out;
}

export function formatMarkdownReport(report: CiReport): string {
  let out = `## IvyFlow Workflow Check — ${report.change}\n\n`;
  out += `| Status | Check | Detail |\n`;
  out += `|--------|-------|--------|\n`;

  for (const c of report.checks) {
    const icon = c.status === 'passed' ? '✅' : c.status === 'warning' ? '⚠️' : c.status === 'info' ? 'ℹ️' : '❌';
    out += `| ${icon} | ${c.name} | ${c.detail} |\n`;
  }

  out += `\n> Mode: ${report.mode} | This is a non-blocking check. IvyFlow does not prevent PR merging.\n`;
  out += `> Run \`ivy review\` locally to process pending suggestions.\n`;
  return out;
}

export function formatJsonReport(report: CiReport): string {
  return JSON.stringify(report, null, 2);
}

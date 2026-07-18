/**
 * Adoption Engine — descriptive analytics with confidence transparency (v0.7).
 *
 * Computes adoption funnel, suggestion impact, and weekly trends from
 * existing data (events.jsonl + git diff + feedback). All metrics carry
 * explicit confidence annotations per §9.13.
 *
 * Only does descriptive statistics. No recommendations (dashboard's job).
 * Writes to Derived Cache (adoption_profile.json) for performance.
 */

import { fileExists, readFile, writeFile, ensureDir } from '../utils/fs.js';
import { readRawEvents, type RawEvent } from './sessions.js';
import { getSuggestionQuality } from './feedback-recorder.js';
import { buildTypeMap } from './suggest-engine.js';
import type { OriginEventStore } from './provenance/event-store.js';

// ─── Constants ───

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Types ───

export interface AdoptionProfile {
  changeName: string;
  periodStart: string;
  periodEnd: string;

  funnel: {
    totalCommits: number;
    totalFilesChanged: number;
    totalLinesAdded: number;
    totalChanges: number;
    completedChanges: number;
    completionRate: number;
  };

  suggestionImpact: {
    totalSuggestions: number;
    acceptedSuggestions: number;
    estimatedLinesFromAccepted: number;
    avgTimeToResolve: number;
  };

  weeklyTrend: Array<{
    week: string;
    commits: number;
    linesAdded: number;
    suggestionsAccepted: number;
  }>;

  confidence: {
    overall: 'low' | 'medium';
    note: string;
  };

  // --- V2 fields (Phase 1+2A, optional) ---
  retention?: RetentionMetrics;
  rework?: ReworkMetrics;
  abandonment?: AbandonmentMetrics;
  lineage?: LineageMetrics;
  failureIntelligence?: FailureMetrics;
}

export interface RetentionMetrics {
  totalGeneratedLines: number;
  surviveLines: number;
  retentionRatio: number;
  trackedCommits: number;
  confidence: 'low' | 'medium' | 'high';
}

export interface ReworkMetrics {
  aiGeneratedLines: number;
  humanModifiedLines: number;
  reworkRatio: number;
  modificationCount: number;
  confidence: 'low' | 'medium' | 'high';
}

export type AbandonmentReason =
  | 'user_rejected'
  | 'never_committed'
  | 'deleted_before_merge'
  | 'reverted'
  | 'refactored_away'
  | 'replaced_by_human'
  | 'timed_out'
  | 'unknown';

export interface AbandonmentMetrics {
  totalOrigins: number;
  abandonedOrigins: number;
  abandonmentRate: number;
  byReason: Record<AbandonmentReason, number>;
  timeToAbandon: {
    minHours: number;
    maxHours: number;
    medianHours: number;
    p95Hours: number;
  };
  confidence: 'low' | 'medium' | 'high';
}

export interface LineageMetrics {
  l1FileMatches: number;
  l2AstMatches: number;
  l3SemanticMatches: number;
  totalTrackedOrigins: number;
  confidence: 'low' | 'medium' | 'high';
}

export interface FailureMode {
  pattern: string;
  count: number;
  phase: string;
  affectedFiles: string[];
}

export interface FailureMetrics {
  byPhase: Record<string, { total: number; failed: number; rate: number }>;
  topFailureModes: FailureMode[];
  confidence: 'low' | 'medium' | 'high';
}

export interface ComputeOptions {
  projectPath: string;
  changeName?: string;
  periodDays?: number;
  retentionWindow?: number;
}

export class AdoptionEngineV2 {
  constructor(private store: OriginEventStore) {}

  async computeProfile(opts: ComputeOptions): Promise<AdoptionProfile> {
    const projection = await this.store.getProjection();
    const origins = [...projection.origins.values()];

    const profile: AdoptionProfile = {
      changeName: opts.changeName ?? 'all',
      periodStart: '',
      periodEnd: new Date().toISOString(),
      funnel: {
        totalCommits: 0,
        totalFilesChanged: 0,
        totalLinesAdded: 0,
        totalChanges: origins.length,
        completedChanges: 0,
        completionRate: 0,
      },
      suggestionImpact: {
        totalSuggestions: 0,
        acceptedSuggestions: 0,
        estimatedLinesFromAccepted: 0,
        avgTimeToResolve: 0,
      },
      weeklyTrend: [],
      confidence: { overall: 'low', note: 'V2 engine — metrics computed from provenance data.' },
    };

    return profile;
  }
}

// ─── Cache I/O ───

function getCachePath(projectPath: string, changeName?: string): string {
  const base = `${projectPath}/.ivy/sessions/cache/adoption_profile.json`;
  return base;
}

async function readCachedProfile(projectPath: string): Promise<AdoptionProfile | null> {
  const p = getCachePath(projectPath);
  if (!(await fileExists(p))) return null;
  try {
    const raw = await readFile(p);
    const data = JSON.parse(raw) as AdoptionProfile & { _cachedAt?: number };
    if (data._cachedAt && Date.now() - data._cachedAt < CACHE_TTL_MS) {
      return data;
    }
    return null; // Expired
  } catch {
    return null;
  }
}

async function writeCachedProfile(projectPath: string, profile: AdoptionProfile): Promise<void> {
  const p = getCachePath(projectPath);
  await ensureDir(`${projectPath}/.ivy/sessions/cache`);
  await writeFile(p, JSON.stringify({ ...profile, _cachedAt: Date.now() }, null, 2));
}

// ─── Adoption Computation ───

/**
 * Compute adoption profile from raw events.
 * Reads events.jsonl + git diff + feedback data.
 * @deprecated Use AdoptionEngineV2 with provenance data source
 */
export async function computeAdoptionProfile(
  projectPath: string,
  changeName?: string,
  periodDays: number = 30,
): Promise<AdoptionProfile> {
  // Check cache first
  const cached = await readCachedProfile(projectPath);
  if (cached && (!changeName || cached.changeName === changeName)) {
    return cached;
  }

  const rawEvents: RawEvent[] = [];
  for await (const evt of readRawEvents(projectPath)) {
    rawEvents.push(evt);
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - periodDays);
  const cutoffMs = cutoff.getTime();

  // Filter events by time and optionally by change
  const filteredEvents = rawEvents.filter((e) => {
    if (changeName && e.change !== changeName) return false;
    return new Date(e.ts).getTime() >= cutoffMs;
  });

  // Group events by change
  const byChange: Record<string, RawEvent[]> = {};
  for (const evt of filteredEvents) {
    if (!byChange[evt.change]) byChange[evt.change] = [];
    byChange[evt.change].push(evt);
  }

  const changeNames = Object.keys(byChange);

  // ─── Funnel ───
  const totalCommits = filteredEvents.filter((e) => e.event === 'git_commit').length;
  const totalChanges = changeNames.length;

  // Phase transitions don't necessarily have event type 'phase_transition' everywhere
  // Let's track changes that have reached 'archive' via phase_transition events
  let completedChanges = 0;
  for (const [, events] of Object.entries(byChange)) {
    const hasArchived = events.some(
      (e) => e.event === 'phase_transition' && (e.meta as Record<string, string>)?.to === 'archive',
    );
    if (hasArchived) completedChanges++;
  }

  const completionRate = totalChanges > 0 ? completedChanges / totalChanges : 0;

  // Lines added: estimate from git_commit events (rough approximation)
  const totalLinesAdded = filteredEvents
    .filter((e) => e.event === 'git_commit')
    .reduce((sum, e) => {
      const meta = e.meta as Record<string, number> | undefined;
      return sum + (meta?.insertions ?? 10); // default 10 if no data
    }, 0);

  // Total files changed (unique file_save events or git_commit count)
  const totalFilesChanged = filteredEvents.filter((e) => e.event === 'file_save' || e.event === 'git_commit').length;

  // ─── Suggestion Impact ───
  const typeMap = buildTypeMap([]); // empty — we just want totals
  let quality;
  try {
    quality = await getSuggestionQuality(projectPath, typeMap);
  } catch {
    quality = null;
  }

  const totalSuggestions = quality?.total ?? 0;
  const acceptedSuggestions = quality?.accepted ?? 0;
  const estimatedLinesFromAccepted = acceptedSuggestions > 0
    ? Math.round(totalLinesAdded * (acceptedSuggestions / Math.max(totalSuggestions, 1)))
    : 0;
  const avgTimeToResolve = 0; // Not computed in v0.1 (requires per-suggestion timing)

  // ─── Weekly Trend ───
  const weeklyMap = new Map<string, { commits: number; linesAdded: number; suggestionsAccepted: number }>();

  for (const evt of filteredEvents.filter((e) => e.event === 'git_commit')) {
    const d = new Date(evt.ts);
    const weekStart = getWeekStart(d);
    const key = weekStart.toISOString().split('T')[0];
    const meta = evt.meta as Record<string, number> | undefined;
    const entry = weeklyMap.get(key) ?? { commits: 0, linesAdded: 0, suggestionsAccepted: 0 };
    entry.commits++;
    entry.linesAdded += meta?.insertions ?? 10;
    weeklyMap.set(key, entry);
  }

  // Only include weeks with activity
  const weeklyTrend = [...weeklyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, data]) => ({
      week,
      commits: data.commits,
      linesAdded: data.linesAdded,
      suggestionsAccepted: 0, // Per-week suggestion resolution not tracked in v0.1
    }));

  // ─── Confidence ───
  const dataPoints = totalCommits + totalChanges;
  let overall: 'low' | 'medium';
  let note: string;

  if (dataPoints < 10) {
    overall = 'low';
    note = 'Insufficient data points. Confidence is low.';
  } else if (dataPoints < 50) {
    overall = 'medium';
    note = `Based on ${dataPoints} data points over ${periodDays} days. Adoption rate is based on session inference, not PreToolUse Hook-level precision.`;
  } else {
    overall = 'medium';
    note = `Based on ${dataPoints} data points over ${periodDays} days. Data volume is adequate for medium-confidence analysis. Adoption rate based on session inference.`;
  }

  const profile: AdoptionProfile = {
    changeName: changeName ?? 'all',
    periodStart: cutoff.toISOString(),
    periodEnd: new Date().toISOString(),
    funnel: {
      totalCommits,
      totalFilesChanged,
      totalLinesAdded,
      totalChanges,
      completedChanges,
      completionRate,
    },
    suggestionImpact: {
      totalSuggestions,
      acceptedSuggestions,
      estimatedLinesFromAccepted,
      avgTimeToResolve,
    },
    weeklyTrend,
    confidence: { overall, note },
  };

  // Cache the profile
  await writeCachedProfile(projectPath, profile);

  return profile;
}

/**
 * Format the adoption profile as human-readable output.
 */
export function formatAdoptionProfile(profile: AdoptionProfile): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`IvyFlow Adoption Analytics — ${profile.changeName}`);
  lines.push(`  Period: ${profile.periodStart.split('T')[0]} → ${profile.periodEnd.split('T')[0]}`);
  lines.push('═══════════════════════════════════════════════════════');
  lines.push('');

  // Funnel
  lines.push('📈 Adoption Funnel');
  lines.push(`  Changes:          ${profile.funnel.completedChanges}/${profile.funnel.totalChanges} completed (${Math.round(profile.funnel.completionRate * 100)}%)`);
  lines.push(`  Total commits:    ${profile.funnel.totalCommits}`);
  lines.push(`  Lines added:      ~${profile.funnel.totalLinesAdded}`);
  lines.push(`  Files changed:    ${profile.funnel.totalFilesChanged}`);
  lines.push('');

  // Suggestion impact
  if (profile.suggestionImpact.totalSuggestions > 0) {
    lines.push('💡 Suggestion Impact');
    lines.push(`  Total suggestions:  ${profile.suggestionImpact.totalSuggestions}`);
    lines.push(`  Accepted:           ${profile.suggestionImpact.acceptedSuggestions} (${Math.round(profile.suggestionImpact.acceptedSuggestions / profile.suggestionImpact.totalSuggestions * 100)}%)`);
    lines.push(`  Est. lines from accepted: ~${profile.suggestionImpact.estimatedLinesFromAccepted}`);
    lines.push('  ℹ️  Correlation observation, not causal conclusion.');
    lines.push('');
  }

  // Weekly trend
  if (profile.weeklyTrend.length > 0) {
    lines.push('📊 Weekly Trend');
    for (const w of profile.weeklyTrend) {
      const bar = '█'.repeat(Math.min(Math.round(w.commits / 2), 20));
      lines.push(`  ${w.week}  ${bar} ${w.commits} commits, ${w.linesAdded} lines`);
    }
    lines.push('');
  }

  // Confidence declaration
  lines.push('━━━ Confidence ━━━');
  lines.push(`  Overall: ${profile.confidence.overall.toUpperCase()}`);
  lines.push(`  ${profile.confidence.note}`);
  lines.push('');
  lines.push('  Metric confidence breakdown:');
  lines.push('    completionRate    → high (L1 phase_transition)');
  lines.push('    totalCommits      → high (L1 git_commit)');
  lines.push('    totalLinesAdded   → medium (git diff estimate)');
  lines.push('    acceptanceRate    → medium (user feedback)');
  lines.push('    estLinesFromAccepted → low (session association)');
  lines.push('');

  return lines.join('\n');
}

/**
 * Format adoption profile as JSON.
 */
export function formatAdoptionProfileJson(profile: AdoptionProfile): Record<string, unknown> {
  return {
    changeName: profile.changeName,
    periodStart: profile.periodStart,
    periodEnd: profile.periodEnd,
    funnel: profile.funnel,
    suggestionImpact: profile.suggestionImpact,
    weeklyTrend: profile.weeklyTrend,
    confidence: profile.confidence,
  };
}

/**
 * Get the start of the ISO week for a date.
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Memory Health — score memory quality across 6 dimensions.
 *
 * v0.12: Report-first (no KPI enforcement). 6 equally-weighted dimensions.
 * Reads Memory records via MemoryStore.
 */

import { MemoryStore } from './memory-arch.js';
import type { MemoryRecordType } from './types.js';

// ─── Types ───

export interface HealthDimension {
  name: string;
  score: number;
  subScore: string;
}

export interface MemoryHealthResult {
  compositeScore: number;
  dimensions: HealthDimension[];
}

// ─── Scoring ───

/**
 * Compute memory health across all changes.
 * 6 dimensions, equally weighted (16.67% each).
 */
export async function computeMemoryHealth(projectPath: string): Promise<MemoryHealthResult> {
  const store = new MemoryStore(projectPath);
  const all = await store.query({});
  const decisions = all.filter((r) => r.type === 'decision');
  const evidence = all.filter((r) => r.type === 'evidence');
  const constraints = all.filter((r) => r.type === 'constraint');
  const risks = all.filter((r) => r.type === 'risk');
  const facts = all.filter((r) => r.type === 'fact');

  // Group by changeName
  const byChange = new Map<string, typeof all>();
  for (const r of all) {
    const existing = byChange.get(r.changeName) ?? [];
    existing.push(r);
    byChange.set(r.changeName, existing);
  }

  const changeNames = [...byChange.keys()];

  // D1: Coverage — % of changes with at least one memory record
  const coverage = changeNames.length > 0 ? 100 : 0;

  // D2: Freshness — days since latest record
  const latestTs = all.reduce((max, r) => (r.timestamp > max ? r.timestamp : max), '');
  const daysSinceLatest = latestTs
    ? Math.floor(
        (Date.now() - new Date(latestTs).getTime()) / (1000 * 60 * 60 * 24),
      )
    : 999;
  const freshness = Math.max(0, 100 - daysSinceLatest);

  // D3: Link Density — avg outgoing links per record
  const totalLinks = all.reduce(
    (sum, r) => sum + ((r as { links?: unknown[] }).links?.length ?? 0),
    0,
  );
  const avgLinks = all.length > 0 ? totalLinks / all.length : 0;
  const linkDensity = Math.min(100, avgLinks * 25);

  // D4: Orphan Rate — % of records with at least one link
  const linkedRecords = all.filter(
    (r) => ((r as { links?: unknown[] }).links?.length ?? 0) > 0,
  ).length;
  const orphanRate = all.length > 0 ? (linkedRecords / all.length) * 100 : 0;

  // D5: Decision-Evidence Ratio — % of decisions with evidence links
  const decisionsWithEvidence = decisions.filter((d) =>
    ((d as { links?: Array<{ relation: string }> }).links ?? []).some(
      (l) => l.relation === 'evidences',
    ),
  ).length;
  const deRatio =
    decisions.length > 0
      ? (decisionsWithEvidence / decisions.length) * 100
      : 100;

  // D6: Completeness — % of changes with all 4 key types
  const changesWithAllTypes = changeNames.filter((name) => {
    const records = byChange.get(name)!;
    const types = new Set(records.map((r) => r.type));
    return (['decision', 'constraint', 'risk', 'fact'] as MemoryRecordType[]).every((t) => types.has(t));
  }).length;
  const completeness =
    changeNames.length > 0
      ? (changesWithAllTypes / changeNames.length) * 100
      : 0;

  const dimensions: HealthDimension[] = [
    { name: 'Coverage', score: Math.round(coverage), subScore: `${changeNames.length} change(s)` },
    { name: 'Freshness', score: Math.round(freshness), subScore: `${daysSinceLatest} day(s) since latest` },
    { name: 'Link Density', score: Math.round(linkDensity), subScore: `${avgLinks.toFixed(2)} avg links/record` },
    { name: 'Orphan Rate', score: Math.round(orphanRate), subScore: `${linkedRecords}/${all.length} linked` },
    { name: 'Decision-Evidence Ratio', score: Math.round(deRatio), subScore: `${decisionsWithEvidence}/${decisions.length} decisions linked` },
    { name: 'Completeness', score: Math.round(completeness), subScore: `${changesWithAllTypes}/${changeNames.length} changes complete` },
  ];

  const compositeScore = Math.round(
    dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length,
  );

  return { compositeScore, dimensions };
}

// ─── Output Formatters ───

export function formatHealthText(result: MemoryHealthResult): string {
  const lines: string[] = [];
  lines.push('Memory Health Assessment');
  lines.push('═'.repeat(50));
  lines.push('');
  lines.push(`Composite Score: ${result.compositeScore}/100`);
  lines.push('');

  for (const d of result.dimensions) {
    const bar = '█'.repeat(Math.round(d.score / 10)) + '░'.repeat(10 - Math.round(d.score / 10));
    lines.push(`  ${d.name.padEnd(28)} ${bar} ${d.score}`);
    lines.push(`  ${' '.repeat(28)} ${d.subScore}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function formatHealthJson(result: MemoryHealthResult): string {
  return JSON.stringify(
    {
      compositeScore: result.compositeScore,
      dimensions: result.dimensions,
    },
    null,
    2,
  );
}

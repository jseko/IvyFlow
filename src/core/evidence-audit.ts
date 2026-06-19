/**
 * Evidence Coverage Audit — analyze .ivy/memory records for evidence gaps.
 *
 * v0.12: Report-only (no auto-fix). Outputs structured audit results.
 */

import path from 'path';
import { promises as fs } from 'fs';

import { fileExists } from '../utils/fs.js';
import { readYaml } from '../utils/yaml.js';
import type { MemoryRecord, MemoryRecordType } from './types.js';
import type { KnowledgeLink } from './knowledge-linking.js';

// ─── Types ───

export interface AuditGap {
  type: 'orphaned_decision' | 'orphaned_evidence' | 'missing_coverage';
  recordId: string;
  recordTitle: string;
  changeName: string;
  details?: string;
}

export interface AuditCategory {
  name: string;
  count: number;
  items: string[];
}

export interface AuditResult {
  changeName: string;
  coverage: number;
  totalDecisions: number;
  decisionsWithEvidence: number;
  orphanedDecisions: AuditGap[];
  orphanedEvidence: AuditGap[];
  gapCategories: AuditCategory[];
}

// ─── Core Audit ───

export async function auditEvidence(
  ivyDir: string,
  changeName: string,
): Promise<AuditResult> {
  const gaps: AuditGap[] = [];
  const gapCategories: AuditCategory[] = [];

  const memoryDir = path.join(ivyDir, 'memory');

  // No memory dir means no records
  if (!(await fileExists(memoryDir))) {
    return emptyResult(changeName);
  }

  // Read all records for this change
  const records = await readRecordsForChange(memoryDir, changeName);

  // Filter by type
  const decisions = records.filter((r) => r.type === 'decision');
  const evidenceRecords = records.filter((r) => r.type === 'evidence');

  if (decisions.length === 0) {
    return {
      ...emptyResult(changeName),
      totalDecisions: 0,
      decisionsWithEvidence: 0,
      coverage: 100,
      gapCategories: [{ name: 'No decisions found', count: 0, items: [] }],
    };
  }

  // Find orphaned decisions (no outgoing `evidences` links)
  const orphanedDecisions: AuditGap[] = [];
  let decisionsWithEvidence = 0;

  for (const dec of decisions) {
    const links = (dec as MemoryRecord & { links?: KnowledgeLink[] }).links ?? [];
    const hasEvidence = links.some((l) => l.relation === 'evidences');
    if (hasEvidence) {
      decisionsWithEvidence++;
    } else {
      orphanedDecisions.push({
        type: 'orphaned_decision',
        recordId: dec.id,
        recordTitle: dec.title,
        changeName,
        details: 'No outgoing evidences link',
      });
    }
  }

  const coverage = Math.round((decisionsWithEvidence / decisions.length) * 100);

  // Find orphaned evidence (no incoming links from any decision)
  const orphanedEvidence: AuditGap[] = [];
  for (const ev of evidenceRecords) {
    const hasIncomingLink = decisions.some((d) => {
      const links = (d as MemoryRecord & { links?: KnowledgeLink[] }).links ?? [];
      return links.some((l) => l.target === ev.id && l.relation === 'evidences');
    });
    if (!hasIncomingLink) {
      orphanedEvidence.push({
        type: 'orphaned_evidence',
        recordId: ev.id,
        recordTitle: ev.title,
        changeName,
        details: 'No incoming evidence link from any decision',
      });
    }
  }

  gaps.push(...orphanedDecisions, ...orphanedEvidence);

  // Build gap categories
  if (orphanedDecisions.length > 0) {
    gapCategories.push({
      name: 'Orphaned Decisions',
      count: orphanedDecisions.length,
      items: orphanedDecisions.map((g) => `${g.recordId}: ${g.recordTitle}`),
    });
  }
  if (orphanedEvidence.length > 0) {
    gapCategories.push({
      name: 'Orphaned Evidence',
      count: orphanedEvidence.length,
      items: orphanedEvidence.map((g) => `${g.recordId}: ${g.recordTitle}`),
    });
  }

  return {
    changeName,
    coverage,
    totalDecisions: decisions.length,
    decisionsWithEvidence,
    orphanedDecisions,
    orphanedEvidence,
    gapCategories,
  };
}

// ─── Output Formatters ───

export function formatAuditText(result: AuditResult): string {
  const lines: string[] = [];
  lines.push(`Evidence Coverage Audit: ${result.changeName}`);
  lines.push(`═`.repeat(50));
  lines.push(`Coverage: ${result.coverage}%`);
  lines.push(`Decisions: ${result.decisionsWithEvidence}/${result.totalDecisions} with evidence`);
  lines.push('');

  if (result.gapCategories.length === 0) {
    lines.push('No gaps found — all decisions have evidence links.');
    return lines.join('\n');
  }

  for (const cat of result.gapCategories) {
    lines.push(` [${cat.name}]: ${cat.count}`);
    for (const item of cat.items) {
      lines.push(`   • ${item}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function formatAuditJson(result: AuditResult): string {
  return JSON.stringify(
    {
      changeName: result.changeName,
      coverage: result.coverage,
      totalDecisions: result.totalDecisions,
      decisionsWithEvidence: result.decisionsWithEvidence,
      orphanedDecisions: result.orphanedDecisions.map((g) => ({
        recordId: g.recordId,
        title: g.recordTitle,
      })),
      orphanedEvidence: result.orphanedEvidence.map((g) => ({
        recordId: g.recordId,
        title: g.recordTitle,
      })),
      gapCategories: result.gapCategories,
    },
    null,
    2,
  );
}

// ─── Internal ───

function emptyResult(changeName: string): AuditResult {
  return {
    changeName,
    coverage: 0,
    totalDecisions: 0,
    decisionsWithEvidence: 0,
    orphanedDecisions: [],
    orphanedEvidence: [],
    gapCategories: [{ name: 'No records found', count: 0, items: [] }],
  };
}

async function readRecordsForChange(
  memoryDir: string,
  changeName: string,
): Promise<Array<MemoryRecord & { links?: KnowledgeLink[] }>> {
  const types: MemoryRecordType[] = ['decision', 'constraint', 'risk', 'fact', 'evidence'];
  const results: Array<MemoryRecord & { links?: KnowledgeLink[] }> = [];

  for (const type of types) {
    const dir = path.join(memoryDir, type);
    if (!(await fileExists(dir))) continue;
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (!file.endsWith('.yaml')) continue;
        if (!file.startsWith(`${changeName}-`)) continue;
        const record = await readYaml<MemoryRecord & { links?: KnowledgeLink[] }>(
          path.join(dir, file),
        );
        if (record && record.id) {
          results.push(record);
        }
      }
    } catch {
      continue;
    }
  }

  return results;
}

/**
 * Trace Report — follow knowledge links forward and backward through Memory records.
 *
 * v0.12: Max depth 5. Supports forward/backward trace, output formatting,
 * and Trace Impact (Experimental, gated behind --impact flag).
 * No graph database or index features.
 */

import path from 'path';
import { promises as fs } from 'fs';

import { fileExists } from '../utils/fs.js';
import { readYaml } from '../utils/yaml.js';
import type { MemoryRecord, MemoryRecordType } from './types.js';
import type { KnowledgeLink, LinkRelation } from './knowledge-linking.js';

// ─── Constants ───

const MAX_TRACE_DEPTH = 5;

// ─── Types ───

export interface TraceStep {
  recordId: string;
  type: string;
  title: string;
  relation: string;
  depth: number;
  estimated?: boolean;
}

export interface TraceResult {
  startId: string;
  direction: 'forward' | 'backward';
  path: TraceStep[];
  complete: boolean;
  maxDepthReached: boolean;
}

export interface ImpactEstimate {
  affectedDecisions: string[];
  affectedEvidence: string[];
  truncated: boolean;
}

// ─── Core Trace ───

export async function traceRecords(
  memoryDir: string,
  startId: string,
  direction: 'forward' | 'backward' = 'forward',
): Promise<TraceResult> {
  const startRecord = await findRecordById(memoryDir, startId);
  if (!startRecord) {
    return {
      startId,
      direction,
      path: [],
      complete: false,
      maxDepthReached: false,
    };
  }

  const visited = new Set<string>();
  const steps: TraceStep[] = [];
  let maxDepthReached = false;

  // Start node
  steps.push({
    recordId: startRecord.id,
    type: startRecord.type,
    title: startRecord.title,
    relation: 'start',
    depth: 0,
  });
  visited.add(startRecord.id);

  if (direction === 'forward') {
    await followForward(memoryDir, startRecord.id, visited, steps, 1);
  } else {
    await followBackward(memoryDir, startRecord.id, visited, steps, 1);
  }

  // Check if max depth was hit
  maxDepthReached = steps.some((s) => s.depth >= MAX_TRACE_DEPTH);

  return {
    startId,
    direction,
    path: steps,
    complete: !maxDepthReached,
    maxDepthReached,
  };
}

async function followForward(
  memoryDir: string,
  currentId: string,
  visited: Set<string>,
  steps: TraceStep[],
  depth: number,
): Promise<void> {
  if (depth > MAX_TRACE_DEPTH) return;

  const record = await findRecordById(memoryDir, currentId);
  if (!record) return;

  const links = (record as MemoryRecord & { links?: KnowledgeLink[] }).links ?? [];
  for (const link of links) {
    if (visited.has(link.target)) continue;
    visited.add(link.target);

    const targetRecord = await findRecordById(memoryDir, link.target);
    steps.push({
      recordId: link.target,
      type: targetRecord?.type ?? 'unknown',
      title: targetRecord?.title ?? link.target,
      relation: link.relation,
      depth,
    });

    await followForward(memoryDir, link.target, visited, steps, depth + 1);
  }
}

async function followBackward(
  memoryDir: string,
  currentId: string,
  visited: Set<string>,
  steps: TraceStep[],
  depth: number,
): Promise<void> {
  if (depth > MAX_TRACE_DEPTH) return;

  // Find all records that link to currentId
  const allRecords = await findAllRecords(memoryDir);
  for (const [recId, recPath] of allRecords) {
    if (visited.has(recId)) continue;

    const rec = await readYaml<MemoryRecord & { links?: KnowledgeLink[] }>(recPath);
    if (!rec?.links) continue;

    const matchingLinks = rec.links.filter((l) => l.target === currentId);
    if (matchingLinks.length === 0) continue;

    visited.add(recId);
    steps.push({
      recordId: recId,
      type: rec.type,
      title: rec.title,
      relation: matchingLinks[0].relation,
      depth,
    });

    await followBackward(memoryDir, recId, visited, steps, depth + 1);
  }
}

// ─── Trace Impact (Experimental) ───

export async function estimateImpact(
  memoryDir: string,
  constraintId: string,
): Promise<ImpactEstimate> {
  const affectedDecisions: string[] = [];
  const affectedEvidence: string[] = [];
  let truncated = false;

  const constraint = await findRecordById(memoryDir, constraintId);
  if (!constraint) {
    return { affectedDecisions: [], affectedEvidence: [], truncated: false };
  }

  const visited = new Set<string>();
  visited.add(constraintId);

  // Depth-limited traversal: find decisions that influence this constraint
  // and evidence that evidences those decisions
  const allRecords = await findAllRecords(memoryDir);

  // Phase 1: find decisions with 'influences' link to this constraint
  for (const [recId, recPath] of allRecords) {
    const rec = await readYaml<MemoryRecord & { links?: KnowledgeLink[] }>(recPath);
    if (!rec?.links) continue;
    if (rec.type !== 'decision') continue;
    if (rec.links.some((l) => l.target === constraintId && l.relation === 'influences')) {
      affectedDecisions.push(recId);
      visited.add(recId);

      // Phase 2: find evidence for these decisions (depth 2)
      if (visited.size >= MAX_TRACE_DEPTH * 3) {
        truncated = true;
        break;
      }
      for (const [evId] of allRecords) {
        if (visited.has(evId)) continue;
        // Check if the decision links to this evidence
        if (rec.links.some((l) => l.target === evId && l.relation === 'evidences')) {
          affectedEvidence.push(evId);
          visited.add(evId);
        }
      }
    }
  }

  return { affectedDecisions, affectedEvidence, truncated };
}

// ─── Output Formatters ───

export function formatTraceText(result: TraceResult, impact?: ImpactEstimate): string {
  const lines: string[] = [];
  lines.push(`Trace: ${result.startId} (${result.direction})`);
  lines.push(`═`.repeat(50));
  lines.push('');

  for (const step of result.path) {
    const indent = '  '.repeat(step.depth);
    const est = step.estimated ? ' (estimated)' : '';
    lines.push(`${indent}${step.depth > 0 ? '→ ' : ''}[${step.type}] ${step.recordId}: ${step.title}${est}`);
    if (step.depth > 0) {
      lines.push(`${indent}  relation: ${step.relation}`);
    }
  }

  if (result.maxDepthReached) {
    lines.push('');
    lines.push('(max depth reached — trace truncated)');
  }

  if (!result.complete && result.path.length === 0) {
    lines.push('Record not found');
  }

  // Impact section
  if (impact) {
    lines.push('');
    lines.push('Impact Estimate (Experimental)');
    lines.push('─'.repeat(40));
    if (impact.affectedDecisions.length > 0) {
      lines.push(`Affected Decisions: ${impact.affectedDecisions.join(', ')}`);
    }
    if (impact.affectedEvidence.length > 0) {
      lines.push(`Affected Evidence: ${impact.affectedEvidence.join(', ')}`);
    }
    if (impact.truncated) {
      lines.push('(impact estimation truncated — max depth reached)');
    }
    if (impact.affectedDecisions.length === 0 && impact.affectedEvidence.length === 0) {
      lines.push('No impact detected');
    }
  }

  return lines.join('\n');
}

export function formatTraceJson(result: TraceResult, impact?: ImpactEstimate): string {
  return JSON.stringify(
    {
      startId: result.startId,
      direction: result.direction,
      complete: result.complete,
      maxDepthReached: result.maxDepthReached,
      path: result.path.map((s) => ({
        recordId: s.recordId,
        type: s.type,
        title: s.title,
        relation: s.relation,
        depth: s.depth,
        estimated: s.estimated ?? false,
      })),
      ...(impact
        ? {
            impact: {
              affectedDecisions: impact.affectedDecisions,
              affectedEvidence: impact.affectedEvidence,
              truncated: impact.truncated,
            },
          }
        : {}),
    },
    null,
    2,
  );
}

// ─── Internal ───

async function findRecordById(
  memoryDir: string,
  recordId: string,
): Promise<(MemoryRecord & { links?: KnowledgeLink[] }) | null> {
  const typeName = typeFromId(recordId);
  const recordDir = path.join(memoryDir, typeName);

  if (!(await fileExists(recordDir))) return null;

  try {
    const files = await fs.readdir(recordDir);
    for (const file of files) {
      if (!file.endsWith('.yaml')) continue;
      const content = await readYaml<MemoryRecord & { links?: KnowledgeLink[] }>(
        path.join(recordDir, file),
      );
      if (content?.id === recordId) return content;
    }
  } catch {
    /* ignore */
  }

  return null;
}

async function findAllRecords(
  memoryDir: string,
): Promise<Array<[string, string]>> {
  const results: Array<[string, string]> = [];
  const types: MemoryRecordType[] = ['decision', 'constraint', 'risk', 'fact', 'evidence'];

  for (const type of types) {
    const dir = path.join(memoryDir, type);
    if (!(await fileExists(dir))) continue;
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (!file.endsWith('.yaml')) continue;
        const filePath = path.join(dir, file);
        const content = await readYaml<{ id?: string }>(filePath);
        if (content?.id) results.push([content.id, filePath]);
      }
    } catch {
      /* ignore */
    }
  }

  return results;
}

function typeFromId(id: string): string {
  const prefix = id.split('-')[0].toLowerCase();
  const map: Record<string, string> = {
    adr: 'decision',
    con: 'constraint',
    ris: 'risk',
    fac: 'fact',
    evi: 'evidence',
  };
  return map[prefix] ?? 'unknown';
}

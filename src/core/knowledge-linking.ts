/**
 * Knowledge Linking — cross-record link management embedded in Memory records.
 *
 * v0.11: Links are stored as `links` field in Memory YAML records.
 * 5 relation types: influences, implements, precedes, supersedes, evidences.
 *
 * Knowledge Linking Boundary:
 * - max_outgoing_links_per_record: 10
 * - max_traversal_depth: 3
 * - no central graph index, no graph query language
 */

import path from 'path';
import { promises as fs } from 'fs';

import { fileExists, ensureDir } from '../utils/fs.js';
import { readYaml, writeYaml } from '../utils/yaml.js';
import type { MemoryRecord, MemoryRecordType } from './types.js';

// ─── Constants ───

const VALID_RELATIONS = ['influences', 'implements', 'precedes', 'supersedes', 'evidences'] as const;
export type LinkRelation = (typeof VALID_RELATIONS)[number];

const MAX_OUTGOING_LINKS = 10;
const MAX_TRAVERSAL_DEPTH = 3;

// ─── Types ───

export interface KnowledgeLink {
  target: string;
  relation: LinkRelation;
  description: string;
  createdAt: string;
}

export interface LinkResult {
  success: boolean;
  message: string;
  sourceRecord?: string;
  linkCount?: number;
}

export interface LinksQueryResult {
  recordId: string;
  outgoing: Array<KnowledgeLink & { index: number }>;
  incoming: Array<{ sourceRecordId: string; link: KnowledgeLink }>;
}

export interface TraverseStep {
  recordId: string;
  relation: string;
  depth: number;
}

export interface TraverseResult {
  path: TraverseStep[];
  complete: boolean;
}

// ─── Link Management ───

/**
 * Create a manual link from a source record to a target record.
 * Only decision records can be manual sources.
 */
export async function createLink(
  memoryDir: string,
  sourceId: string,
  targetId: string,
  relation: LinkRelation,
  description: string,
): Promise<LinkResult> {
  // Validate relation
  if (!VALID_RELATIONS.includes(relation)) {
    return {
      success: false,
      message: `Invalid relation "${relation}". Valid: ${VALID_RELATIONS.join(', ')}`,
    };
  }

  // Parse source type from ID prefix
  const sourceType = typeFromId(sourceId);
  if (sourceType !== 'decision') {
    return {
      success: false,
      message: `Manual linking only supports decision source records (got "${sourceType}")`,
    };
  }

  // Find source record
  const sourcePath = await findRecordPath(memoryDir, sourceId);
  if (!sourcePath) {
    return { success: false, message: `Source record "${sourceId}" not found` };
  }

  // Verify target exists
  const targetPath = await findRecordPath(memoryDir, targetId);
  if (!targetPath) {
    return { success: false, message: `Target record "${targetId}" not found` };
  }

  // Read source record
  const record = await readYaml<MemoryRecord & { links?: KnowledgeLink[] }>(sourcePath);
  if (!record) {
    return { success: false, message: `Failed to read source record "${sourceId}"` };
  }

  // Check max outgoing links
  const existingLinks = record.links ?? [];
  if (existingLinks.length >= MAX_OUTGOING_LINKS) {
    return {
      success: false,
      message: `Maximum ${MAX_OUTGOING_LINKS} outgoing links per record reached`,
    };
  }

  // Check for duplicate
  if (existingLinks.some((l) => l.target === targetId && l.relation === relation)) {
    return { success: false, message: `Link already exists: ${sourceId} → ${targetId} [${relation}]` };
  }

  // Add link
  const newLink: KnowledgeLink = {
    target: targetId,
    relation,
    description,
    createdAt: new Date().toISOString().split('T')[0],
  };

  record.links = [...existingLinks, newLink];
  await writeYaml(sourcePath, record as unknown as Record<string, unknown>);

  return {
    success: true,
    message: `Link created: ${sourceId} → ${targetId} [${relation}]`,
    sourceRecord: sourceId,
    linkCount: record.links.length,
  };
}

/**
 * Query links for a record: both outgoing and incoming.
 */
export async function getLinks(memoryDir: string, recordId: string): Promise<LinksQueryResult | null> {
  // Check if record exists
  const sourcePath = await findRecordPath(memoryDir, recordId);
  if (!sourcePath) return null;

  const record = await readYaml<MemoryRecord & { links?: KnowledgeLink[] }>(sourcePath);
  if (!record) return null;

  const outgoing: LinksQueryResult['outgoing'] = (record.links ?? []).map((l, i) => ({ ...l, index: i }));

  // Find incoming links: scan all records
  const incoming: LinksQueryResult['incoming'] = [];
  const allRecords = await findAllRecords(memoryDir);
  for (const [recId, recPath] of allRecords) {
    if (recId === recordId) continue;
    const rec = await readYaml<MemoryRecord & { links?: KnowledgeLink[] }>(recPath);
    if (rec?.links) {
      for (const link of rec.links) {
        if (link.target === recordId) {
          incoming.push({ sourceRecordId: recId, link });
        }
      }
    }
  }

  return { recordId, outgoing, incoming };
}

/**
 * Traverse links from a source record to a target type, depth-limited.
 */
export async function traverse(
  memoryDir: string,
  startId: string,
  targetType?: MemoryRecordType,
): Promise<TraverseResult> {
  const visited = new Set<string>();
  const path: TraverseStep[] = [];
  let complete = false;

  async function dfs(currentId: string, depth: number): Promise<boolean> {
    if (depth > MAX_TRAVERSAL_DEPTH) return false;
    if (visited.has(currentId)) return false;
    visited.add(currentId);

    const currentType = typeFromId(currentId);
    if (targetType && currentType === targetType && depth > 0) {
      complete = true;
      return true;
    }

    // Find outgoing links from current record
    const currentPath = await findRecordPath(memoryDir, currentId);
    if (!currentPath) return false;

    const record = await readYaml<MemoryRecord & { links?: KnowledgeLink[] }>(currentPath);
    if (!record?.links) return false;

    for (const link of record.links) {
      path.push({ recordId: link.target, relation: link.relation, depth });
      const found = await dfs(link.target, depth + 1);
      if (found) return true;
      path.pop();
    }

    return false;
  }

  path.push({ recordId: startId, relation: 'start', depth: 0 });
  await dfs(startId, 1);

  return { path, complete };
}

/**
 * Delete a link from a record by index.
 */
export async function deleteLink(memoryDir: string, recordId: string, linkIndex: number): Promise<LinkResult> {
  const sourcePath = await findRecordPath(memoryDir, recordId);
  if (!sourcePath) {
    return { success: false, message: `Record "${recordId}" not found` };
  }

  const record = await readYaml<MemoryRecord & { links?: KnowledgeLink[] }>(sourcePath);
  if (!record) {
    return { success: false, message: `Failed to read record "${recordId}"` };
  }

  const links = record.links ?? [];
  if (linkIndex < 0 || linkIndex >= links.length) {
    return { success: false, message: `Link index ${linkIndex} out of range (0-${links.length - 1})` };
  }

  const removed = links.splice(linkIndex, 1)[0];
  record.links = links.length > 0 ? links : undefined;
  await writeYaml(sourcePath, record as unknown as Record<string, unknown>);

  return {
    success: true,
    message: `Link removed: ${recordId} → ${removed.target} [${removed.relation}]`,
    linkCount: links.length,
  };
}

// ─── Quality Gates Integration ───

/**
 * Auto-create link when a Quality Gate passes.
 * Creates task→evidence or evidence→decision links.
 */
export async function createAutoLink(
  memoryDir: string,
  sourceId: string,
  targetId: string,
  relation: 'evidences' | 'implements',
  description: string,
): Promise<LinkResult> {
  // Skip validation for auto links (any source type allowed)
  const sourcePath = await findRecordPath(memoryDir, sourceId);
  if (!sourcePath) {
    return { success: false, message: `Source record "${sourceId}" not found for auto-link` };
  }

  const targetPath = await findRecordPath(memoryDir, targetId);
  if (!targetPath) {
    return { success: false, message: `Target record "${targetId}" not found for auto-link` };
  }

  const record = await readYaml<MemoryRecord & { links?: KnowledgeLink[] }>(sourcePath);
  if (!record) {
    return { success: false, message: `Failed to read source record "${sourceId}"` };
  }

  const existingLinks = record.links ?? [];
  if (existingLinks.length >= MAX_OUTGOING_LINKS) {
    return { success: false, message: `Max ${MAX_OUTGOING_LINKS} links reached for "${sourceId}"` };
  }

  if (existingLinks.some((l) => l.target === targetId && l.relation === relation)) {
    return { success: true, message: `Auto-link already exists (skipped)` };
  }

  const newLink: KnowledgeLink = {
    target: targetId,
    relation,
    description,
    createdAt: new Date().toISOString().split('T')[0],
  };

  record.links = [...existingLinks, newLink];
  await writeYaml(sourcePath, record as unknown as Record<string, unknown>);

  return {
    success: true,
    message: `Auto-link created: ${sourceId} → ${targetId} [${relation}]`,
    linkCount: record.links.length,
  };
}

// ─── Internal ───

function typeFromId(id: string): string {
  const prefix = id.split('-')[0].toLowerCase();
  const map: Record<string, string> = {
    adr: 'decision',
    con: 'constraint',
    ris: 'risk',
    fac: 'fact',
    evi: 'evidence',
  };
  return map[prefix] ?? prefix;
}

async function findRecordPath(memoryDir: string, recordId: string): Promise<string | null> {
  const typeName = typeFromId(recordId);
  const recordDir = path.join(memoryDir, typeName);

  if (!(await fileExists(recordDir))) return null;

  try {
    const files = await fs.readdir(recordDir);
    for (const file of files) {
      if (!file.endsWith('.yaml')) continue;
      const content = await readYaml<{ id?: string }>(path.join(recordDir, file));
      if (content?.id === recordId) return path.join(recordDir, file);
    }
  } catch { /* ignore */ }

  return null;
}

async function findAllRecords(memoryDir: string): Promise<Array<[string, string]>> {
  const results: Array<[string, string]> = [];
  const types = ['decision', 'constraint', 'risk', 'fact', 'evidence'];

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
    } catch { /* ignore */ }
  }

  return results;
}

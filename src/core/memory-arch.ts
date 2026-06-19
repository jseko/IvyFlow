/**
 * Memory Architecture — unified storage, typed records, multi-view access.
 *
 * v0.10 freeze: .ivy/memory/schema.yaml defines 5 record types.
 * ADR is a view (filter type === 'decision'), not a standalone module.
 * Backward compatible: references v0.9 .ivy/knowledge/ via index.json.
 */

import path from 'path';
import { promises as fs } from 'fs';

import { fileExists, ensureDir } from '../utils/fs.js';
import { readYaml, writeYaml } from '../utils/yaml.js';
import type { MemoryRecord, MemoryRecordType, AdrView, AdrIndexEntry, MemoryOverview } from './types.js';

// ─── Constants ───

const SCHEMA_VERSION = '0.10.0';

const SCHEMA_YAML = `# .ivy/memory/schema.yaml — Frozen Memory Schema (v0.10.0)
# Changes to this schema require an RFC. See docs/rfc/template.md.
version: '${SCHEMA_VERSION}'
types:
  - id: decision
    description: Architecture Decision Record (structured decision)
    required: [id, type, title, timestamp, content]
    optional: [tags, supersededBy]
  - id: constraint
    description: Project constraint (technical/process/resource)
    required: [id, type, title, timestamp, content]
    optional: [tags, source]
  - id: risk
    description: Risk assessment record
    required: [id, type, title, timestamp, content]
    optional: [tags, mitigation]
  - id: fact
    description: Established fact
    required: [id, type, title, timestamp, content]
    optional: [tags, source]
  - id: evidence
    description: Verification evidence
    required: [id, type, title, timestamp, content]
    optional: [tags, gateName, passed]
`;

// ─── MemoryStore ───

export class MemoryStore {
  private projectPath: string;
  private memoryDir: string;
  private indexCache: MemoryIndex | null = null;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.memoryDir = path.join(projectPath, '.ivy', 'memory');
  }

  // ─── Schema ───

  async ensureSchema(): Promise<void> {
    const schemaPath = path.join(this.memoryDir, 'schema.yaml');
    if (!(await fileExists(schemaPath))) {
      await ensureDir(this.memoryDir);
      await fs.writeFile(schemaPath, SCHEMA_YAML, 'utf-8');
    }
  }

  async readSchema(): Promise<{ version: string } | null> {
    return readYaml(path.join(this.memoryDir, 'schema.yaml'));
  }

  // ─── Write ───

  async write(record: Omit<MemoryRecord, 'id'>): Promise<string> {
    const id = await this.nextId(record.type);
    const full: MemoryRecord = { ...record, id };

    // Write YAML record
    const dir = path.join(this.memoryDir, record.type);
    await ensureDir(dir);
    const fileName = `${record.changeName}-${id.toLowerCase()}.yaml`;
    await writeYaml(path.join(dir, fileName), full as unknown as Record<string, unknown>);

    // Update index
    await this.updateIndex({
      id,
      type: record.type,
      title: record.title,
      changeName: record.changeName,
      timestamp: record.timestamp,
      file: fileName,
    });

    return id;
  }

  // ─── Query ───

  async query(filter: {
    types?: MemoryRecordType[];
    tags?: string[];
    changeName?: string;
    timeRange?: { from: string; to: string };
  }): Promise<MemoryRecord[]> {
    const types: string[] = filter.types ?? ['decision', 'constraint', 'risk', 'fact', 'evidence'];
    const results: MemoryRecord[] = [];
    const index = await this.readIndex();
    if (!index) return results;

    for (const entry of index.entries) {
      if (!types.includes(entry.type)) continue;
      if (filter.changeName && entry.changeName !== filter.changeName) continue;
      if (filter.tags && filter.tags.length > 0) {
        const record = await this.readRecord(entry.type, entry.file);
        if (!record) continue;
        if (!filter.tags.some((t) => record.tags.includes(t))) continue;
        results.push(record);
        continue;
      }
      if (filter.timeRange) {
        if (entry.timestamp < filter.timeRange.from || entry.timestamp > filter.timeRange.to) continue;
      }
      const record = await this.readRecord(entry.type, entry.file);
      if (record) results.push(record);
    }

    return results;
  }

  // ─── ADR View ───

  async renderAdrView(): Promise<AdrView> {
    const decisions = await this.query({ types: ['decision'] });
    const index: AdrIndexEntry[] = decisions.map((r) => ({
      id: r.id,
      title: r.title,
      status: (r as AdrRecordWithStatus).status ?? 'accepted',
      date: r.timestamp.split('T')[0],
      changeName: r.changeName,
      supersededBy: (r as AdrRecordWithStatus).supersededBy,
    }));

    return { records: decisions, index };
  }

  // ─── Memory Overview ───

  async renderMemoryOverview(): Promise<MemoryOverview> {
    const all = await this.query({});
    const byType: Record<MemoryRecordType, number> = {
      decision: 0, constraint: 0, risk: 0, fact: 0, evidence: 0, capability: 0, 'verify-profile': 0,
    };

    for (const r of all) {
      byType[r.type]++;
    }

    // Count v0.9 knowledge entries
    let knowledgeEntryCount = 0;
    const knowledgeDir = path.join(this.projectPath, '.ivy', 'knowledge');
    if (await fileExists(knowledgeDir)) {
      try {
        const files = await fs.readdir(knowledgeDir);
        knowledgeEntryCount = files.filter((f) => f.endsWith('.yaml')).length;
      } catch {
        // ignore
      }
    }

    return { totalRecords: all.length, byType, knowledgeEntryCount };
  }

  // ─── Index Management ───

  private async nextId(type: string): Promise<string> {
    const prefix = type === 'decision' ? 'ADR' : type.substring(0, 3).toUpperCase();
    const index = await this.readIndex();
    if (!index) return `${prefix}-001`;

    const typeEntries = index.entries.filter((e) => e.type === type);
    const maxSeq = typeEntries.reduce((max, e) => {
      const match = e.id.match(/(\d+)$/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);

    const next = maxSeq + 1;
    return `${prefix}-${String(next).padStart(3, '0')}`;
  }

  private async readRecord(type: string, fileName: string): Promise<MemoryRecord | null> {
    return readYaml<MemoryRecord>(path.join(this.memoryDir, type, fileName));
  }

  private async readIndex(): Promise<MemoryIndex | null> {
    if (this.indexCache) return this.indexCache;
    const idx = await readYaml<MemoryIndex>(path.join(this.memoryDir, 'index.json'));
    if (idx) this.indexCache = idx;
    return idx ?? null;
  }

  private async updateIndex(entry: IndexEntry): Promise<void> {
    const index = (await this.readIndex()) ?? { version: SCHEMA_VERSION, entries: [] };
    index.entries.push(entry);
    this.indexCache = index;
    await ensureDir(this.memoryDir);
    await writeYaml(path.join(this.memoryDir, 'index.json'), index as unknown as Record<string, unknown>);
  }

  /** Ensure v0.9 .ivy/knowledge/ entries are referenced in the index. */
  async referenceV09Knowledge(): Promise<void> {
    const knowledgeDir = path.join(this.projectPath, '.ivy', 'knowledge');
    if (!(await fileExists(knowledgeDir))) return;

    const index = (await this.readIndex()) ?? { version: SCHEMA_VERSION, entries: [] };
    const existingRefs = new Set(index.entries.map((e) => e.file));

    try {
      const files = await fs.readdir(knowledgeDir);
      for (const file of files) {
        if (!file.endsWith('.yaml')) continue;
        if (existingRefs.has(file)) continue;
        index.entries.push({
          id: `KB-${String(index.entries.length + 1).padStart(3, '0')}`,
          type: 'fact',
          title: file.replace('.yaml', ''),
          changeName: 'v0.9',
          timestamp: new Date().toISOString(),
          file: path.join('..', 'knowledge', file),
        });
      }
    } catch {
      return;
    }

    this.indexCache = index;
    await writeYaml(path.join(this.memoryDir, 'index.json'), index as unknown as Record<string, unknown>);
  }
}

// ─── Internal Types ───

interface IndexEntry {
  id: string;
  type: string;
  title: string;
  changeName: string;
  timestamp: string;
  file: string;
}

interface MemoryIndex {
  version: string;
  entries: IndexEntry[];
}

interface AdrRecordWithStatus {
  status?: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  supersededBy?: string;
}

/**
 * L0 Memory Writer — writes extracted knowledge as L0 Memory entries to
 * `.ivy/memory/<change-name>/` directory.
 *
 * Each knowledge type gets its own YAML file. A knowledge-summary.yaml tracks
 * the archive metadata. Schema designed for v1.0 L1/L2 expansion.
 */

import path from 'path';

import { ensureDir, writeFile } from '../utils/fs.js';
import { stringify } from 'yaml';
import type { ProjectKnowledge, MemoryL0Entry, MemorySummary } from './types.js';

// ─── Types ───

export interface MemoryWriterOptions {
  memoryDir: string;       // .ivy/memory/<change-name>/
  knowledge: ProjectKnowledge;
  changeName: string;
  extractableTypes: Array<keyof ProjectKnowledge>;  // for validation
}

// ─── Public API ───

/**
 * Write knowledge records as L0 Memory entries to the memory directory.
 * Creates one YAML file per extractable type + a summary file.
 * Returns the path to the memory directory.
 */
export async function writeL0Memory(opts: MemoryWriterOptions): Promise<string> {
  const { memoryDir, knowledge, changeName } = opts;

  await ensureDir(memoryDir);

  // Write per-type YAML files
  const typeConfigs: Array<{
    key: keyof ProjectKnowledge;
    filename: string;
    toEntries: (records: unknown[]) => MemoryL0Entry[];
  }> = [
    {
      key: 'decisions', filename: 'decisions.yaml',
      toEntries: (records) => (records as typeof knowledge.decisions).map((r) => ({
        type: 'decision' as const,
        key: toKebabKey(r.title),
        value: r.description,
        source: r.source,
        confidence: 1.0,
        timestamp: r.date ? `${r.date}T00:00:00Z` : new Date().toISOString(),
      })),
    },
    {
      key: 'constraints', filename: 'constraints.yaml',
      toEntries: (records) => (records as typeof knowledge.constraints).map((r) => ({
        type: 'constraint' as const,
        key: toKebabKey(r.description),
        value: r.description,
        source: r.source,
        confidence: 1.0,
        timestamp: new Date().toISOString(),
      })),
    },
    {
      key: 'risks', filename: 'risks.yaml',
      toEntries: (records) => (records as typeof knowledge.risks).map((r) => ({
        type: 'risk' as const,
        key: toKebabKey(r.description),
        value: r.mitigation ? `${r.description} | Mitigation: ${r.mitigation}` : r.description,
        source: r.source,
        confidence: 1.0,
        timestamp: new Date().toISOString(),
      })),
    },
    {
      key: 'facts', filename: 'facts.yaml',
      toEntries: (records) => (records as typeof knowledge.facts).map((r) => ({
        type: 'fact' as const,
        key: toKebabKey(r.description),
        value: r.description,
        source: r.source,
        confidence: 1.0,
        timestamp: new Date().toISOString(),
      })),
    },
  ];

  const counts: Record<string, number> = { decision: 0, constraint: 0, risk: 0, fact: 0 };

  for (const cfg of typeConfigs) {
    const records = knowledge[cfg.key] as unknown[];
    const entries = cfg.toEntries(records);
    counts[cfg.key.replace(/s$/, '')] = entries.length;

    if (entries.length > 0) {
      const yamlContent = stringify({ entries });
      await writeFile(path.join(memoryDir, cfg.filename), yamlContent);
    }
  }

  // Write summary
  const summary: MemorySummary = {
    changeName,
    archiveDate: new Date().toISOString(),
    counts: counts as MemorySummary['counts'],
    memoryDir,
  };
  await writeFile(path.join(memoryDir, 'knowledge-summary.yaml'), stringify(summary));

  return memoryDir;
}

// ─── Helpers ───

function toKebabKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

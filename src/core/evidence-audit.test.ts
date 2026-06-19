import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import { auditEvidence, formatAuditText, formatAuditJson } from './evidence-audit.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'evidence-audit-'));
}

async function writeMemoryRecord(
  memoryDir: string,
  type: string,
  changeName: string,
  record: { id: string; title: string; links?: Array<{ target: string; relation: string; description: string; createdAt: string }> },
): Promise<void> {
  const dir = path.join(memoryDir, type);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, `${changeName}-${record.id.toLowerCase()}.yaml`),
    [
      'id: ' + record.id,
      'type: ' + type,
      'title: ' + record.title,
      'timestamp: 2026-06-01T00:00:00.000Z',
      'changeName: ' + changeName,
      'source: test',
      'content: test content',
      'tags: []',
    ]
      .concat(
        record.links && record.links.length > 0
          ? ['links:', ...record.links.map((l) => `  - target: ${l.target}\n    relation: ${l.relation}\n    description: ${l.description}\n    createdAt: ${l.createdAt}`)]
          : [],
      )
      .join('\n'),
    'utf-8',
  );
}

describe('evidence-audit', () => {
  let tmp: string;
  let ivyDir: string;
  let memoryDir: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
    ivyDir = path.join(tmp, '.ivy');
    memoryDir = path.join(ivyDir, 'memory');
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  // TC-1: Full coverage — all decisions have evidence links
  it('reports 100% coverage when all decisions have evidence', async () => {
    await writeMemoryRecord(memoryDir, 'decision', 'change-a', {
      id: 'ADR-001', title: 'Use TypeScript',
      links: [{ target: 'EVI-001', relation: 'evidences', description: 'covered by test', createdAt: '2026-06-01' }],
    });
    await writeMemoryRecord(memoryDir, 'evidence', 'change-a', {
      id: 'EVI-001', title: 'TypeScript compile tests pass',
    });

    const result = await auditEvidence(ivyDir, 'change-a');
    expect(result.coverage).toBe(100);
    expect(result.totalDecisions).toBe(1);
    expect(result.decisionsWithEvidence).toBe(1);
    expect(result.orphanedDecisions).toHaveLength(0);
    expect(result.orphanedEvidence).toHaveLength(0);
  });

  // TC-2: Partial coverage — some decisions lack evidence
  it('reports orphaned decisions when some lack evidence links', async () => {
    await writeMemoryRecord(memoryDir, 'decision', 'change-a', {
      id: 'ADR-001', title: 'Use TypeScript',
      links: [{ target: 'EVI-001', relation: 'evidences', description: 'covered', createdAt: '2026-06-01' }],
    });
    await writeMemoryRecord(memoryDir, 'decision', 'change-a', {
      id: 'ADR-002', title: 'Use React',
    });
    await writeMemoryRecord(memoryDir, 'evidence', 'change-a', { id: 'EVI-001', title: 'TypeScript test' });

    const result = await auditEvidence(ivyDir, 'change-a');
    expect(result.coverage).toBe(50);
    expect(result.decisionsWithEvidence).toBe(1);
    expect(result.totalDecisions).toBe(2);
    expect(result.orphanedDecisions).toHaveLength(1);
    expect(result.orphanedDecisions[0].recordId).toBe('ADR-002');
  });

  // TC-3: Orphaned evidence — evidence not linked to any decision
  it('reports orphaned evidence records', async () => {
    await writeMemoryRecord(memoryDir, 'decision', 'change-a', {
      id: 'ADR-001', title: 'Use TypeScript',
    });
    await writeMemoryRecord(memoryDir, 'evidence', 'change-a', { id: 'EVI-001', title: 'Orphan evidence' });

    const result = await auditEvidence(ivyDir, 'change-a');
    expect(result.orphanedEvidence).toHaveLength(1);
    expect(result.orphanedEvidence[0].recordId).toBe('EVI-001');
    expect(result.coverage).toBe(0);
  });

  // TC-4: Empty memory dir — no records
  it('handles empty memory directory', async () => {
    const result = await auditEvidence(ivyDir, 'change-a');
    expect(result.coverage).toBe(0);
    expect(result.totalDecisions).toBe(0);
    expect(result.gapCategories).toHaveLength(1);
    expect(result.gapCategories[0].name).toBe('No records found');
  });

  // TC-5: Change with no decisions — skipped
  it('handles change with no decision records', async () => {
    await writeMemoryRecord(memoryDir, 'evidence', 'change-a', { id: 'EVI-001', title: 'test' });
    await writeMemoryRecord(memoryDir, 'fact', 'change-a', { id: 'FAC-001', title: 'test fact' });

    const result = await auditEvidence(ivyDir, 'change-a');
    expect(result.totalDecisions).toBe(0);
    expect(result.coverage).toBe(100); // no decisions = 100% by convention
  });

  // TC-6: Format text output
  it('formats text output correctly', () => {
    const result = {
      changeName: 'change-a',
      coverage: 75,
      totalDecisions: 4,
      decisionsWithEvidence: 3,
      orphanedDecisions: [{ type: 'orphaned_decision' as const, recordId: 'ADR-002', recordTitle: 'Use React', changeName: 'change-a' }],
      orphanedEvidence: [],
      gapCategories: [{ name: 'Orphaned Decisions', count: 1, items: ['ADR-002: Use React'] }],
    };
    const text = formatAuditText(result);
    expect(text).toContain('Coverage: 75%');
    expect(text).toContain('Orphaned Decisions');
    expect(text).toContain('ADR-002: Use React');
  });

  // TC-7: Format JSON output
  it('formats JSON output correctly', () => {
    const result = {
      changeName: 'change-a',
      coverage: 100,
      totalDecisions: 1,
      decisionsWithEvidence: 1,
      orphanedDecisions: [],
      orphanedEvidence: [],
      gapCategories: [],
    };
    const json = JSON.parse(formatAuditJson(result));
    expect(json.coverage).toBe(100);
    expect(json.changeName).toBe('change-a');
    expect(json.orphanedDecisions).toHaveLength(0);
  });
});

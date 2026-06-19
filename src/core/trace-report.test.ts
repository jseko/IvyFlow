import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import { traceRecords, estimateImpact, formatTraceText, formatTraceJson } from './trace-report.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'trace-report-'));
}

async function writeRecord(
  memoryDir: string,
  type: string,
  recordId: string,
  title: string,
  links?: Array<{ target: string; relation: string; description: string; createdAt: string }>,
): Promise<void> {
  const dir = path.join(memoryDir, type);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, `${recordId.toLowerCase()}.yaml`),
    [
      'id: ' + recordId,
      'type: ' + type,
      'title: ' + title,
      'timestamp: 2026-06-01T00:00:00.000Z',
      'changeName: change-a',
      'source: test',
      'content: test',
      'tags: []',
    ]
      .concat(
        links && links.length > 0
          ? ['links:', ...links.map((l) => `  - target: ${l.target}\n    relation: ${l.relation}\n    description: ${l.description}\n    createdAt: ${l.createdAt}`)]
          : [],
      )
      .join('\n'),
    'utf-8',
  );
}

describe('trace-report', () => {
  let tmp: string;
  let memoryDir: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
    memoryDir = path.join(tmp, '.ivy', 'memory');
    await fs.mkdir(memoryDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  // TC-8: Forward trace evidence→decision→constraint
  it('traces forward from evidence through decision to constraint', async () => {
    await writeRecord(memoryDir, 'evidence', 'EVI-001', 'Test evidence');
    await writeRecord(memoryDir, 'decision', 'ADR-001', 'Use TypeScript', [
      { target: 'CON-001', relation: 'influences', description: '', createdAt: '2026-06-01' },
    ]);
    await writeRecord(memoryDir, 'constraint', 'CON-001', 'Must use TS', undefined);

    // Link EVI-001 → ADR-001
    await writeRecord(memoryDir, 'evidence', 'EVI-001', 'Test evidence', [
      { target: 'ADR-001', relation: 'evidences', description: '', createdAt: '2026-06-01' },
    ]);

    const result = await traceRecords(memoryDir, 'EVI-001', 'forward');
    expect(result.complete).toBe(true);
    expect(result.path).toHaveLength(3); // evidence + decision + constraint
    expect(result.path[1].recordId).toBe('ADR-001');
    expect(result.path[2].recordId).toBe('CON-001');
  });

  // TC-9: Depth capped at 5
  it('reports max depth reached at 5', async () => {
    // Create a chain: FAC-001→FAC-002→FAC-003→FAC-004→FAC-005→FAC-006→FAC-007 (6 hops)
    for (let i = 1; i <= 7; i++) {
      const id = `FAC-${String(i).padStart(3, '0')}`;
      const nextId = i < 7 ? `FAC-${String(i + 1).padStart(3, '0')}` : undefined;
      const links = nextId
        ? [{ target: nextId, relation: 'precedes' as const, description: '', createdAt: '2026-06-01' }]
        : undefined;
      await writeRecord(memoryDir, 'fact', id, `Step ${i}`, links);
    }

    const result = await traceRecords(memoryDir, 'FAC-001', 'forward');
    expect(result.maxDepthReached).toBe(true);
    // Start at depth 0, max depth 5 — so max 6 nodes (0-5)
    expect(result.path.length).toBeLessThanOrEqual(6);
  });

  // TC-10: Dead end — no outgoing links
  it('stops at dead end with one node', async () => {
    await writeRecord(memoryDir, 'decision', 'ADR-001', 'Standalone decision');
    const result = await traceRecords(memoryDir, 'ADR-001', 'forward');
    expect(result.complete).toBe(true);
    expect(result.path).toHaveLength(1);
  });

  // TC-11: Record not found
  it('reports record not found', async () => {
    const result = await traceRecords(memoryDir, 'NONEXIST', 'forward');
    expect(result.complete).toBe(false);
    expect(result.path).toHaveLength(0);
  });

  // TC-12: Backward trace
  it('traces backward from constraint to decision', async () => {
    await writeRecord(memoryDir, 'decision', 'ADR-001', 'Use TypeScript', [
      { target: 'CON-001', relation: 'influences', description: '', createdAt: '2026-06-01' },
    ]);
    await writeRecord(memoryDir, 'constraint', 'CON-001', 'Must use TS');

    const result = await traceRecords(memoryDir, 'CON-001', 'backward');
    expect(result.direction).toBe('backward');
    expect(result.path.length).toBeGreaterThanOrEqual(2);
    // The start node (CON-001) has depth 0, then backward step (ADR-001) has depth 1
    const backwardStep = result.path.find((s) => s.depth === 1);
    expect(backwardStep?.recordId).toBe('ADR-001');
    expect(backwardStep?.type).toBe('decision');
  });

  // TC-13: Text output format
  it('formats text output correctly', () => {
    const result = {
      startId: 'EVI-001',
      direction: 'forward' as const,
      complete: true,
      maxDepthReached: false,
      path: [
        { recordId: 'EVI-001', type: 'evidence', title: 'Test', relation: 'start', depth: 0 },
        { recordId: 'ADR-001', type: 'decision', title: 'Use TS', relation: 'evidences', depth: 1 },
      ],
    };
    const text = formatTraceText(result);
    expect(text).toContain('Trace: EVI-001');
    expect(text).toContain('[decision] ADR-001');
    expect(text).toContain('relation: evidences');
  });

  // TC-14: JSON output format
  it('formats JSON output correctly', () => {
    const result = {
      startId: 'EVI-001',
      direction: 'forward' as const,
      complete: true,
      maxDepthReached: false,
      path: [
        { recordId: 'EVI-001', type: 'evidence', title: 'Test', relation: 'start', depth: 0 },
      ],
    };
    const json = JSON.parse(formatTraceJson(result));
    expect(json.startId).toBe('EVI-001');
    expect(json.direction).toBe('forward');
    expect(json.path).toHaveLength(1);
  });

  // TC-15: Trace Impact (Experimental) — estimate
  it('estimates impact from constraint change', async () => {
    // Create: decision influences constraint, and decision evidences evidence
    await writeRecord(memoryDir, 'decision', 'ADR-001', 'Use TypeScript', [
      { target: 'CON-001', relation: 'influences', description: '', createdAt: '2026-06-01' },
      { target: 'EVI-001', relation: 'evidences', description: '', createdAt: '2026-06-01' },
    ]);
    await writeRecord(memoryDir, 'constraint', 'CON-001', 'Must use TS');
    await writeRecord(memoryDir, 'evidence', 'EVI-001', 'Test evidence');

    const impact = await estimateImpact(memoryDir, 'CON-001');
    expect(impact.affectedDecisions).toContain('ADR-001');
    expect(impact.affectedEvidence).toContain('EVI-001');
    expect(impact.truncated).toBe(false);
  });

  // TC-16: Impact requires --impact flag (text output without impact)
  it('text output omits impact section when no impact provided', () => {
    const result = {
      startId: 'EVI-001',
      direction: 'forward' as const,
      complete: true,
      maxDepthReached: false,
      path: [{ recordId: 'EVI-001', type: 'evidence', title: 'Test', relation: 'start', depth: 0 }],
    };
    const text = formatTraceText(result);
    expect(text).not.toContain('Impact Estimate');
  });
});

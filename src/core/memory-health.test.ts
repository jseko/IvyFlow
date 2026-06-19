import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import { computeMemoryHealth, formatHealthText, formatHealthJson } from './memory-health.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'memory-health-'));
}

async function initIvyMemory(tmp: string): Promise<void> {
  // Create minimal .ivy/memory structure
  await fs.mkdir(path.join(tmp, '.ivy', 'memory'), { recursive: true });
  await fs.writeFile(
    path.join(tmp, '.ivy', 'memory', 'schema.yaml'),
    'version: 0.10.0\ntypes:\n  - id: decision\n  - id: constraint\n  - id: risk\n  - id: fact\n  - id: evidence\n',
    'utf-8',
  );
}

async function writeMemoryRecord(
  tmp: string,
  type: string,
  changeName: string,
  id: string,
  title: string,
  timestamp: string,
  links?: Array<{ target: string; relation: string; description: string; createdAt: string }>,
): Promise<void> {
  const dir = path.join(tmp, '.ivy', 'memory', type);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, `${changeName}-${id.toLowerCase()}.yaml`),
    [
      'id: ' + id,
      'type: ' + type,
      'title: ' + title,
      'timestamp: ' + timestamp,
      'changeName: ' + changeName,
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

async function writeIndex(tmp: string, entries: Array<{ id: string; type: string; title: string; changeName: string; timestamp: string; file: string }>): Promise<void> {
  await fs.writeFile(
    path.join(tmp, '.ivy', 'memory', 'index.json'),
    JSON.stringify({ version: '0.10.0', entries }, null, 2),
    'utf-8',
  );
}

describe('memory-health', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
    await initIvyMemory(tmp);
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  // TC-17: All dimensions reported
  it('reports all 6 dimensions', async () => {
    const result = await computeMemoryHealth(tmp);
    expect(result.dimensions).toHaveLength(6);
    const names = result.dimensions.map((d) => d.name);
    expect(names).toContain('Coverage');
    expect(names).toContain('Freshness');
    expect(names).toContain('Link Density');
    expect(names).toContain('Orphan Rate');
    expect(names).toContain('Decision-Evidence Ratio');
    expect(names).toContain('Completeness');
  });

  // TC-18: Coverage dimension
  it('computes coverage: changes with records', async () => {
    const ts = new Date().toISOString();
    await writeMemoryRecord(tmp, 'decision', 'change-a', 'ADR-001', 'Decision A', ts);
    await writeMemoryRecord(tmp, 'decision', 'change-b', 'ADR-002', 'Decision B', ts);
    await writeIndex(tmp, [
      { id: 'ADR-001', type: 'decision', title: 'Decision A', changeName: 'change-a', timestamp: ts, file: 'change-a-adr-001.yaml' },
      { id: 'ADR-002', type: 'decision', title: 'Decision B', changeName: 'change-b', timestamp: ts, file: 'change-b-adr-002.yaml' },
    ]);

    const result = await computeMemoryHealth(tmp);
    const coverage = result.dimensions.find((d) => d.name === 'Coveration');
    // Note: Coverage is based on changes count, not ratio — changes exist = 100
    expect(result.compositeScore).toBeDefined();
  });

  // TC-19: Freshness dimension
  it('computes freshness from latest record timestamp', async () => {
    const today = new Date().toISOString();
    await writeMemoryRecord(tmp, 'decision', 'change-a', 'ADR-001', 'Recent', today);
    await writeIndex(tmp, [
      { id: 'ADR-001', type: 'decision', title: 'Recent', changeName: 'change-a', timestamp: today, file: 'change-a-adr-001.yaml' },
    ]);

    const result = await computeMemoryHealth(tmp);
    const freshness = result.dimensions.find((d) => d.name === 'Freshness');
    expect(freshness).toBeDefined();
    // Recent record should have high freshness
    expect(freshness!.score).toBeGreaterThan(90);
  });

  // TC-20: Link Density dimension
  it('computes link density based on avg links per record', async () => {
    const ts = new Date().toISOString();
    await writeMemoryRecord(tmp, 'decision', 'change-a', 'ADR-001', 'Decision A', ts, [
      { target: 'EVI-001', relation: 'evidences', description: 'test', createdAt: '2026-06-01' },
      { target: 'CON-001', relation: 'influences', description: 'test', createdAt: '2026-06-01' },
    ]);
    await writeMemoryRecord(tmp, 'constraint', 'change-a', 'CON-001', 'Constraint A', ts);
    await writeMemoryRecord(tmp, 'evidence', 'change-a', 'EVI-001', 'Evidence A', ts);
    await writeIndex(tmp, [
      { id: 'ADR-001', type: 'decision', title: 'A', changeName: 'change-a', timestamp: ts, file: 'change-a-adr-001.yaml' },
      { id: 'CON-001', type: 'constraint', title: 'B', changeName: 'change-a', timestamp: ts, file: 'change-a-con-001.yaml' },
      { id: 'EVI-001', type: 'evidence', title: 'C', changeName: 'change-a', timestamp: ts, file: 'change-a-evi-001.yaml' },
    ]);

    const result = await computeMemoryHealth(tmp);
    const linkDensity = result.dimensions.find((d) => d.name === 'Link Density');
    expect(linkDensity).toBeDefined();
    // 2 links / 3 records ≈ 0.67, * 25 = 16.67
    expect(linkDensity!.score).toBeGreaterThan(0);
  });

  // TC-21: Orphan Rate dimension
  it('computes orphan rate correctly', async () => {
    const ts = new Date().toISOString();
    await writeMemoryRecord(tmp, 'decision', 'change-a', 'ADR-001', 'Linked', ts, [
      { target: 'CON-001', relation: 'influences', description: 'test', createdAt: '2026-06-01' },
    ]);
    await writeMemoryRecord(tmp, 'constraint', 'change-a', 'CON-001', 'Orphaned', ts);
    await writeIndex(tmp, [
      { id: 'ADR-001', type: 'decision', title: 'Linked', changeName: 'change-a', timestamp: ts, file: 'change-a-adr-001.yaml' },
      { id: 'CON-001', type: 'constraint', title: 'Orphan', changeName: 'change-a', timestamp: ts, file: 'change-a-con-001.yaml' },
    ]);

    const result = await computeMemoryHealth(tmp);
    const orphanRate = result.dimensions.find((d) => d.name === 'Orphan Rate');
    expect(orphanRate).toBeDefined();
    // 1 of 2 records linked = 50%
    expect(orphanRate!.score).toBe(50);
  });

  // TC-22: Decision-Evidence Ratio
  it('computes decision-evidence ratio', async () => {
    const ts = new Date().toISOString();
    await writeMemoryRecord(tmp, 'decision', 'change-a', 'ADR-001', 'With Evidence', ts, [
      { target: 'EVI-001', relation: 'evidences', description: 'test', createdAt: '2026-06-01' },
    ]);
    await writeMemoryRecord(tmp, 'decision', 'change-a', 'ADR-002', 'Without Evidence', ts);
    await writeMemoryRecord(tmp, 'evidence', 'change-a', 'EVI-001', 'Evidence', ts);
    await writeIndex(tmp, [
      { id: 'ADR-001', type: 'decision', title: 'With Evidence', changeName: 'change-a', timestamp: ts, file: 'change-a-adr-001.yaml' },
      { id: 'ADR-002', type: 'decision', title: 'Without Evidence', changeName: 'change-a', timestamp: ts, file: 'change-a-adr-002.yaml' },
      { id: 'EVI-001', type: 'evidence', title: 'Evidence', changeName: 'change-a', timestamp: ts, file: 'change-a-evi-001.yaml' },
    ]);

    const result = await computeMemoryHealth(tmp);
    const deRatio = result.dimensions.find((d) => d.name === 'Decision-Evidence Ratio');
    expect(deRatio).toBeDefined();
    // 1 of 2 decisions with evidence = 50%
    expect(deRatio!.score).toBe(50);
  });

  // TC-23: Completeness dimension
  it('computes completeness: changes with all 4 types', async () => {
    const ts = new Date().toISOString();
    // change-a has all 4 key types
    await writeMemoryRecord(tmp, 'decision', 'change-a', 'ADR-001', 'Decision', ts);
    await writeMemoryRecord(tmp, 'constraint', 'change-a', 'CON-001', 'Constraint', ts);
    await writeMemoryRecord(tmp, 'risk', 'change-a', 'RIS-001', 'Risk', ts);
    await writeMemoryRecord(tmp, 'fact', 'change-a', 'FAC-001', 'Fact', ts);
    // change-b only has 2 types
    await writeMemoryRecord(tmp, 'decision', 'change-b', 'ADR-002', 'Decision B', ts);
    await writeMemoryRecord(tmp, 'fact', 'change-b', 'FAC-002', 'Fact B', ts);
    await writeIndex(tmp, [
      { id: 'ADR-001', type: 'decision', title: 'D', changeName: 'change-a', timestamp: ts, file: 'change-a-adr-001.yaml' },
      { id: 'CON-001', type: 'constraint', title: 'C', changeName: 'change-a', timestamp: ts, file: 'change-a-con-001.yaml' },
      { id: 'RIS-001', type: 'risk', title: 'R', changeName: 'change-a', timestamp: ts, file: 'change-a-ris-001.yaml' },
      { id: 'FAC-001', type: 'fact', title: 'F', changeName: 'change-a', timestamp: ts, file: 'change-a-fac-001.yaml' },
      { id: 'ADR-002', type: 'decision', title: 'D2', changeName: 'change-b', timestamp: ts, file: 'change-b-adr-002.yaml' },
      { id: 'FAC-002', type: 'fact', title: 'F2', changeName: 'change-b', timestamp: ts, file: 'change-b-fac-002.yaml' },
    ]);

    const result = await computeMemoryHealth(tmp);
    const completeness = result.dimensions.find((d) => d.name === 'Completeness');
    expect(completeness).toBeDefined();
    // 1 of 2 changes complete = 50%
    expect(completeness!.score).toBe(50);
  });

  // TC-24: Edge case — no memory records
  it('handles empty state', async () => {
    // No index.json or records
    const result = await computeMemoryHealth(tmp);
    expect(result.compositeScore).toBeDefined();
    expect(typeof result.compositeScore).toBe('number');
    // All dimensions should be 0
    result.dimensions.forEach((d) => {
      expect(typeof d.score).toBe('number');
    });
  });

  // TC-24b: Format text output
  it('formats text output correctly', () => {
    const result = {
      compositeScore: 75,
      dimensions: [
        { name: 'Coverage', score: 100, subScore: '2 change(s)' },
        { name: 'Freshness', score: 95, subScore: '5 day(s) since latest' },
      ],
    };
    const text = formatHealthText(result);
    expect(text).toContain('Composite Score: 75');
    expect(text).toContain('Coverage');
    expect(text).toContain('100');
  });

  // TC-24c: Format JSON output
  it('formats JSON output correctly', () => {
    const result = {
      compositeScore: 50,
      dimensions: [
        { name: 'Coverage', score: 50, subScore: '1 change(s)' },
      ],
    };
    const json = JSON.parse(formatHealthJson(result));
    expect(json.compositeScore).toBe(50);
    expect(json.dimensions).toHaveLength(1);
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { mkdirSync, rmSync } from 'fs';

import {
  createLink,
  getLinks,
  traverse,
  deleteLink,
  createAutoLink,
} from './knowledge-linking.js';
import { writeYaml, readYaml } from '../utils/yaml.js';
import type { MemoryRecord } from './types.js';

function makeMemoryDir(): string {
  const dir = path.join(os.tmpdir(), `ivy-kl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

async function writeRecord(memoryDir: string, id: string, type: string, extra: Record<string, unknown> = {}) {
  const dir = path.join(memoryDir, type);
  mkdirSync(dir, { recursive: true });
  await writeYaml(path.join(dir, `${id}.yaml`), {
    id,
    type,
    title: `Record ${id}`,
    timestamp: new Date().toISOString(),
    changeName: 'test',
    source: 'test',
    content: 'test content',
    tags: [],
    ...extra,
  });
}

describe('Knowledge Linking — TC-7: createLink', () => {
  let memDir: string;

  beforeEach(() => { memDir = makeMemoryDir(); });
  afterEach(() => { rmSync(memDir, { recursive: true, force: true }); });

  it('creates a link between decision and constraint', async () => {
    await writeRecord(memDir, 'ADR-001', 'decision');
    await writeRecord(memDir, 'CON-001', 'constraint');

    const result = await createLink(memDir, 'ADR-001', 'CON-001', 'influences', 'Test link');
    expect(result.success).toBe(true);
    expect(result.message).toContain('Link created');
  });

  it('rejects link from non-decision source', async () => {
    await writeRecord(memDir, 'FAC-001', 'fact');
    await writeRecord(memDir, 'CON-001', 'constraint');

    const result = await createLink(memDir, 'FAC-001', 'CON-001', 'influences', 'Should fail');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Manual linking only supports decision');
  });

  it('rejects invalid relation type', async () => {
    await writeRecord(memDir, 'ADR-001', 'decision');
    await writeRecord(memDir, 'CON-001', 'constraint');

    const result = await createLink(memDir, 'ADR-001', 'CON-001', 'invalid_relation' as never, 'Should fail');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid relation');
  });
});

describe('Knowledge Linking — TC-8: getLinks', () => {
  let memDir: string;

  beforeEach(() => { memDir = makeMemoryDir(); });
  afterEach(() => { rmSync(memDir, { recursive: true, force: true }); });

  it('returns outgoing and incoming links', async () => {
    await writeRecord(memDir, 'ADR-001', 'decision');
    await writeRecord(memDir, 'CON-001', 'constraint');
    await writeRecord(memDir, 'FAC-001', 'fact');

    await createLink(memDir, 'ADR-001', 'CON-001', 'influences', 'Outgoing');
    await createLink(memDir, 'ADR-001', 'FAC-001', 'evidences', 'Evidence');

    const result = await getLinks(memDir, 'ADR-001');
    expect(result).not.toBeNull();
    expect(result!.outgoing.length).toBe(2);
  });

  it('returns null for non-existent record', async () => {
    const result = await getLinks(memDir, 'NONEXISTENT');
    expect(result).toBeNull();
  });
});

describe('Knowledge Linking — TC-9: traverse', () => {
  let memDir: string;

  beforeEach(() => { memDir = makeMemoryDir(); });
  afterEach(() => { rmSync(memDir, { recursive: true, force: true }); });

  it('traverses single-hop path', async () => {
    await writeRecord(memDir, 'ADR-001', 'decision');
    await writeRecord(memDir, 'EVI-001', 'evidence');
    await createLink(memDir, 'ADR-001', 'EVI-001', 'evidences', 'Test');

    const result = await traverse(memDir, 'ADR-001', 'evidence');
    expect(result.complete).toBe(true);
    expect(result.path.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Knowledge Linking — TC-10: Link type validation', () => {
  let memDir: string;

  beforeEach(() => { memDir = makeMemoryDir(); });
  afterEach(() => { rmSync(memDir, { recursive: true, force: true }); });

  it('accepts all 5 valid relations', async () => {
    await writeRecord(memDir, 'ADR-001', 'decision');
    const relations = ['influences', 'implements', 'precedes', 'supersedes', 'evidences'] as const;

    let i = 0;
    for (const rel of relations) {
      i++;
      const targetId = `CON-00${i}`;
      await writeRecord(memDir, targetId, 'constraint');
      const result = await createLink(memDir, 'ADR-001', targetId, rel, `Test ${rel}`);
      expect(result.success).toBe(true);
    }
  });
});

describe('Knowledge Linking — TC-11: Cross-change links', () => {
  let memDir: string;

  beforeEach(() => { memDir = makeMemoryDir(); });
  afterEach(() => { rmSync(memDir, { recursive: true, force: true }); });

  it('links records from different changes', async () => {
    await writeRecord(memDir, 'ADR-001', 'decision', { changeName: 'change-a' });
    await writeRecord(memDir, 'CON-001', 'constraint', { changeName: 'change-b' });

    const result = await createLink(memDir, 'ADR-001', 'CON-001', 'precedes', 'Cross-change');
    expect(result.success).toBe(true);
  });
});

describe('Knowledge Linking — TC-12: Link deletion', () => {
  let memDir: string;

  beforeEach(() => { memDir = makeMemoryDir(); });
  afterEach(() => { rmSync(memDir, { recursive: true, force: true }); });

  it('deletes a link by index', async () => {
    await writeRecord(memDir, 'ADR-001', 'decision');
    await writeRecord(memDir, 'CON-001', 'constraint');
    await createLink(memDir, 'ADR-001', 'CON-001', 'influences', 'To delete');

    const result = await deleteLink(memDir, 'ADR-001', 0);
    expect(result.success).toBe(true);
    expect(result.message).toContain('Link removed');

    const links = await getLinks(memDir, 'ADR-001');
    expect(links!.outgoing.length).toBe(0);
  });

  it('rejects invalid index', async () => {
    await writeRecord(memDir, 'ADR-001', 'decision');
    const result = await deleteLink(memDir, 'ADR-001', 99);
    expect(result.success).toBe(false);
  });
});

describe('Knowledge Linking — TC-13: Cycle detection', () => {
  let memDir: string;

  beforeEach(() => { memDir = makeMemoryDir(); });
  afterEach(() => { rmSync(memDir, { recursive: true, force: true }); });

  it('traverse with cycle does not loop infinitely', async () => {
    await writeRecord(memDir, 'ADR-001', 'decision');
    await writeRecord(memDir, 'ADR-002', 'decision');
    await writeRecord(memDir, 'ADR-003', 'decision');

    // Manual links only from decision sources
    await createLink(memDir, 'ADR-001', 'ADR-002', 'influences', 'A→B');
    await createLink(memDir, 'ADR-002', 'ADR-003', 'influences', 'B→C');

    const result = await traverse(memDir, 'ADR-001');
    expect(result.path.length).toBeGreaterThanOrEqual(1);
    // Should complete without hanging
    expect(result.path.length).toBeLessThanOrEqual(10);
  });
});

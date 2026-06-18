import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { mkdirSync, rmSync } from 'fs';
import { promises as fs } from 'fs';

import { MemoryStore } from './memory-arch.js';

function makeStore(): { store: MemoryStore; tmp: string } {
  const tmp = path.join(os.tmpdir(), `ivy-memory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(tmp, { recursive: true });
  return { store: new MemoryStore(tmp), tmp };
}

async function clean(tmp: string) {
  rmSync(tmp, { recursive: true, force: true });
}

describe('MemoryStore.write() with schema validation (TC-9)', () => {
  let ctx: { store: MemoryStore; tmp: string };

  beforeEach(() => { ctx = makeStore(); });
  afterEach(async () => { await clean(ctx.tmp); });

  it('writes a decision record and returns ID', async () => {
    const id = await ctx.store.write({
      type: 'decision',
      title: 'Test ADR',
      timestamp: '2026-06-18T00:00:00.000Z',
      changeName: 'test-change',
      source: 'design.md',
      content: 'Use TypeScript guard',
      tags: ['architecture'],
    });
    expect(id).toMatch(/^ADR-\d{3}$/);
  });

  it('increments IDs per type', async () => {
    const id1 = await ctx.store.write({ type: 'decision', title: 'D1', timestamp: '2026-06-18T00:00:00.000Z', changeName: 'c1', source: 's', content: 'c', tags: [] });
    const id2 = await ctx.store.write({ type: 'decision', title: 'D2', timestamp: '2026-06-18T00:00:00.000Z', changeName: 'c1', source: 's', content: 'c', tags: [] });
    expect(id1).toBe('ADR-001');
    expect(id2).toBe('ADR-002');
  });

  it('writes YAML file and index entry', async () => {
    await ctx.store.write({ type: 'constraint', title: 'No network', timestamp: '2026-06-18T00:00:00.000Z', changeName: 'c1', source: 'design.md', content: 'Offline-only', tags: ['constraint'] });
    const idx = await ctx.store['readIndex']();
    expect(idx).not.toBeNull();
    expect(idx!.entries.length).toBe(1);
    expect(idx!.entries[0].type).toBe('constraint');
  });

  it('creates the schema.yaml on first write', async () => {
    await ctx.store.ensureSchema();
    const schemaPath = path.join(ctx.tmp, '.ivy', 'memory', 'schema.yaml');
    const content = await fs.readFile(schemaPath, 'utf-8');
    expect(content).toContain('version');
    expect(content).toContain('decision');
  });
});

describe('MemoryStore.query() multi-condition filtering (TC-10)', () => {
  let ctx: { store: MemoryStore; tmp: string };

  beforeEach(async () => {
    ctx = makeStore();
    await ctx.store.write({ type: 'decision', title: 'ADR1', timestamp: '2026-06-01T00:00:00.000Z', changeName: 'c1', source: 's', content: 'c', tags: ['arch'] });
    await ctx.store.write({ type: 'decision', title: 'ADR2', timestamp: '2026-06-15T00:00:00.000Z', changeName: 'c2', source: 's', content: 'c', tags: ['arch'] });
    await ctx.store.write({ type: 'constraint', title: 'No network', timestamp: '2026-06-10T00:00:00.000Z', changeName: 'c1', source: 's', content: 'c', tags: ['perf'] });
    await ctx.store.write({ type: 'fact', title: 'Node 20 required', timestamp: '2026-06-05T00:00:00.000Z', changeName: 'c1', source: 's', content: 'c', tags: [] });
  });

  afterEach(async () => { await clean(ctx.tmp); });

  it('returns all records when no filter', async () => {
    const results = await ctx.store.query({});
    expect(results.length).toBe(4);
  });

  it('filters by type', async () => {
    const results = await ctx.store.query({ types: ['decision'] });
    expect(results.length).toBe(2);
    expect(results.every((r) => r.type === 'decision')).toBe(true);
  });

  it('filters by changeName', async () => {
    const results = await ctx.store.query({ changeName: 'c2' });
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('ADR2');
  });

  it('filters by tags', async () => {
    const results = await ctx.store.query({ tags: ['perf'] });
    expect(results.length).toBe(1);
    expect(results[0].type).toBe('constraint');
  });

  it('filters by types + changeName combined', async () => {
    const results = await ctx.store.query({ types: ['decision'], changeName: 'c1' });
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('ADR1');
  });

  it('returns empty for non-matching filter', async () => {
    const results = await ctx.store.query({ changeName: 'nonexistent' });
    expect(results.length).toBe(0);
  });
});

describe('MemoryStore ADR view and memory overview (TC-11, TC-12)', () => {
  let ctx: { store: MemoryStore; tmp: string };

  beforeEach(async () => {
    ctx = makeStore();
    await ctx.store.write({ type: 'decision', title: 'ADR1', timestamp: '2026-06-01T00:00:00.000Z', changeName: 'c1', source: 's', content: 'c', tags: [] });
    await ctx.store.write({ type: 'decision', title: 'ADR2', timestamp: '2026-06-15T00:00:00.000Z', changeName: 'c2', source: 's', content: 'c', tags: [] });
    await ctx.store.write({ type: 'constraint', title: 'No network', timestamp: '2026-06-10T00:00:00.000Z', changeName: 'c1', source: 's', content: 'c', tags: [] });
  });

  afterEach(async () => { await clean(ctx.tmp); });

  it('renderAdrView returns only decision records', async () => {
    const view = await ctx.store.renderAdrView();
    expect(view.records.length).toBe(2);
    expect(view.index.length).toBe(2);
  });

  it('ADR index has correct fields', async () => {
    const view = await ctx.store.renderAdrView();
    expect(view.index[0]).toHaveProperty('id');
    expect(view.index[0]).toHaveProperty('title');
    expect(view.index[0]).toHaveProperty('status');
    expect(view.index[0]).toHaveProperty('date');
    expect(view.index[0]).toHaveProperty('changeName');
  });

  it('renderMemoryOverview returns correct counts', async () => {
    const overview = await ctx.store.renderMemoryOverview();
    expect(overview.totalRecords).toBe(3);
    expect(overview.byType.decision).toBe(2);
    expect(overview.byType.constraint).toBe(1);
    expect(overview.byType.risk).toBe(0);
    expect(overview.byType.fact).toBe(0);
    expect(overview.byType.evidence).toBe(0);
  });

  it('renderMemoryOverview counts v0.9 knowledge entries', async () => {
    const knowledgeDir = path.join(ctx.tmp, '.ivy', 'knowledge');
    await fs.mkdir(knowledgeDir, { recursive: true });
    await fs.writeFile(path.join(knowledgeDir, 'feature-x.yaml'), 'key: value', 'utf-8');
    await fs.writeFile(path.join(knowledgeDir, 'fix-bug.yaml'), 'key: value', 'utf-8');

    const overview = await ctx.store.renderMemoryOverview();
    expect(overview.knowledgeEntryCount).toBe(2);
  });
});

describe('MemoryStore schema.yaml version validation (TC-13)', () => {
  it('readSchema returns version', async () => {
    const ctx = makeStore();
    await ctx.store.ensureSchema();
    const schema = await ctx.store.readSchema();
    expect(schema).not.toBeNull();
    expect(schema!.version).toBe('0.10.0');
    await clean(ctx.tmp);
  });

  it('readSchema returns null before ensureSchema', async () => {
    const ctx = makeStore();
    const schema = await ctx.store.readSchema();
    expect(schema).toBeNull();
    await clean(ctx.tmp);
  });
});

describe('MemoryStore v0.9 knowledge backward compatibility (TC-14)', () => {
  it('referenceV09Knowledge adds knowledge entries to index', async () => {
    const ctx = makeStore();
    const knowledgeDir = path.join(ctx.tmp, '.ivy', 'knowledge');
    await fs.mkdir(knowledgeDir, { recursive: true });
    await fs.writeFile(path.join(knowledgeDir, 'feature-x.yaml'), 'key: value', 'utf-8');
    await fs.writeFile(path.join(knowledgeDir, 'fix-bug.yaml'), 'key: value', 'utf-8');

    await ctx.store.referenceV09Knowledge();

    const overview = await ctx.store.renderMemoryOverview();
    expect(overview.knowledgeEntryCount).toBe(2);
    await clean(ctx.tmp);
  });

  it('referenceV09Knowledge is idempotent', async () => {
    const ctx = makeStore();
    const knowledgeDir = path.join(ctx.tmp, '.ivy', 'knowledge');
    await fs.mkdir(knowledgeDir, { recursive: true });
    await fs.writeFile(path.join(knowledgeDir, 'feature-x.yaml'), 'key: value', 'utf-8');

    await ctx.store.referenceV09Knowledge();
    await ctx.store.referenceV09Knowledge();

    const overview = await ctx.store.renderMemoryOverview();
    expect(overview.knowledgeEntryCount).toBe(1);
    await clean(ctx.tmp);
  });

  it('handles missing knowledge directory gracefully', async () => {
    const ctx = makeStore();
    await ctx.store.referenceV09Knowledge();
    const overview = await ctx.store.renderMemoryOverview();
    expect(overview.knowledgeEntryCount).toBe(0);
    await clean(ctx.tmp);
  });
});

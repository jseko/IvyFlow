/**
 * v0.29: Real CouncilEngine — proves G2 (wired to real memory, not stub).
 * Seeds a temp project's MemoryStore and asserts per-perspective analysis
 * yields sufficient/single_source statuses with real concerns.
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CouncilEngine, listPerspectives } from './council-engine.js';
import { MemoryStore } from './memory-arch.js';

function seedProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ivy-council-'));
  const store = new MemoryStore(dir);
  // ensureSchema is called inside CouncilEngine.ask too, but write needs it.
  // store.write triggers ensureSchema internally? No — call it explicitly.
  // (store.write does not ensureSchema, so call it first.)
  // Use a minimal manual seed instead to avoid relying on write internals.
  return dir;
}

describe('CouncilEngine (G2: real memory-backed)', () => {
  it('should produce non-degraded perspectives from seeded memory', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ivy-council-'));
    try {
      const store = new MemoryStore(dir);
      await store.ensureSchema();
      await store.referenceV09Knowledge();

      // Seed decision + constraint (architecture/cost) and a risk record.
      await store.write({
        type: 'decision',
        title: 'Adopt React 18',
        timestamp: '2025-01-01T00:00:00.000Z',
        changeName: 'v1',
        source: 'manual',
        content: 'Upgrade the UI layer to React 18 for concurrent features.',
        tags: ['react', 'frontend'],
      });
      await store.write({
        type: 'constraint',
        title: 'Node 18 required',
        timestamp: '2025-01-02T00:00:00.000Z',
        changeName: 'v1',
        source: 'manual',
        content: 'Deployment requires Node 18 runtime.',
        tags: ['infra'],
      });
      await store.write({
        type: 'risk',
        title: 'Migration regression risk',
        timestamp: '2025-01-03T00:00:00.000Z',
        changeName: 'v1',
        source: 'manual',
        content: 'React 18 upgrade may break class components.',
        tags: ['risk'],
      });

      const report = await new CouncilEngine(dir).ask('react upgrade node');

      expect(report.memoryCount).toBe(3);
      expect(report.recallCount).toBeGreaterThan(0);

      // architecture fed by decision+constraint → sufficient (>=2 concerns)
      expect(report.perspectives.architecture.status).toBe('sufficient');
      expect(report.perspectives.architecture.concerns?.length).toBeGreaterThanOrEqual(2);

      // risk fed by 1 risk record → single_source
      expect(report.perspectives.risk.status).toBe('single_source');
      expect(report.perspectives.risk.concerns?.length).toBe(1);

      // quality has no evidence/fact → insufficient_memory
      expect(report.perspectives.quality.status).toBe('insufficient_memory');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should degrade all perspectives for an empty project', async () => {
    const dir = seedProject();
    try {
      const report = await new CouncilEngine(dir).ask('anything');
      expect(report.memoryCount).toBe(0);
      for (const pid of ['architecture', 'risk', 'quality', 'cost']) {
        expect(report.perspectives[pid].status).toBe('insufficient_memory');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should expose 4 perspectives via listPerspectives', () => {
    const list = listPerspectives();
    expect(list.map((p) => p.id)).toEqual(['architecture', 'risk', 'quality', 'cost']);
  });
});

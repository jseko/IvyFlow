import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { mkdirSync, rmSync } from 'fs';
import { promises as fs } from 'fs';

import { buildExportPayload } from './export-api.js';
import { writeYaml } from '../utils/yaml.js';

function makeProjectDir(): string {
  const dir = path.join(os.tmpdir(), `ivy-export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

async function writeFile(dir: string, relPath: string, content: string) {
  const p = path.join(dir, relPath);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, 'utf-8');
}

async function clean(dir: string) {
  rmSync(dir, { recursive: true, force: true });
}

describe('ExportPayload JSON output format (TC-11)', () => {
  let tmp: string;

  beforeEach(async () => { tmp = makeProjectDir(); });
  afterEach(async () => { await clean(tmp); });

  it('buildExportPayload returns valid ExportPayload structure', async () => {
    const projectYaml: Record<string, unknown> = {
      version: '0.10.0',
      scope: 'change',
      platforms: ['claude'],
      analytics_enabled: true,
    };
    await writeYaml(path.join(tmp, '.ivy', 'project.yaml'), projectYaml);

    const payload = await buildExportPayload({ cwd: tmp });
    expect(payload).toHaveProperty('version', '0.11.0');
    expect(payload).toHaveProperty('exportedAt');
    expect(payload).toHaveProperty('project');
    expect(payload).toHaveProperty('changes');
    expect(payload).toHaveProperty('metrics');
    expect(payload).toHaveProperty('knowledge');
    expect(payload).toHaveProperty('errors');
    expect(Array.isArray(payload.changes)).toBe(true);
    expect(Array.isArray(payload.metrics)).toBe(true);
    expect(Array.isArray(payload.knowledge)).toBe(true);
  });

  it('includes raw event count in metrics when events.jsonl exists', async () => {
    await writeYaml(path.join(tmp, '.ivy', 'project.yaml'), { version: '0.10.0', scope: 'change' });
    const events = [
      JSON.stringify({ event: 'phase_transition', timestamp: '2026-06-01T00:00:00.000Z', phase: 'open' }),
      JSON.stringify({ event: 'phase_transition', timestamp: '2026-06-02T00:00:00.000Z', phase: 'build' }),
    ];
    await writeFile(tmp, '.ivy/sessions/raw/events.jsonl', events.join('\n'));

    const payload = await buildExportPayload({ cwd: tmp });
    expect(payload.metrics.length).toBeGreaterThan(0);
    const rawEventsMetric = payload.metrics.find((m) => m.metric === 'raw_events');
    expect(rawEventsMetric).toBeDefined();
    expect(rawEventsMetric!.value).toBe(2);
  });

  it('includes knowledge records from MemoryStore', async () => {
    await writeYaml(path.join(tmp, '.ivy', 'project.yaml'), { version: '0.10.0', scope: 'change' });

    const payload = await buildExportPayload({ cwd: tmp, dimension: 'knowledge' });
    expect(payload.knowledge).toBeDefined();
    expect(Array.isArray(payload.knowledge)).toBe(true);
  });
});

describe('Export API — empty project degradation (TC-12)', () => {
  it('handles missing .ivy directory gracefully', async () => {
    const emptyDir = makeProjectDir();
    const payload = await buildExportPayload({ cwd: emptyDir });
    // Should still return valid payload, no crash
    expect(payload.changes).toEqual([]);
    expect(payload.errors).toEqual([]);
    await clean(emptyDir);
  });
});

describe('Export API — --pipe output format (TC-13)', () => {
  it('serializes to valid JSON', async () => {
    const tmp2 = makeProjectDir();
    // Minimal project.yaml
    await writeYaml(path.join(tmp2, '.ivy', 'project.yaml'), { version: '0.10.0', scope: 'change' });

    const payload = await buildExportPayload({ cwd: tmp2 });
    const json = JSON.stringify(payload);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe('0.11.0');
    expect(parsed.exportedAt).toBeDefined();
    await clean(tmp2);
  });
});

describe('Export API — read-only guarantee (TC-14)', () => {
  it('never modifies existing .ivy/ project.yaml', async () => {
    const tmp2 = makeProjectDir();
    const ivyDir = path.join(tmp2, '.ivy');
    const projectYaml: Record<string, unknown> = { version: '0.10.0', scope: 'change', test_field: 'original' };
    await writeYaml(path.join(ivyDir, 'project.yaml'), projectYaml);

    await buildExportPayload({ cwd: tmp2 });

    // Reread project.yaml — should be unchanged
    const { readYaml } = await import('../utils/yaml.js');
    const after = await readYaml<Record<string, unknown>>(path.join(ivyDir, 'project.yaml'));
    expect(after!.test_field).toBe('original');
    expect(after!.version).toBe('0.10.0');
    await clean(tmp2);
  });
});

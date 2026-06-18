import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';

import { writeYaml, readYaml } from '../utils/yaml.js';

// ─── v0.8 → v0.9 Backward Compatibility (Task 4.4) ───

describe('v0.8 project.yaml backward compatibility', () => {
  let tmp: string;
  let ivyDir: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-bc-'));
    ivyDir = path.join(tmp, '.ivy');
    await fs.mkdir(ivyDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('reads v0.8-style project.yaml without v0.9 sections', async () => {
    // Write project.yaml without project_knowledge, quality_gates, fingerprint
    await writeYaml(path.join(ivyDir, 'project.yaml'), {
      version: '0.8.0',
      platforms: ['claude'],
      scope: 'project',
      changes: [{ name: 'my-change', phase: 'design' }],
    });

    const data = await readYaml(path.join(ivyDir, 'project.yaml'));
    expect(data?.version).toBe('0.8.0');
    // v0.9 fields should be absent (not crash)
    expect(data).not.toHaveProperty('project_knowledge');
    expect(data).not.toHaveProperty('quality_gates');
    expect(data).not.toHaveProperty('fingerprint');
  });

  it('v0.9 verify command works with v0.8 config (missing quality_gates)', async () => {
    await writeYaml(path.join(ivyDir, 'project.yaml'), {
      version: '0.8.0',
      platforms: ['claude'],
      scope: 'project',
    });

    // Must not throw — quality_gates defaults to empty object
    const { runVerify } = await import('./verify.js');
    const code = await runVerify({ cwd: tmp, change: 'nonexistent', gate: 'compile' });
    expect(code).toBe(0);
  });

  it('v0.9 fingerprint command works with v0.8 config', async () => {
    await writeYaml(path.join(ivyDir, 'project.yaml'), {
      version: '0.8.0',
      platforms: ['claude'],
      scope: 'project',
    });

    const { runFingerprint } = await import('./fingerprint.js');
    const code = await runFingerprint({ cwd: tmp, json: true });
    expect(code).toBe(0);
  });

  it('v0.9 release command handles v0.8-style change entries', async () => {
    await writeYaml(path.join(ivyDir, 'project.yaml'), {
      version: '0.8.0',
      changes: [{ name: 'feat-x', phase: 'archive' }],
    });

    const { runRelease } = await import('./release.js');
    const code = await runRelease({ cwd: tmp, change: 'feat-x' });
    expect(code).toBe(0);
  });

  it('doctor does not crash with v0.8 project.yaml', async () => {
    await writeYaml(path.join(ivyDir, 'project.yaml'), {
      version: '0.8.0',
      platforms: ['claude'],
      scope: 'project',
    });

    const { runDoctor } = await import('./doctor.js');
    // Should handle gracefully even without an initialized project
    const code = await runDoctor({ cwd: tmp, platforms: true });
    expect(code).toBe(0);
  });
});

// ─── Data Model Stability: Add-Only (Task 4.5) ───

describe('Data Model Stability — add-only field validation', () => {
  let tmp: string;
  let ivyDir: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-dms-'));
    ivyDir = path.join(tmp, '.ivy');
    await fs.mkdir(ivyDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('reads YAML with extra unknown fields (forward compat)', async () => {
    // Simulate a newer version writing extra fields
    await writeYaml(path.join(ivyDir, 'data.yaml'), {
      entries: [
        { type: 'decision', key: 'use-ts', value: 'Use TypeScript' },
      ],
      _v1_0_extra_field: 'future-compat',
      _v1_1_metadata: { author: 'test' },
    });

    // Must parse without error, preserving unknown fields
    const data = await readYaml<Record<string, unknown>>(path.join(ivyDir, 'data.yaml'));
    expect(data).not.toBeNull();
    expect(data?._v1_0_extra_field).toBe('future-compat');
    expect(data?._v1_1_metadata).toEqual({ author: 'test' });
  });

  it('evidence YAML with extra gates does not break parsing', async () => {
    // Evidence report with unknown future gate fields
    await writeYaml(path.join(ivyDir, 'evidence', 'feat-x.yaml'), {
      changeName: 'feat-x',
      results: [
        { gate: 'compile', passed: true, skipped: false, output: 'OK', durationMs: 100 },
      ],
      passedCount: 1,
      failedCount: 0,
      skippedCount: 0,
      overall: 'passed',
      timestamp: new Date().toISOString(),
      writtenTo: '.ivy/evidence/feat-x.yaml',
    });

    const data = await readYaml<Record<string, unknown>>(path.join(ivyDir, 'evidence', 'feat-x.yaml'));
    expect(data?.changeName).toBe('feat-x');
    expect(data?.overall).toBe('passed');
  });

  it('fingerprint YAML with extra fields does not break parsing', async () => {
    await writeYaml(path.join(ivyDir, 'fingerprint.yaml'), {
      projectType: { value: 'fullstack', confidence: 0.8, matchedFiles: ['package.json'] },
      detectedAt: new Date().toISOString(),
      _future_field: { some: 'data' },
    });

    const data = await readYaml<Record<string, unknown>>(path.join(ivyDir, 'fingerprint.yaml'));
    expect(data?.projectType).toBeDefined();
    expect(data?._future_field).toEqual({ some: 'data' });
  });

  it('knowledge YAML with extra types does not break parsing', async () => {
    await writeYaml(path.join(ivyDir, 'knowledge', 'feat-x.yaml'), {
      decisions: [{ id: 'DEC-001', title: 'Use TS', description: '', date: '2026-06-18', source: 'design.md', status: 'accepted' }],
      constraints: [],
      risks: [],
      facts: [],
      _extended_types: ['recommendation', 'summary'],
    });

    const data = await readYaml<Record<string, unknown>>(path.join(ivyDir, 'knowledge', 'feat-x.yaml'));
    expect(data?.decisions).toHaveLength(1);
    expect(data?._extended_types).toEqual(['recommendation', 'summary']);
  });

  it('memory YAML with extra metadata fields does not break parsing', async () => {
    await writeYaml(path.join(ivyDir, 'memory', 'feat-x', 'knowledge-summary.yaml'), {
      changeName: 'feat-x',
      archiveDate: new Date().toISOString(),
      counts: { decision: 1, constraint: 0, risk: 0, fact: 0 },
      memoryDir: '.ivy/memory/feat-x',
      _v1_links: [{ from: 'use-ts', to: 'arch-decision-001', relation: 'implements' }],
    });

    const data = await readYaml<Record<string, unknown>>(path.join(ivyDir, 'memory', 'feat-x', 'knowledge-summary.yaml'));
    expect(data?.changeName).toBe('feat-x');
    expect(data?._v1_links).toHaveLength(1);
  });
});

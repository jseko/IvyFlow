import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';

import { runVerify } from './verify.js';

describe('runVerify', () => {
  let tmp: string;
  let ivyDir: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-verify-'));
    ivyDir = path.join(tmp, '.ivy');
    await fs.mkdir(ivyDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('requires --change argument', async () => {
    const code = await runVerify({ cwd: tmp });
    expect(code).toBe(1);
  });

  it('taskCheck gate passes when all tasks are done', async () => {
    const changeDir = path.join(tmp, 'openspec', 'changes', 'my-feat');
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(path.join(changeDir, 'tasks.md'), [
      '- [x] Task 1',
      '- [x] Task 2',
      '',
    ].join('\n'));

    await fs.writeFile(path.join(ivyDir, 'project.yaml'), JSON.stringify({
      quality_gates: { task_check: true },
    }));

    const code = await runVerify({ cwd: tmp, change: 'my-feat', gate: 'tasks' });
    expect(code).toBe(0);
  });

  it('taskCheck gate fails when tasks are incomplete', async () => {
    const changeDir = path.join(tmp, 'openspec', 'changes', 'my-feat');
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(path.join(changeDir, 'tasks.md'), [
      '- [x] Task 1',
      '- [ ] Task 2',
      '- [ ] Task 3',
      '',
    ].join('\n'));

    await fs.writeFile(path.join(ivyDir, 'project.yaml'), JSON.stringify({
      quality_gates: { task_check: true },
    }));

    const code = await runVerify({ cwd: tmp, change: 'my-feat', gate: 'tasks' });
    expect(code).toBe(1);
  });

  it('taskCheck skips when no tasks.md exists', async () => {
    await fs.writeFile(path.join(ivyDir, 'project.yaml'), JSON.stringify({
      quality_gates: { task_check: true },
    }));

    const code = await runVerify({ cwd: tmp, change: 'nonexistent', gate: 'tasks' });
    expect(code).toBe(0);
  });

  it('writes evidence report to .ivy/evidence/', async () => {
    const changeDir = path.join(tmp, 'openspec', 'changes', 'my-feat');
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(path.join(changeDir, 'tasks.md'), '- [x] Task 1\n');

    await fs.writeFile(path.join(ivyDir, 'project.yaml'), JSON.stringify({
      quality_gates: { task_check: true },
    }));

    await runVerify({ cwd: tmp, change: 'my-feat', gate: 'tasks' });

    const evidencePath = path.join(ivyDir, 'evidence', 'my-feat.yaml');
    const content = await fs.readFile(evidencePath, 'utf-8');
    expect(content).toContain('changeName: my-feat');
    expect(content).toContain('taskCheck');
  });

  it('filters by --gate', async () => {
    const changeDir = path.join(tmp, 'openspec', 'changes', 'my-feat');
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(path.join(changeDir, 'tasks.md'), '- [x] Task 1\n');

    // --gate compile should skip tasks gate
    const code = await runVerify({ cwd: tmp, change: 'my-feat', gate: 'compile' });
    expect(code).toBe(0);
  });

  it('skips gates listed in --skip', async () => {
    const changeDir = path.join(tmp, 'openspec', 'changes', 'my-feat');
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(path.join(changeDir, 'tasks.md'), '- [ ] Task 1\n');

    const code = await runVerify({ cwd: tmp, change: 'my-feat', skip: 'tasks' });
    expect(code).toBe(0);
  });

  // ─── v0.12: Evidence Gate (TC-25 through TC-28) ───

  it('evidence gate passes when coverage meets threshold', async () => {
    // Create a decision with evidence link
    const memoryDir = path.join(ivyDir, 'memory');
    await fs.mkdir(path.join(memoryDir, 'decision'), { recursive: true });
    await fs.mkdir(path.join(memoryDir, 'evidence'), { recursive: true });

    await fs.writeFile(path.join(memoryDir, 'decision', 'change-a-adr-001.yaml'), [
      'id: ADR-001',
      'type: decision',
      'title: Use TypeScript',
      'timestamp: 2026-06-01T00:00:00.000Z',
      'changeName: change-a',
      'source: test',
      'content: test',
      'tags: []',
      'links:',
      '  - target: EVI-001',
      '    relation: evidences',
      '    description: test',
      '    createdAt: 2026-06-01',
    ].join('\n'), 'utf-8');
    await fs.writeFile(path.join(memoryDir, 'evidence', 'change-a-evi-001.yaml'), [
      'id: EVI-001',
      'type: evidence',
      'title: Test evidence',
      'timestamp: 2026-06-01T00:00:00.000Z',
      'changeName: change-a',
      'source: test',
      'content: test',
      'tags: []',
    ].join('\n'), 'utf-8');
    await fs.writeFile(path.join(memoryDir, 'index.json'), JSON.stringify({
      version: '0.10.0',
      entries: [
        { id: 'ADR-001', type: 'decision', title: 'Use TS', changeName: 'change-a', timestamp: '2026-06-01T00:00:00.000Z', file: 'change-a-adr-001.yaml' },
        { id: 'EVI-001', type: 'evidence', title: 'Evidence', changeName: 'change-a', timestamp: '2026-06-01T00:00:00.000Z', file: 'change-a-evi-001.yaml' },
      ],
    }));

    const code = await runVerify({ cwd: tmp, change: 'change-a', gate: 'evidence' });
    expect(code).toBe(0);
  });

  it('evidence gate fails when coverage is below threshold', async () => {
    const memoryDir = path.join(ivyDir, 'memory');
    await fs.mkdir(path.join(memoryDir, 'decision'), { recursive: true });
    // Two decisions, neither has evidence links
    await fs.writeFile(path.join(memoryDir, 'decision', 'change-b-adr-001.yaml'), [
      'id: ADR-001', 'type: decision', 'title: Dec 1',
      'timestamp: 2026-06-01T00:00:00.000Z', 'changeName: change-b',
      'source: test', 'content: test', 'tags: []',
    ].join('\n'), 'utf-8');
    await fs.writeFile(path.join(memoryDir, 'decision', 'change-b-adr-002.yaml'), [
      'id: ADR-002', 'type: decision', 'title: Dec 2',
      'timestamp: 2026-06-01T00:00:00.000Z', 'changeName: change-b',
      'source: test', 'content: test', 'tags: []',
    ].join('\n'), 'utf-8');
    await fs.writeFile(path.join(memoryDir, 'index.json'), JSON.stringify({
      version: '0.10.0',
      entries: [
        { id: 'ADR-001', type: 'decision', title: 'Dec 1', changeName: 'change-b', timestamp: '2026-06-01T00:00:00.000Z', file: 'change-b-adr-001.yaml' },
        { id: 'ADR-002', type: 'decision', title: 'Dec 2', changeName: 'change-b', timestamp: '2026-06-01T00:00:00.000Z', file: 'change-b-adr-002.yaml' },
      ],
    }));

    const code = await runVerify({ cwd: tmp, change: 'change-b', gate: 'evidence' });
    expect(code).toBe(1);
  });

  it('evidence gate skips when no decisions exist', async () => {
    // No memory directory at all
    const code = await runVerify({ cwd: tmp, change: 'change-c', gate: 'evidence' });
    expect(code).toBe(0);
  });

  it('evidence gate skips with --skip evidence', async () => {
    const code = await runVerify({ cwd: tmp, change: 'change-d', skip: 'evidence' });
    expect(code).toBe(0);
  });
});

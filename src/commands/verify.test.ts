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
});

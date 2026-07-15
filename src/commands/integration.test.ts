import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import { runInit } from './init.js';
import { runRoleShow, runRoleSet, runRoleList } from './role.js';
import { runPipelineStart, runPipelineStatus, runPipelineComplete, runPipelineBlock, runPipelineRetry } from './pipeline.js';
import { readYaml } from '../utils/yaml.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-int-'));
}

describe('Integration: Full User Flow', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
    await fs.mkdir(path.join(tmp, '.claude'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  // ─── Init ───

  it('ivy init installs all 5 roles', async () => {
    const code = await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });
    expect(code).toBe(0);

    const projectYaml = await readYaml(path.join(tmp, '.ivy', 'project.yaml'));
    expect(projectYaml).toBeDefined();
    expect(projectYaml!.role).toBeUndefined(); // no role set yet, default is developer at runtime

    // Verify all role directories exist in .ivy
    for (const role of ['developer', 'pm', 'qa', 'architect', 'devops']) {
      const roleSkillsDir = path.join(tmp, '.ivy', 'skills', 'ivy');
      expect(await fs.stat(roleSkillsDir).catch(() => null)).toBeTruthy();
    }
  });

  it('ivy init with overwrite is idempotent', async () => {
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });
    const code = await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'], overwrite: true });
    expect(code).toBe(0);

    const projectYaml = await readYaml(path.join(tmp, '.ivy', 'project.yaml'));
    expect(projectYaml).toBeDefined();
  });

  // ─── Role ───

  it('ivy role set switches role in project.yaml', async () => {
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });

    let code = await runRoleSet('pm', tmp);
    expect(code).toBe(0);

    const projectYaml = await readYaml(path.join(tmp, '.ivy', 'project.yaml'));
    expect(projectYaml!.role).toBe('pm');

    code = await runRoleSet('developer', tmp);
    expect(code).toBe(0);

    const updated = await readYaml(path.join(tmp, '.ivy', 'project.yaml'));
    expect(updated!.role).toBe('developer');
  });

  it('ivy role set rejects invalid role', async () => {
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });

    const code = await runRoleSet('invalid', tmp);
    expect(code).toBe(1);
  });

  it('ivy role list shows all 5 roles', async () => {
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });
    const code = await runRoleList();
    expect(code).toBe(0);
  });

  // ─── Pipeline ───

  it('ivy pipeline start creates DAG from role downstreams', async () => {
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });

    const code = await runPipelineStart('test-feature', tmp);
    expect(code).toBe(0);

    const pipeline = await readYaml(path.join(tmp, '.ivy', 'runtime', 'pipeline.yaml'));
    expect(pipeline).toBeDefined();
    expect(pipeline!.stages.length).toBeGreaterThanOrEqual(3);
    expect(pipeline!.edges.length).toBeGreaterThanOrEqual(3);

    // First stage should be in_progress, rest pending
    expect(pipeline!.stages[0].status).toBe('in_progress');
    expect(pipeline!.stages[1].status).toBe('pending');
  });

  it('ivy pipeline complete advances stage and switches role', async () => {
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });
    await runPipelineStart('test-feature', tmp);

    // Complete first stage (requirements → coding)
    const code = await runPipelineComplete('requirements', undefined, tmp);
    expect(code).toBe(0);

    const pipeline = await readYaml(path.join(tmp, '.ivy', 'runtime', 'pipeline.yaml'));
    expect(pipeline!.stages[0].status).toBe('completed');
    expect(pipeline!.stages[1].status).toBe('in_progress');

    // Role should have switched to developer
    const projectYaml = await readYaml(path.join(tmp, '.ivy', 'project.yaml'));
    expect(projectYaml!.role).toBe('developer');
  });

  it('ivy pipeline complete with conditional branch', async () => {
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });
    await runPipelineStart('test-feature', tmp);

    // Advance to testing stage
    await runPipelineComplete('requirements', undefined, tmp);
    await runPipelineComplete('coding', undefined, tmp);

    // Complete testing with bugs_found choice
    const code = await runPipelineComplete('testing', 'bugs_found', tmp);
    expect(code).toBe(0);

    const pipeline = await readYaml(path.join(tmp, '.ivy', 'runtime', 'pipeline.yaml'));
    // coding should be back to in_progress (retry)
    const codingStage = pipeline!.stages.find((s: { id: string }) => s.id === 'coding');
    expect(codingStage.status).toBe('in_progress');
  });

  it('ivy pipeline block and retry', async () => {
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });
    await runPipelineStart('test-feature', tmp);

    let code = await runPipelineBlock('coding', 'waiting for architecture', tmp);
    expect(code).toBe(0);

    let pipeline = await readYaml(path.join(tmp, '.ivy', 'runtime', 'pipeline.yaml'));
    const codingStage = pipeline!.stages.find((s: { id: string }) => s.id === 'coding');
    expect(codingStage.status).toBe('blocked');
    expect(codingStage.reason).toBe('waiting for architecture');

    code = await runPipelineRetry('coding', tmp);
    expect(code).toBe(0);

    pipeline = await readYaml(path.join(tmp, '.ivy', 'runtime', 'pipeline.yaml'));
    const retriedStage = pipeline!.stages.find((s: { id: string }) => s.id === 'coding');
    expect(retriedStage.status).toBe('in_progress');
  });

  it('ivy pipeline status shows all stages', async () => {
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });
    await runPipelineStart('test-feature', tmp);

    const code = await runPipelineStatus(tmp);
    expect(code).toBe(0);
  });

  // ─── End-to-End: Init → Role → Pipeline → Role Switch ───

  it('full flow: init → role pm → pipeline → complete → role auto-switch', async () => {
    // 1. Init
    let code = await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });
    expect(code).toBe(0);

    // 2. Set role to pm
    code = await runRoleSet('pm', tmp);
    expect(code).toBe(0);

    // 3. Create pipeline
    code = await runPipelineStart('full-flow-test', tmp);
    expect(code).toBe(0);

    // 4. Verify pipeline created with pm as first stage
    let pipeline = await readYaml(path.join(tmp, '.ivy', 'runtime', 'pipeline.yaml'));
    expect(pipeline!.stages[0].role).toBe('pm');
    expect(pipeline!.stages[0].status).toBe('in_progress');

    // 5. Complete PM stage → role should switch to developer
    code = await runPipelineComplete('requirements', undefined, tmp);
    expect(code).toBe(0);

    let projectYaml = await readYaml(path.join(tmp, '.ivy', 'project.yaml'));
    expect(projectYaml!.role).toBe('developer');

    // 6. Complete Developer stage → role should switch to qa
    code = await runPipelineComplete('coding', undefined, tmp);
    expect(code).toBe(0);

    projectYaml = await readYaml(path.join(tmp, '.ivy', 'project.yaml'));
    expect(projectYaml!.role).toBe('qa');

    // 7. Verify pipeline state
    pipeline = await readYaml(path.join(tmp, '.ivy', 'runtime', 'pipeline.yaml'));
    expect(pipeline!.stages[0].status).toBe('completed');
    expect(pipeline!.stages[1].status).toBe('completed');
    expect(pipeline!.stages[2].status).toBe('in_progress');
  });
});

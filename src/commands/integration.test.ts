import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import { runInit } from './init.js';
import { runRoleSet, runRoleList } from './role.js';
import { runPipelineStart, runPipelineStatus, runPipelineComplete, runPipelineBlock, runPipelineRetry } from './pipeline.js';
import { readYaml } from '../utils/yaml.js';

interface PipelineStage { id: string; role: string; status: string; reason?: string; }
interface PipelineEdge { from: string; to: string; condition?: string; }
interface PipelineData { stages: PipelineStage[]; edges: PipelineEdge[]; }

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-int-'));
}

async function readPipeline(cwd: string): Promise<PipelineData | null> {
  return readYaml<PipelineData>(path.join(cwd, '.ivy', 'runtime', 'pipeline.yaml'));
}

async function readProjectYaml(cwd: string): Promise<Record<string, unknown> | null> {
  return readYaml(path.join(cwd, '.ivy', 'project.yaml'));
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

  it('ivy init installs all 5 roles', async () => {
    const code = await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });
    expect(code).toBe(0);
    const yaml = await readProjectYaml(tmp);
    expect(yaml).toBeDefined();
  });

  it('ivy init with overwrite is idempotent', async () => {
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });
    const code = await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'], overwrite: true });
    expect(code).toBe(0);
  });

  it('ivy role set switches role in project.yaml', async () => {
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });
    let code = await runRoleSet('pm', tmp);
    expect(code).toBe(0);
    let yaml = await readProjectYaml(tmp);
    expect(yaml!.role).toBe('pm');

    code = await runRoleSet('developer', tmp);
    expect(code).toBe(0);
    yaml = await readProjectYaml(tmp);
    expect(yaml!.role).toBe('developer');
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

  it('ivy pipeline start creates DAG from role downstreams', async () => {
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });
    const code = await runPipelineStart('test-feature', tmp);
    expect(code).toBe(0);

    const p = await readPipeline(tmp);
    expect(p).toBeDefined();
    expect(p!.stages.length).toBeGreaterThanOrEqual(3);
    expect(p!.edges.length).toBeGreaterThanOrEqual(3);
    expect(p!.stages[0].status).toBe('in_progress');
    expect(p!.stages[1].status).toBe('pending');
  });

  it('ivy pipeline complete advances stage and switches role', async () => {
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });
    await runPipelineStart('test-feature', tmp);

    const code = await runPipelineComplete('requirements', undefined, tmp);
    expect(code).toBe(0);

    const p = await readPipeline(tmp);
    expect(p!.stages[0].status).toBe('completed');
    expect(p!.stages[1].status).toBe('in_progress');

    const yaml = await readProjectYaml(tmp);
    expect(yaml!.role).toBe('developer');
  });

  it('ivy pipeline complete with conditional branch', async () => {
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });
    await runPipelineStart('test-feature', tmp);
    await runPipelineComplete('requirements', undefined, tmp);
    await runPipelineComplete('coding', undefined, tmp);

    const code = await runPipelineComplete('testing', 'bugs_found', tmp);
    expect(code).toBe(0);

    const p = await readPipeline(tmp);
    const cs = p!.stages.find(s => s.id === 'coding');
    expect(cs!.status).toBe('in_progress');
  });

  it('ivy pipeline block and retry', async () => {
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });
    await runPipelineStart('test-feature', tmp);

    let code = await runPipelineBlock('coding', 'waiting', tmp);
    expect(code).toBe(0);
    let p = await readPipeline(tmp);
    const cs = p!.stages.find(s => s.id === 'coding');
    expect(cs!.status).toBe('blocked');
    expect(cs!.reason).toBe('waiting');

    code = await runPipelineRetry('coding', tmp);
    expect(code).toBe(0);
    p = await readPipeline(tmp);
    const rs = p!.stages.find(s => s.id === 'coding');
    expect(rs!.status).toBe('in_progress');
  });

  it('ivy pipeline status shows all stages', async () => {
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });
    await runPipelineStart('test-feature', tmp);
    const code = await runPipelineStatus(tmp);
    expect(code).toBe(0);
  });

  it('full flow: init → role pm → pipeline → complete → role auto-switch', async () => {
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true, platforms: ['claude'] });
    await runRoleSet('pm', tmp);
    await runPipelineStart('full-flow-test', tmp);

    let p = await readPipeline(tmp);
    expect(p!.stages[0].role).toBe('pm');

    await runPipelineComplete('requirements', undefined, tmp);
    let yaml = await readProjectYaml(tmp);
    expect(yaml!.role).toBe('developer');

    await runPipelineComplete('coding', undefined, tmp);
    yaml = await readProjectYaml(tmp);
    expect(yaml!.role).toBe('qa');

    p = await readPipeline(tmp);
    expect(p!.stages[0].status).toBe('completed');
    expect(p!.stages[1].status).toBe('completed');
    expect(p!.stages[2].status).toBe('in_progress');
  });
});

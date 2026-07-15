import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { readYaml, writeYaml } from '../utils/yaml.js';
import { patchYaml } from '../utils/yaml.js';
import { defaultRoleRegistry, type RoleConfig } from './role-registry.js';
import { logger } from '../utils/logger.js';

export interface PipelineStage {
  id: string;
  role: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'failed' | 'skipped';
  reason?: string;
  started_at?: string;
  completed_at?: string;
}

export interface PipelineEdge {
  from: string;
  to: string;
  condition?: string;
}

export interface Pipeline {
  id: string;
  name: string;
  created_at: string;
  stages: PipelineStage[];
  edges: PipelineEdge[];
}

function getRuntimeDir(cwd: string): string {
  return path.join(cwd, '.ivy', 'runtime');
}

function getPipelinePath(cwd: string): string {
  return path.join(getRuntimeDir(cwd), 'pipeline.yaml');
}

export async function createPipeline(cwd: string, name: string): Promise<Pipeline> {
  await defaultRoleRegistry.load();

  const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const stages: PipelineStage[] = [];
  const edges: PipelineEdge[] = [];
  const visited = new Set<string>();

  // Start with PM as the entry point
  const pmRole = defaultRoleRegistry.get('pm');
  if (!pmRole) throw new Error('PM role not found');

  const queue: Array<{ roleId: string; stageId: string }> = [
    { roleId: 'pm', stageId: 'requirements' },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.stageId)) continue;
    visited.add(current.stageId);

    const role = defaultRoleRegistry.get(current.roleId);
    if (!role) continue;

    stages.push({
      id: current.stageId,
      role: current.roleId,
      status: stages.length === 0 ? 'in_progress' : 'pending',
      started_at: stages.length === 0 ? new Date().toISOString() : undefined,
    });

    // Follow downstream edges
    const downstreams = role.pipeline_downstream ?? [];
    for (const ds of downstreams) {
      edges.push({
        from: current.stageId,
        to: ds.stage,
        condition: ds.condition,
      });
      queue.push({ roleId: ds.role, stageId: ds.stage });
    }
  }

  const pipeline: Pipeline = {
    id,
    name,
    created_at: new Date().toISOString(),
    stages,
    edges,
  };

  const runtimeDir = getRuntimeDir(cwd);
  await fs.mkdir(runtimeDir, { recursive: true });
  await writeYaml(getPipelinePath(cwd), pipeline as unknown as Record<string, unknown>);

  // Set project.yaml role to first stage
  const projectYamlPath = path.join(cwd, '.ivy', 'project.yaml');
  await patchYaml(projectYamlPath, { role: stages[0].role });

  return pipeline;
}

export async function readPipeline(cwd: string): Promise<Pipeline | null> {
  return readYaml<Pipeline>(getPipelinePath(cwd));
}

export async function completeStage(
  cwd: string,
  stageId: string,
  choice?: string,
): Promise<Pipeline> {
  const pipeline = await readPipeline(cwd);
  if (!pipeline) throw new Error('No pipeline found. Run ivy pipeline start first.');

  const stage = pipeline.stages.find(s => s.id === stageId);
  if (!stage) throw new Error(`Stage not found: ${stageId}`);

  stage.status = 'completed';
  stage.completed_at = new Date().toISOString();

  // Find downstream edges
  const downstreams = pipeline.edges.filter(e => e.from === stageId);
  const pendingStages = pipeline.stages.filter(s =>
    downstreams.some(d => d.to === s.id) && s.status === 'pending',
  );

  // If multiple downstreams with conditions, use choice
  let nextStageId: string | undefined;
  if (downstreams.length === 1) {
    nextStageId = downstreams[0].to;
  } else if (choice) {
    const edge = downstreams.find(e => e.condition === choice);
    if (edge) nextStageId = edge.to;
  }

  if (nextStageId) {
    const nextStage = pipeline.stages.find(s => s.id === nextStageId);
    if (nextStage) {
      nextStage.status = 'in_progress';
      nextStage.started_at = new Date().toISOString();

      // Update project.yaml role
      const projectYamlPath = path.join(cwd, '.ivy', 'project.yaml');
      await patchYaml(projectYamlPath, { role: nextStage.role });
    }
  }

  await writeYaml(getPipelinePath(cwd), pipeline as unknown as Record<string, unknown>);
  return pipeline;
}

export async function blockStage(cwd: string, stageId: string, reason: string): Promise<Pipeline> {
  const pipeline = await readPipeline(cwd);
  if (!pipeline) throw new Error('No pipeline found.');

  const stage = pipeline.stages.find(s => s.id === stageId);
  if (!stage) throw new Error(`Stage not found: ${stageId}`);

  stage.status = 'blocked';
  stage.reason = reason;
  await writeYaml(getPipelinePath(cwd), pipeline as unknown as Record<string, unknown>);
  return pipeline;
}

export async function retryStage(cwd: string, stageId: string): Promise<Pipeline> {
  const pipeline = await readPipeline(cwd);
  if (!pipeline) throw new Error('No pipeline found.');

  const stage = pipeline.stages.find(s => s.id === stageId);
  if (!stage) throw new Error(`Stage not found: ${stageId}`);

  stage.status = 'in_progress';
  stage.reason = undefined;
  stage.completed_at = undefined;
  stage.started_at = new Date().toISOString();

  const projectYamlPath = path.join(cwd, '.ivy', 'project.yaml');
  await patchYaml(projectYamlPath, { role: stage.role });

  await writeYaml(getPipelinePath(cwd), pipeline as unknown as Record<string, unknown>);
  return pipeline;
}

export function getDownstreamChoices(pipeline: Pipeline, stageId: string): PipelineEdge[] {
  return pipeline.edges.filter(e => e.from === stageId && e.condition);
}

export function formatPipelineStatus(pipeline: Pipeline): string {
  const roleIcons: Record<string, string> = {
    pm: '📋', developer: '💻', qa: '🧪', architect: '🏗️', devops: '🚀',
  };
  const statusIcons: Record<string, string> = {
    pending: '⏳', in_progress: '🔄', completed: '✅', blocked: '🚫', failed: '❌', skipped: '⏭',
  };

  let output = `\nPipeline: ${pipeline.name} (${pipeline.id})\n`;
  output += '─'.repeat(50) + '\n';

  for (const stage of pipeline.stages) {
    const icon = roleIcons[stage.role] ?? '❓';
    const status = statusIcons[stage.status] ?? '❓';
    const name = stage.id.padEnd(14);
    const roleName = stage.role.padEnd(10);
    const time = stage.completed_at
      ? ` ${new Date(stage.completed_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
      : stage.started_at
        ? ` ${new Date(stage.started_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
        : '';
    const reason = stage.reason ? ` (${stage.reason})` : '';
    output += `${icon} ${name} ${status} ${roleName}${time}${reason}\n`;
  }

  output += '─'.repeat(50) + '\n';
  return output;
}

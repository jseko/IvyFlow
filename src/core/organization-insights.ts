/**
 * Organization Insights — cross-project read-only metrics aggregation.
 *
 * v0.11: Reads multiple projects' .ivy/ directories and computes aggregate
 * metrics with P50/P80/P95 distributions. Read-only, no caching, no remote.
 *
 * Output constraint: Metrics / Distribution / Outlier only. No recommendations.
 */

import path from 'path';
import { promises as fs } from 'fs';
import { fileExists, readDir } from '../utils/fs.js';
import { readYaml } from '../utils/yaml.js';

// ─── Types ───

export interface OrgInsightsQuery {
  projectPaths: string[];
  metrics?: Array<
    'completion_rate' | 'phase_durations' | 'commit_density'
    | 'bottleneck_phases' | 'memory_coverage'
  >;
  timeRange?: { from: string; to: string };
}

export interface OrgInsightsResult {
  totalProjects: number;
  readableProjects: number;
  failedProjects: Array<{ path: string; error: string }>;
  aggregates: Record<string, {
    p50: number;
    p80: number;
    p95: number;
    perProject: Array<{
      projectPath: string;
      changeCount: number;
      value: number;
    }>;
  }>;
  /** true if < 5 projects or < 50 total changes */
  dataLimited: boolean;
  totalChanges: number;
}

interface ProjectData {
  projectPath: string;
  changeCount: number;
  completedChanges: number;
  phaseDurations: Record<string, number[]>;
  commitCount: number;
  memoryCount: number;
}

// ─── Main ───

export async function computeOrgInsights(query: OrgInsightsQuery): Promise<OrgInsightsResult> {
  const projectPaths = [...new Set(query.projectPaths.filter(Boolean))];
  const wantedMetrics = query.metrics ?? [
    'completion_rate', 'phase_durations', 'commit_density',
    'bottleneck_phases', 'memory_coverage',
  ];

  const failedProjects: Array<{ path: string; error: string }> = [];
  const projectData: ProjectData[] = [];

  for (const p of projectPaths) {
    try {
      const data = await readProjectData(p);
      projectData.push(data);
    } catch (err) {
      failedProjects.push({ path: p, error: (err as Error).message ?? String(err) });
    }
  }

  const totalChanges = projectData.reduce((s, d) => s + d.changeCount, 0);
  const dataLimited = projectPaths.length < 5 || totalChanges < 50;

  const aggregates: OrgInsightsResult['aggregates'] = {};

  for (const metric of wantedMetrics) {
    switch (metric) {
      case 'completion_rate':
        aggregates.completion_rate = computeDistribution(
          projectData.map((d) => ({
            projectPath: d.projectPath,
            changeCount: d.changeCount,
            value: d.changeCount > 0 ? d.completedChanges / d.changeCount : 0,
          })),
        );
        break;
      case 'phase_durations':
        aggregates.phase_durations = computeDistribution(
          projectData.map((d) => ({
            projectPath: d.projectPath,
            changeCount: d.changeCount,
            value: computeAvgPhaseDuration(d),
          })),
        );
        break;
      case 'commit_density':
        aggregates.commit_density = computeDistribution(
          projectData.map((d) => ({
            projectPath: d.projectPath,
            changeCount: d.changeCount,
            value: 0, // requires session timing — placeholder
          })),
        );
        break;
      case 'bottleneck_phases':
        aggregates.bottleneck_phases = computeDistribution(
          projectData.map((d) => ({
            projectPath: d.projectPath,
            changeCount: d.changeCount,
            value: identifyBottleneck(d),
          })),
        );
        break;
      case 'memory_coverage':
        aggregates.memory_coverage = computeDistribution(
          projectData.map((d) => ({
            projectPath: d.projectPath,
            changeCount: d.changeCount,
            value: d.memoryCount,
          })),
        );
        break;
    }
  }

  return {
    totalProjects: projectPaths.length,
    readableProjects: projectData.length,
    failedProjects,
    aggregates,
    dataLimited,
    totalChanges,
  };
}

// ─── Project Data Reading ───

async function readProjectData(projectPath: string): Promise<ProjectData> {
  const ivyDir = path.join(projectPath, '.ivy');

  // Read project.yaml
  const projectYamlPath = path.join(ivyDir, 'project.yaml');
  if (!(await fileExists(projectYamlPath))) {
    throw new Error(`No .ivy/project.yaml found at ${projectPath}`);
  }

  // Read events.jsonl for change/phase data
  let changeCount = 0;
  let completedChanges = 0;
  const phaseDurations: Record<string, number[]> = {};
  let commitCount = 0;

  const eventsPath = path.join(ivyDir, 'sessions', 'raw', 'events.jsonl');
  if (await fileExists(eventsPath)) {
    const content = await fs.readFile(eventsPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const changes = new Set<string>();

    for (const line of lines) {
      try {
        const ev = JSON.parse(line);
        if (ev.change) changes.add(ev.change);
        if (ev.event === 'git_commit') commitCount++;
        if (ev.event === 'phase_transition' && ev.phase) {
          if (!phaseDurations[ev.phase]) phaseDurations[ev.phase] = [];
          if (ev.timestamp) {
            const duration = calcDaysSince(ev.timestamp);
            phaseDurations[ev.phase].push(duration);
          }
        }
      } catch { /* skip malformed lines */ }
    }

    changeCount = changes.size;
    // Estimate completed changes from commits with matching archive
    const archiveDir = path.join(ivyDir, 'archive');
    if (await fileExists(archiveDir)) {
      try {
        const files = await readDir(archiveDir);
        completedChanges = files.filter((f) => f.endsWith('.yaml')).length;
      } catch { /* ignore */ }
    }
  }

  // Read memory index
  let memoryCount = 0;
  const memoryIndexPath = path.join(ivyDir, 'memory', 'index.json');
  if (await fileExists(memoryIndexPath)) {
    try {
      const idx = await readYaml<{ entries?: Array<unknown> }>(memoryIndexPath);
      memoryCount = idx?.entries?.length ?? 0;
    } catch { /* ignore */ }
  }

  return {
    projectPath,
    changeCount,
    completedChanges,
    phaseDurations,
    commitCount,
    memoryCount,
  };
}

// ─── Metrics ───

function computeDistribution(
  perProject: Array<{ projectPath: string; changeCount: number; value: number }>,
): { p50: number; p80: number; p95: number; perProject: typeof perProject } {
  const values = perProject.map((p) => p.value).sort((a, b) => a - b);

  return {
    p50: percentile(values, 0.5),
    p80: percentile(values, 0.8),
    p95: values.length >= 3 ? percentile(values, 0.95) : 0,
    perProject,
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function computeAvgPhaseDuration(data: ProjectData): number {
  const all: number[] = [];
  for (const durations of Object.values(data.phaseDurations)) {
    all.push(...durations);
  }
  if (all.length === 0) return 0;
  return all.reduce((s, d) => s + d, 0) / all.length;
}

function identifyBottleneck(data: ProjectData): number {
  // Returns the max average phase duration as the bottleneck signal
  let maxAvg = 0;
  for (const durations of Object.values(data.phaseDurations)) {
    if (durations.length === 0) continue;
    const avg = durations.reduce((s, d) => s + d, 0) / durations.length;
    if (avg > maxAvg) maxAvg = avg;
  }
  return maxAvg;
}

function calcDaysSince(ts: string): number {
  const start = new Date(ts).getTime();
  if (isNaN(start)) return 0;
  return Math.round((Date.now() - start) / (1000 * 60 * 60 * 24) * 10) / 10;
}

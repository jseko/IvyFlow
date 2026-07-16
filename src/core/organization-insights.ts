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
import { readOrgGateThresholds } from './memory/manager.js';
import type { OrgGateThresholds } from './memory/model.js';

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
      trend?: 'up' | 'down' | 'stable';
    }>;
  }>;
  /** true when BOTH < 5 projects AND < 50 total changes */
  dataLimited: boolean;
  totalChanges: number;
  /** v0.15: Org Intelligence gate status */
  gateStatus?: {
    status: 'disabled' | 'warning' | 'full';
    message: string;
    current: { projects: number; memories: number; months: number };
    thresholds: { min: { projects: number; memories: number; months: number }; recommended: { projects: number; memories: number; months: number } };
  };
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
  // v0.12 GA: dataLimited when BOTH < 5 projects AND < 50 changes (not OR)
  const dataLimited = projectPaths.length < 5 && totalChanges < 50;

  // v0.15: Soften Org Intelligence gates with configurable thresholds
  let gateStatus: OrgInsightsResult['gateStatus'];
  if (projectPaths.length > 0) {
    const thresholds = await readOrgGateThresholds(projectPaths[0]);
    const totalMemories = projectData.reduce((s, d) => s + d.memoryCount, 0);
    const oldestRecord = findOldestRecord(projectData);
    const activeMonths = oldestRecord ? Math.max(1, Math.round((Date.now() - new Date(oldestRecord).getTime()) / (1000 * 60 * 60 * 24 * 30))) : 0;

    let status: 'disabled' | 'warning' | 'full';
    let message: string;

    if (projectPaths.length < thresholds.min_projects || totalMemories < thresholds.min_memories || activeMonths < thresholds.min_active_months) {
      status = 'disabled';
      message = `数据不足：需要至少 ${thresholds.min_projects} 个项目、${thresholds.min_memories} 条记忆、${thresholds.min_active_months} 个月活跃期。当前：${projectPaths.length} 项目、${totalMemories} 记忆、${activeMonths} 月`;
    } else if (projectPaths.length < thresholds.recommended_projects || totalMemories < thresholds.recommended_memories || activeMonths < thresholds.recommended_months) {
      status = 'warning';
      message = `数据量有限，部分洞察可能不够准确。建议达到 ${thresholds.recommended_projects}+ 项目、${thresholds.recommended_memories}+ 记忆、${thresholds.recommended_months}+ 月以获得最佳结果。`;
    } else {
      status = 'full';
      message = '';
    }

    gateStatus = {
      status,
      message,
      current: { projects: projectPaths.length, memories: totalMemories, months: activeMonths },
      thresholds: {
        min: { projects: thresholds.min_projects, memories: thresholds.min_memories, months: thresholds.min_active_months },
        recommended: { projects: thresholds.recommended_projects, memories: thresholds.recommended_memories, months: thresholds.recommended_months },
      },
    };
  }

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
            trend: computeBottleneckTrend(d),
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
    gateStatus,
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

/**
 * v0.12: Compute bottleneck trend by comparing first-half vs second-half
 * phase durations within the same project. Returns 'up' (increasing),
 * 'down' (decreasing), or 'stable' (within 10%).
 */
function computeBottleneckTrend(data: ProjectData): 'up' | 'down' | 'stable' {
  // Find the bottleneck phase (phase with max avg duration)
  let bottleneckPhase = '';
  let maxAvg = 0;
  for (const [phase, durations] of Object.entries(data.phaseDurations)) {
    if (durations.length === 0) continue;
    const avg = durations.reduce((s, d) => s + d, 0) / durations.length;
    if (avg > maxAvg) { maxAvg = avg; bottleneckPhase = phase; }
  }

  if (!bottleneckPhase) return 'stable';

  const durations = data.phaseDurations[bottleneckPhase];
  if (durations.length < 4) return 'stable'; // too few data points

  const half = Math.floor(durations.length / 2);
  const firstHalf = durations.slice(0, half);
  const secondHalf = durations.slice(half);

  const firstAvg = firstHalf.reduce((s, d) => s + d, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((s, d) => s + d, 0) / secondHalf.length;

  if (firstAvg === 0) return 'stable';
  const ratio = (secondAvg - firstAvg) / firstAvg;

  if (ratio > 0.1) return 'up';
  if (ratio < -0.1) return 'down';
  return 'stable';
}

function findOldestRecord(projectData: ProjectData[]): string | null {
  let oldest: string | null = null;
  // Check memory index files for oldest timestamp
  for (const data of projectData) {
    if (data.changeCount > 0) {
      // Use project creation heuristic: earliest phase timestamp
      const earliest = Object.values(data.phaseDurations)
        .flat()
        .reduce((min, d) => (d > 0 && (min === 0 || d < min) ? d : min), 0);
      if (earliest > 0) {
        const estDate = new Date(Date.now() - earliest * 86400 * 1000).toISOString();
        if (!oldest || estDate < oldest) oldest = estDate;
      }
    }
  }
  return oldest;
}


function calcDaysSince(ts: string): number {
  const start = new Date(ts).getTime();
  if (isNaN(start)) return 0;
  return Math.round((Date.now() - start) / (1000 * 60 * 60 * 24) * 10) / 10;
}

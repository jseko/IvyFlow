/**
 * Export API — read-only export of .ivy/ data to standardized JSON.
 *
 * v0.10: replaces the deferred Cross-Project Dashboard. Data is exported in
 * ExportPayload format (v0.10.0) for consumption by Excel, Grafana, Metabase,
 * or jq-based toolchains.
 *
 * Read-only guarantee: never writes or modifies .ivy/ files.
 */

import path from 'path';
import { promises as fs } from 'fs';

import { fileExists, readDir } from '../utils/fs.js';
import { readYaml } from '../utils/yaml.js';
import { MemoryStore } from './memory-arch.js';
import { readState } from './lifecycle-projection.js';
import type { ExportPayload, ExportChange, ExportMetric } from './types.js';

// ─── Export Engine ───

export interface ExportOptions {
  cwd: string;
  projects?: string[];
  dimension?: 'changes' | 'metrics' | 'knowledge' | 'workflow-evidence';
}

export async function buildExportPayload(opts: ExportOptions): Promise<ExportPayload> {
  const projects = opts.projects ?? [opts.cwd];

  const allChanges: ExportChange[] = [];
  const allMetrics: ExportMetric[] = [];
  const allKnowledge: ExportPayload['knowledge'] = [];
  let allWorkflowEvidence: ExportPayload['workflowEvidence'];

  for (const projectPath of projects) {
    const ivyDir = path.join(projectPath, '.ivy');

    if (!(await fileExists(path.join(ivyDir, 'project.yaml')))) continue;

    // Read project YAML
    const projectYaml = await readYaml<{
      name?: string;
      analytics_enabled?: boolean;
      platforms?: Array<{ id: string; name: string }>;
    }>(path.join(ivyDir, 'project.yaml'));

    const projectInfo = {
      name: projectYaml?.name ?? path.basename(projectPath),
      path: projectPath,
      platforms: projectYaml?.platforms ?? [],
      analyticsEnabled: projectYaml?.analytics_enabled ?? false,
    };

    // Collect changes from archive/knowledge dirs
    if (!opts.dimension || opts.dimension === 'changes') {
      const changeNames = await detectChanges(ivyDir);
      for (const name of changeNames) {
        const change = await buildChangeRecord(ivyDir, name);
        if (change) allChanges.push(change);
      }
    }

    // Collect metrics from analytics data
    if (!opts.dimension || opts.dimension === 'metrics') {
      const metrics = await collectMetrics(ivyDir);
      allMetrics.push(...metrics);
    }

    // Collect knowledge from MemoryStore
    if (!opts.dimension || opts.dimension === 'knowledge') {
      const store = new MemoryStore(projectPath);
      await store.ensureSchema();
      await store.referenceV09Knowledge();
      const records = await store.query({});
      allKnowledge.push(...records);
    }

    // Collect workflow evidence from state.yaml
    if (!opts.dimension || opts.dimension === 'workflow-evidence') {
      const evidence = await collectWorkflowEvidence(projectPath);
      if (evidence.length > 0) {
        if (!allWorkflowEvidence) allWorkflowEvidence = [];
        allWorkflowEvidence.push(...evidence);
      }
    }
  }

  return {
    version: '0.11.0',
    exportedAt: new Date().toISOString(),
    project: {
      name: path.basename(opts.cwd),
      path: opts.cwd,
      platforms: [],
      analyticsEnabled: false,
    },
    changes: allChanges,
    metrics: allMetrics,
    knowledge: allKnowledge,
    ...(allWorkflowEvidence ? { workflowEvidence: allWorkflowEvidence } : {}),
    errors: [],
  };
}

// ─── Internal Helpers ───

async function detectChanges(ivyDir: string): Promise<string[]> {
  const changes: string[] = [];

  // Check knowledge directory for change names
  const knowledgeDir = path.join(ivyDir, 'knowledge');
  if (await fileExists(knowledgeDir)) {
    try {
      const files = await readDir(knowledgeDir);
      for (const f of files) {
        if (f.endsWith('.yaml')) {
          changes.push(f.replace('.yaml', ''));
        }
      }
    } catch {
      // ignore
    }
  }

  // Deduplicate
  return [...new Set(changes)];
}

async function buildChangeRecord(ivyDir: string, name: string): Promise<ExportChange | null> {
  // Check archive directory for phase data
  const archiveDir = path.join(ivyDir, 'archive');
  let commitCount = 0;
  const phases: ExportChange['phases'] = [];

  if (await fileExists(archiveDir)) {
    try {
      const files = await readDir(archiveDir);
      for (const f of files) {
        if (f === `${name}.yaml` || f.startsWith(`${name}-`)) {
          const data = await readYaml<{
            commits?: number;
            phaseHistory?: Array<{ phase: string; enteredAt: string }>;
          }>(path.join(archiveDir, f));
          if (data) {
            commitCount = data.commits ?? commitCount;
            if (data.phaseHistory) {
              for (const ph of data.phaseHistory) {
                phases.push({
                  name: ph.phase,
                  enteredAt: ph.enteredAt,
                  duration_days: calcDuration(ph.enteredAt),
                });
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    name,
    phases: phases.length > 0 ? phases : [],
    commitCount,
    completed: true,
  };
}

async function collectMetrics(ivyDir: string): Promise<ExportMetric[]> {
  const metrics: ExportMetric[] = [];

  // Read raw events for basic stats
  const rawPath = path.join(ivyDir, 'sessions', 'raw', 'events.jsonl');
  if (await fileExists(rawPath)) {
    try {
      const content = await fs.readFile(rawPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      metrics.push({
        metric: 'raw_events',
        change: 'all',
        phase: 'all',
        value: lines.length,
        label: 'Total raw events',
      });
    } catch {
      // ignore
    }
  }

  return metrics;
}

function calcDuration(startDate: string): number {
  const start = new Date(startDate).getTime();
  if (isNaN(start)) return 0;
  return Math.round((Date.now() - start) / (1000 * 60 * 60 * 24) * 10) / 10;
}

/**
 * Collect workflow evidence entries from .ivy/state.yaml.
 */
async function collectWorkflowEvidence(projectPath: string): Promise<NonNullable<ExportPayload['workflowEvidence']>> {
  const evidence: NonNullable<ExportPayload['workflowEvidence']> = [];
  try {
    const state = await readState(projectPath);
    if (state && state.transitionHistory.length > 0) {
      for (const t of state.transitionHistory) {
        evidence.push({
          changeName: state.changeName,
          transition: t.from ? `${t.from}→${t.to}` : `(start)→${t.to}`,
          rationale: t.rationale ?? '',
          refs: t.refs ?? [],
          timestamp: t.timestamp,
        });
      }
    }
  } catch {
    // No state file — no evidence to export
  }
  return evidence;
}

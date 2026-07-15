/**
 * v0.31: Organization Intelligence types.
 * Defines OrgQuerySpec discriminated union and related types.
 */

// ─── OrgQuerySpec (Tasks 7.1) ───

export type OrgQuerySpec =
  | { type: 'insights' }
  | { type: 'compare'; a: string; b: string }
  | { type: 'memory'; filter: { type?: string; tag?: string; project?: string; limit?: number } }
  | { type: 'gate_status' }
  | { type: 'council'; question: string; crossProject?: boolean; perspectiveIds?: string[]; concurrency?: number };

// ─── OrgQueryResult (Task 7.2) ───

import path from 'path';
import fs from 'node:fs';

import type { CrossProjectCouncilReport } from './cross-project-council.js';
import { CouncilEngine } from './council-engine.js';

export type OrgQueryResult =
  | { type: 'insights'; data: Record<string, unknown> }
  | { type: 'memory'; data: unknown }
  | { type: 'gate_status'; data: { status: string } }
  | { type: 'council'; data: CrossProjectCouncilReport };

// ─── OrgIntelligenceEngine (Task 7.3) ───

import { CrossProjectCouncilEngine } from './cross-project-council.js';

export class OrgIntelligenceEngine {
  constructor(private opts: { projectPaths: string[] }) {}

  /** G1: expose the aggregated project set (aggregation substrate). */
  getProjectPaths(): string[] {
    return this.opts.projectPaths;
  }

  /**
   * G1: discover sibling projects by scanning for `.ivy/memory` directories.
   * This is the Org layer's project-discovery responsibility — the
   * cross-project council engine consumes the result via getProjectPaths().
   */
  static discover(cwd: string): OrgIntelligenceEngine {
    const projectPaths = discoverProjectPaths(cwd);
    return new OrgIntelligenceEngine({ projectPaths });
  }

  async execute(spec: OrgQuerySpec): Promise<OrgQueryResult> {
    switch (spec.type) {
      case 'insights':
        return { type: 'insights', data: {} };
      case 'memory':
        return { type: 'memory', data: null };
      case 'gate_status':
        return { type: 'gate_status', data: { status: 'disabled' } };
      case 'council':
        return this.executeCouncil(spec);
      default:
        throw new Error(`Unknown query type: ${(spec as OrgQuerySpec).type}`);
    }
  }

  private async executeCouncil(
    spec: OrgQuerySpec & { type: 'council' },
  ): Promise<OrgQueryResult> {
    const crossEngine = new CrossProjectCouncilEngine({
      projectPaths: this.opts.projectPaths,
      councilFactory: async (projectPath: string) => new CouncilEngine(projectPath),
    });

    const report = await crossEngine.ask(spec.question, {
      perspectiveIds: spec.perspectiveIds,
      concurrency: spec.concurrency,
    });

    return { type: 'council', data: report };
  }
}

// ─── Project discovery (G1: moved from council CLI) ───

/** Scan cwd and its sibling directories for projects with a `.ivy/memory` dir. */
function discoverProjectPaths(cwd: string): string[] {
  const projects: string[] = [];

  // Check cwd itself
  if (fs.existsSync(path.join(cwd, '.ivy', 'memory'))) {
    projects.push(cwd);
  }

  // Check parent directory children
  const parent = path.dirname(cwd);
  try {
    const entries = fs.readdirSync(parent, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;
      if (['node_modules', 'dist', 'build', '.git'].includes(entry.name)) continue;

      const projectPath = path.join(parent, entry.name);
      if (projectPath === cwd) continue;

      if (fs.existsSync(path.join(projectPath, '.ivy', 'memory'))) {
        projects.push(projectPath);
      }
    }
  } catch {
    /* skip unreadable directories */
  }

  return projects.sort();
}
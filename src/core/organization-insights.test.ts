import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { mkdirSync, rmSync } from 'fs';
import { promises as fs } from 'fs';

import { computeOrgInsights } from './organization-insights.js';
import { writeYaml } from '../utils/yaml.js';

function makeProjectDir(): string {
  const dir = path.join(os.tmpdir(), `ivy-org-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

async function makeIvyProject(dir: string, changes: number, completed: number): Promise<void> {
  const ivyDir = path.join(dir, '.ivy');
  mkdirSync(ivyDir, { recursive: true });
  await writeYaml(path.join(ivyDir, 'project.yaml'), { version: '0.11.0', platforms: ['claude'] });

  // Create events
  const eventsDir = path.join(ivyDir, 'sessions', 'raw');
  mkdirSync(eventsDir, { recursive: true });
  const events: string[] = [];
  for (let i = 0; i < changes; i++) {
    events.push(JSON.stringify({ event: 'phase_transition', timestamp: new Date().toISOString(), change: `change-${i}`, phase: 'build' }));
    events.push(JSON.stringify({ event: 'git_commit', timestamp: new Date().toISOString(), change: `change-${i}` }));
  }
  await fs.writeFile(path.join(eventsDir, 'events.jsonl'), events.join('\n'), 'utf-8');

  // Create archive dir for completed count
  if (completed > 0) {
    const archiveDir = path.join(ivyDir, 'archive');
    mkdirSync(archiveDir, { recursive: true });
    for (let i = 0; i < completed; i++) {
      await writeYaml(path.join(archiveDir, `change-${i}.yaml`), { changeName: `change-${i}` });
    }
  }
}

describe('Organization Insights — TC-1: Multi-project aggregation', () => {
  it('aggregates metrics from multiple projects', async () => {
    const d1 = makeProjectDir();
    const d2 = makeProjectDir();
    await makeIvyProject(d1, 5, 3);
    await makeIvyProject(d2, 3, 2);

    const result = await computeOrgInsights({ projectPaths: [d1, d2] });
    expect(result.totalProjects).toBe(2);
    expect(result.readableProjects).toBe(2);
    expect(result.totalChanges).toBeGreaterThan(0);
    expect(result.aggregates.completion_rate).toBeDefined();

    rmSync(d1, { recursive: true, force: true });
    rmSync(d2, { recursive: true, force: true });
  });
});

describe('Organization Insights — TC-2: Partial project failure', () => {
  it('handles missing .ivy/ directories gracefully', async () => {
    const d1 = makeProjectDir();
    const d2 = makeProjectDir();
    const badPath = path.join(os.tmpdir(), `nonexistent-${Date.now()}`);
    await makeIvyProject(d1, 3, 1);
    // d2 has no .ivy/ — let it be empty
    mkdirSync(d2, { recursive: true });

    const result = await computeOrgInsights({ projectPaths: [d1, d2, badPath] });
    expect(result.readableProjects).toBe(1); // only d1 has proper .ivy/
    expect(result.failedProjects.length).toBeGreaterThanOrEqual(1); // badPath fails

    rmSync(d1, { recursive: true, force: true });
    rmSync(d2, { recursive: true, force: true });
  });
});

describe('Organization Insights — TC-3: Empty project', () => {
  it('handles project with 0 changes', async () => {
    const d1 = makeProjectDir();
    const d2 = makeProjectDir();
    await makeIvyProject(d1, 0, 0);
    await makeIvyProject(d2, 4, 2);

    const result = await computeOrgInsights({ projectPaths: [d1, d2] });
    expect(result.totalProjects).toBe(2);
    expect(result.readableProjects).toBe(2);

    rmSync(d1, { recursive: true, force: true });
    rmSync(d2, { recursive: true, force: true });
  });
});

describe('Organization Insights — TC-4: Single project fallback', () => {
  it('works with a single project path', async () => {
    const d1 = makeProjectDir();
    await makeIvyProject(d1, 5, 3);

    const result = await computeOrgInsights({ projectPaths: [d1] });
    expect(result.totalProjects).toBe(1);
    expect(result.readableProjects).toBe(1);
    expect(result.aggregates.completion_rate).toBeDefined();

    rmSync(d1, { recursive: true, force: true });
  });
});

describe('Organization Insights — TC-5: Beta data volume notice', () => {
  it('marks dataLimited when < 5 projects', async () => {
    const d1 = makeProjectDir();
    const d2 = makeProjectDir();
    await makeIvyProject(d1, 3, 1);
    await makeIvyProject(d2, 2, 1);

    const result = await computeOrgInsights({ projectPaths: [d1, d2] });
    expect(result.dataLimited).toBe(true);

    rmSync(d1, { recursive: true, force: true });
    rmSync(d2, { recursive: true, force: true });
  });
});

describe('Organization Insights — TC-6: Metrics filter', () => {
  it('only computes requested metrics', async () => {
    const d1 = makeProjectDir();
    await makeIvyProject(d1, 5, 3);

    const result = await computeOrgInsights({
      projectPaths: [d1],
      metrics: ['completion_rate', 'memory_coverage'],
    });
    expect(result.aggregates.completion_rate).toBeDefined();
    expect(result.aggregates.memory_coverage).toBeDefined();
    expect(result.aggregates.phase_durations).toBeUndefined();

    rmSync(d1, { recursive: true, force: true });
  });
});

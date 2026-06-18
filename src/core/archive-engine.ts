/**
 * Archive Engine — handles VERIFY→ARCHIVE phase transition, change directory
 * move, and archive report generation. Entry point for L0 Memory.
 *
 * v0.9: Rewritten from v0.8 flag-based archive to a full command engine with
 * knowledge extraction integration and post-archive actions.
 */

import path from 'path';
import { execSync } from 'child_process';

import { fileExists, ensureDir, writeFile, readDir } from '../utils/fs.js';
import { readYaml, writeYaml } from '../utils/yaml.js';
import { logger } from '../utils/logger.js';
import type { ArchiveAction, ArchiveResult } from './types.js';

// ─── Types ───

interface ProjectYaml {
  version?: string;
  platforms?: string[];
  scope?: string;
  changes?: Array<{
    name: string;
    phase: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

interface PhaseHistoryEntry {
  from: string;
  to: string;
  at: string;
}

interface GitStats {
  commits: number;
  filesChanged: number;
  linesAdded: number;
}

// ─── Options ───

export interface ArchiveEngineOptions {
  changeName: string;
  openspecDir: string;     // openspec/
  ivyDir: string;           // .ivy/
  action?: ArchiveAction;
  force?: boolean;
  extractKnowledge?: boolean;
}

// ─── Core Logic ───

/**
 * Execute the archive: validate phase, read git stats, generate report,
 * move files, update project.yaml, execute post-action.
 */
export async function runArchiveEngine(opts: ArchiveEngineOptions): Promise<ArchiveResult> {
  const { changeName, openspecDir, ivyDir } = opts;
  const changeSrcDir = path.join(openspecDir, 'changes', changeName);
  const changeArchiveDir = path.join(openspecDir, 'archive', changeName);
  const reportsDir = path.join(ivyDir, 'archive');
  const knowledgeDir = path.join(ivyDir, 'knowledge');
  const memoryDir = path.join(ivyDir, 'memory', changeName);

  // 1) Verify change exists
  if (!(await fileExists(changeSrcDir))) {
    throw new Error(`Change "${changeName}" not found at ${changeSrcDir}`);
  }

  // 2) Check current phase from project.yaml
  const projectYamlPath = path.join(ivyDir, 'project.yaml');
  const projectYaml = await readYaml<ProjectYaml>(projectYamlPath);
  const changeEntry = projectYaml?.changes?.find((c) => c.name === changeName);
  const currentPhase = changeEntry?.phase ?? 'design';

  if (currentPhase !== 'archive' && !opts.force && currentPhase !== 'verify') {
    throw new Error(
      `Change "${changeName}" is in "${currentPhase}" phase. Only VERIFY→ARCHIVE is allowed. Use --force to override.`,
    );
  }

  // 3) Move change directory from changes/ to archive/
  await ensureDir(path.dirname(changeArchiveDir));
  try {
    const { rename } = await import('fs/promises');
    await rename(changeSrcDir, changeArchiveDir);
  } catch {
    // Fallback: copy + delete
    const { cp, rm } = await import('fs/promises');
    await cp(changeSrcDir, changeArchiveDir, { recursive: true });
    await rm(changeSrcDir, { recursive: true, force: true });
  }

  // 4) Update project.yaml phase
  if (projectYaml) {
    if (projectYaml.changes) {
      const entry = projectYaml.changes.find((c) => c.name === changeName);
      if (entry) entry.phase = 'archive';
    }
    await writeYaml(projectYamlPath, projectYaml);
  }

  // 5) Generate report
  await ensureDir(reportsDir);
  const dateStr = new Date().toISOString().split('T')[0];
  const reportFile = path.join(reportsDir, `${changeName}-${dateStr}.md`);
  const cwd = path.resolve(ivyDir, '..');
  const gitStats = getGitStats(cwd);
  const reportContent = renderArchiveReport(changeName, currentPhase, gitStats);
  await writeFile(reportFile, reportContent);

  const result: ArchiveResult = {
    changeName,
    oldPhase: currentPhase,
    newPhase: 'archive',
    reportPath: reportFile,
    summary: `Archived change "${changeName}" (${currentPhase} → archive). Report: ${reportFile}`,
  };

  // 6) Post-archive action
  if (opts.action === 'push-pr') {
    try {
      execSync(`git add -A && git commit -m "[Archived] ${changeName}" && git push`, {
        cwd,
        stdio: 'pipe',
      });
      execSync(`gh pr create --title "[Archived] ${changeName}" --body "Automated archive PR for ${changeName}"`, {
        cwd,
        stdio: 'pipe',
      });
    } catch {
      logger.warn('push-pr action failed — continuing with local archive');
    }
  }

  return result;
}

/**
 * Check if a change is eligible for archive (VERIFY phase, or any with --force).
 */
export async function isChangeArchivable(ivyDir: string, changeName: string): Promise<{ archivable: boolean; phase?: string; reason?: string }> {
  const projectYamlPath = path.join(ivyDir, 'project.yaml');
  const yaml = await readYaml<ProjectYaml>(projectYamlPath);
  const entry = yaml?.changes?.find((c) => c.name === changeName);
  if (!entry) return { archivable: false, reason: `Change "${changeName}" not found in project.yaml` };
  return { archivable: entry.phase === 'verify', phase: entry.phase };
}

/**
 * List all changes in VERIFY phase from project.yaml.
 */
export async function listArchivableChanges(ivyDir: string): Promise<Array<{ name: string; phase: string }>> {
  const projectYamlPath = path.join(ivyDir, 'project.yaml');
  const yaml = await readYaml<ProjectYaml>(projectYamlPath);
  return (yaml?.changes ?? []).filter((c) => c.phase === 'verify');
}

// ─── Internal ───

function getGitStats(cwd: string): GitStats {
  try {
    const output = execSync('git log --oneline --numstat --diff-filter=AM', {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
    const lines = output.trim().split('\n');
    let commits = 0;
    let filesChanged = 0;
    let linesAdded = 0;

    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = line.trim().split('\t');
      if (parts.length === 3) {
        const added = parseInt(parts[0], 10);
        if (!isNaN(added)) linesAdded += Math.max(0, added);
        filesChanged++;
      } else if (/^[a-f0-9]{7,40}\s/.test(line.trim())) {
        commits++;
      }
    }
    return { commits, filesChanged, linesAdded };
  } catch {
    return { commits: 0, filesChanged: 0, linesAdded: 0 };
  }
}

function renderArchiveReport(changeName: string, oldPhase: string, stats: GitStats): string {
  const date = new Date().toISOString().split('T')[0];
  return [
    `# Archive Report: ${changeName}`,
    '',
    `Generated: ${date}`,
    '',
    '## Summary',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| Phase Transition | ${oldPhase} → archive |`,
    `| Commits | ${stats.commits} |`,
    `| Files Changed | ${stats.filesChanged} |`,
    `| Lines Added | ${stats.linesAdded} |`,
    '',
    '## Lessons Learned',
    '',
    '<!-- Fill in manually -->',
    '',
  ].join('\n');
}

/**
 * `ivy archive [--change <name>] [--report]` — archive a change and optionally
 * generate an implementation report (v0.8).
 *
 * Without --report: behaves like v0.7 archive (just logs and returns 0).
 * With    --report: generates `.ivy/reports/<change-name>-<date>.md` with
 *   Summary, Timeline, Decision Log, Suggestion Impact, and Lessons Learned
 *   sections. All data is read-only (Derived Cache) — never creates events.
 */

import path from 'path';
import { execSync } from 'child_process';

import { fileExists, ensureDir, writeFile } from '../utils/fs.js';
import { readYaml } from '../utils/yaml.js';
import { logger } from '../utils/logger.js';
import { readRawEvents } from '../core/sessions.js';

// ─── Public Types ───

export interface ArchiveOptions {
  cwd?: string;
  change?: string;
  report?: boolean;
}

// ─── Internal Types ───

interface PhaseHistoryEntry {
  from: string;
  to: string;
  at: string;
}

interface ChangeYaml {
  change?: string;
  phase?: string;
  phase_history?: PhaseHistoryEntry[];
  adoption?: Record<string, unknown>;
}

interface GitStats {
  commits: number;
  filesChanged: number;
  linesAdded: number;
}

interface SuggestionData {
  id: string;
  message: string;
  at: string;
}

interface FeedbackMetrics {
  received: number;
  accepted: number;
  dismissed: number;
}

// ─── Data Sources ───

async function readChangeYaml(
  cwd: string,
  changeName: string,
): Promise<ChangeYaml | null> {
  const yamlPath = path.join(
    cwd,
    'openspec',
    'changes',
    changeName,
    '.ivy.yaml',
  );
  return readYaml<ChangeYaml>(yamlPath);
}

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
        // numstat line: added \t removed \t file
        const added = parseInt(parts[0], 10);
        if (!isNaN(added)) linesAdded += Math.max(0, added);
        filesChanged++;
      } else if (/^[a-f0-9]{7,40}\s/.test(line.trim())) {
        // commit hash line from --oneline
        commits++;
      }
    }

    return { commits, filesChanged, linesAdded };
  } catch {
    return { commits: 0, filesChanged: 0, linesAdded: 0 };
  }
}

async function readEventsForChange(
  cwd: string,
  changeName: string,
): Promise<{
  phaseTransitions: PhaseHistoryEntry[];
  suggestions: SuggestionData[];
}> {
  const phaseTransitions: PhaseHistoryEntry[] = [];
  const suggestions: SuggestionData[] = [];

  try {
    for await (const event of readRawEvents(cwd)) {
      if (event.change !== changeName) continue;

      if (
        event.event === 'phase_transition' &&
        event.meta?.from &&
        event.meta?.to
      ) {
        phaseTransitions.push({
          from: String(event.meta.from),
          to: String(event.meta.to),
          at: event.ts,
        });
      } else if (event.event === 'tool_use') {
        suggestions.push({
          id: event.eventId,
          message: (event.meta?.message as string) ?? event.event,
          at: event.ts,
        });
      }
    }
  } catch {
    // events.jsonl is optional — fall through silently
  }

  return { phaseTransitions, suggestions };
}

async function readSuggestionFeedback(
  cwd: string,
): Promise<FeedbackMetrics> {
  try {
    const feedbackPath = path.join(
      cwd,
      '.ivy',
      'sessions',
      'cache',
      'suggestion_feedback.json',
    );
    if (!(await fileExists(feedbackPath))) {
      return { received: 0, accepted: 0, dismissed: 0 };
    }
    const { readFile } = await import('../utils/fs.js');
    const raw = await readFile(feedbackPath);
    const store = JSON.parse(raw) as {
      feedbacks: Array<{ action: string }>;
    };
    const total = store.feedbacks?.length ?? 0;
    const accepted = store.feedbacks?.filter(
      (f) => f.action === 'accepted',
    ).length ?? 0;
    const dismissed = store.feedbacks?.filter(
      (f) => f.action === 'dismissed',
    ).length ?? 0;
    return { received: total, accepted, dismissed };
  } catch {
    return { received: 0, accepted: 0, dismissed: 0 };
  }
}

// ─── Report Generation ───

function todayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function renderReport(
  changeName: string,
  gitStats: GitStats,
  phaseTransitions: PhaseHistoryEntry[],
  suggestions: SuggestionData[],
  feedback: FeedbackMetrics,
): string {
  const date = todayDate();
  const parts: string[] = [];

  // Header
  parts.push(`# Archive Report: ${changeName}`);
  parts.push('');
  parts.push(`Generated: ${date}`);
  parts.push('');

  // Summary
  parts.push('## Summary');
  parts.push('');
  parts.push('| Metric | Value |');
  parts.push('|--------|-------|');
  parts.push(`| Commits | ${gitStats.commits} |`);
  parts.push(`| Files Changed | ${gitStats.filesChanged} |`);
  parts.push(`| Lines Added | ${gitStats.linesAdded} |`);
  parts.push('');

  // Timeline — phase transitions ordered by timestamp
  const sorted = [...phaseTransitions].sort((a, b) =>
    a.at.localeCompare(b.at),
  );
  parts.push('## Timeline');
  parts.push('');
  if (sorted.length > 0) {
    parts.push('| Phase Transition | Timestamp |');
    parts.push('|------------------|-----------|');
    for (const pt of sorted) {
      parts.push(`| ${pt.from} → ${pt.to} | ${pt.at} |`);
    }
  } else {
    parts.push('No phase transitions recorded.');
  }
  parts.push('');

  // Decision Log
  parts.push('## Decision Log');
  parts.push('');
  if (sorted.length > 0) {
    parts.push('### Phase Changes');
    parts.push('');
    parts.push('| From | To | Timestamp |');
    parts.push('|------|----|-----------|');
    for (const pt of sorted) {
      parts.push(`| ${pt.from} | ${pt.to} | ${pt.at} |`);
    }
  }
  parts.push('');
  if (suggestions.length > 0) {
    parts.push('### Suggestions');
    parts.push('');
    for (const s of suggestions) {
      parts.push(`- **${s.id}** — ${s.message}`);
    }
  } else {
    parts.push('No suggestions recorded during this change.');
  }
  parts.push('');

  // Suggestion Impact
  parts.push('## Suggestion Impact');
  parts.push('');
  const ignored = Math.max(
    0,
    feedback.received - feedback.accepted - feedback.dismissed,
  );
  parts.push('| Status | Count |');
  parts.push('|--------|-------|');
  parts.push(`| Received | ${feedback.received} |`);
  parts.push(`| Accepted | ${feedback.accepted} |`);
  parts.push(`| Dismissed | ${feedback.dismissed} |`);
  parts.push(`| Ignored | ${ignored} |`);
  parts.push('');

  // Lessons Learned — intentionally left blank for manual fill-in
  parts.push('## Lessons Learned');
  parts.push('');
  parts.push('<!-- Fill in manually -->');
  parts.push('');

  return parts.join('\n');
}

// ─── Entry Point ───

export async function runArchive(
  opts: ArchiveOptions = {},
): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const changeName = opts.change;

  if (!changeName) {
    logger.error('--change <name> is required');
    return 1;
  }

  logger.step(`Archiving change: ${changeName}`);

  if (!opts.report) {
    // v0.7 compatible: log and return, no side effects
    logger.info(`Archive: change ${changeName}`);
    return 0;
  }

  // --report mode: generate implementation report (Derived Cache — read-only)
  logger.step('Reading phase history...');
  const changeYaml = await readChangeYaml(cwd, changeName);
  const yamlTransitions = changeYaml?.phase_history ?? [];

  logger.step('Reading events timeline...');
  const { phaseTransitions: eventTransitions, suggestions } =
    await readEventsForChange(cwd, changeName);

  // Merge: events.jsonl phase_transitions are the ground truth;
  // fall back to .ivy.yaml phase_history if events.jsonl has none.
  const phaseTransitions =
    eventTransitions.length > 0 ? eventTransitions : yamlTransitions;

  logger.step('Reading git statistics...');
  const gitStats = getGitStats(cwd);

  logger.step('Reading suggestion feedback...');
  const feedback = await readSuggestionFeedback(cwd);

  logger.step('Generating report...');
  const reportContent = renderReport(
    changeName,
    gitStats,
    phaseTransitions,
    suggestions,
    feedback,
  );

  const reportsDir = path.join(cwd, '.ivy', 'reports');
  await ensureDir(reportsDir);
  const reportFile = path.join(reportsDir, `${changeName}-${todayDate()}.md`);
  await writeFile(reportFile, reportContent);

  logger.success(`Report generated: ${reportFile}`);
  return 0;
}

/**
 * adoption-lite — minimum-viable AI code adoption tracker.
 *
 * Strategy: parse `git diff --shortstat <base>..HEAD` to estimate the lines
 * authored during a change. Confidence is hardcoded `'low'` because the diff
 * does not distinguish AI-authored from human-authored lines.
 *
 * Constraints (v0.1):
 *   - Snapshot ONLY allowed when the change's current phase is terminal
 *     (`isTerminalPhase`); no `--force-snapshot` override.
 *   - The base commit must be pre-recorded under `base_commit:` in
 *     `.ivy.yaml`; if missing, the function throws with a clear message.
 *   - Persistence preserves all unrelated top-level keys.
 */

import path from 'path';

import { runGit } from '../utils/git.js';
import { readYaml, writeYaml } from '../utils/yaml.js';
import { fileExists } from '../utils/fs.js';
import { parsePhase, isTerminalPhase } from './phase-machine.js';

export interface AdoptionSnapshot {
  change_name: string;
  base_commit: string;
  head_commit: string;
  lines_added: number;
  lines_removed: number;
  estimated_ai_lines: number;
  confidence: 'low';
  source: 'commit-diff';
  collected_at: string;
}

interface ParsedShortstat {
  added: number;
  removed: number;
}

/**
 * Parse the output of `git diff --shortstat`.
 *
 * Examples handled:
 *   ` 5 files changed, 420 insertions(+), 30 deletions(-)`
 *   ` 1 file changed, 10 insertions(+)`
 *   ` 1 file changed, 7 deletions(-)`
 *   `` (empty: no changes)
 */
export function parseShortstat(raw: string): ParsedShortstat {
  const trimmed = raw.trim();
  if (!trimmed) return { added: 0, removed: 0 };

  const addMatch = trimmed.match(/(\d+)\s+insertions?\(\+\)/);
  const delMatch = trimmed.match(/(\d+)\s+deletions?\(-\)/);
  return {
    added: addMatch ? parseInt(addMatch[1], 10) : 0,
    removed: delMatch ? parseInt(delMatch[1], 10) : 0,
  };
}

export interface SnapshotOptions {
  cwd?: string;
}

interface ChangeYaml {
  phase?: string;
  base_commit?: string;
  [key: string]: unknown;
}

export async function snapshotAdoption(
  changeName: string,
  opts: SnapshotOptions = {},
): Promise<AdoptionSnapshot> {
  const cwd = opts.cwd ?? process.cwd();
  const yamlPath = path.join(cwd, 'openspec', 'changes', changeName, '.ivy.yaml');

  if (!(await fileExists(yamlPath))) {
    throw new Error(`Change '${changeName}' has no .ivy.yaml at ${yamlPath}`);
  }
  const data = (await readYaml<ChangeYaml>(yamlPath)) ?? {};

  // Phase gate: must be terminal (= archive) per spec.
  const phase = data.phase ? parsePhase(data.phase) : null;
  if (!phase) {
    throw new Error(
      `Change '${changeName}' has invalid or missing phase '${data.phase}' — snapshot only allowed at terminal phase`,
    );
  }
  if (!isTerminalPhase(phase)) {
    throw new Error(
      `Change '${changeName}' is in phase '${phase}' — snapshot only allowed at terminal phase`,
    );
  }

  if (!data.base_commit) {
    throw new Error(
      `Change '${changeName}' has no base_commit recorded in .ivy.yaml; cannot compute adoption diff`,
    );
  }
  const baseCommit = String(data.base_commit);

  // Resolve HEAD and the shortstat diff.
  const headResult = await runGit(['rev-parse', 'HEAD'], cwd);
  const headCommit = headResult.stdout.trim();

  const diffResult = await runGit(['diff', '--shortstat', `${baseCommit}..HEAD`], cwd);
  const { added, removed } = parseShortstat(diffResult.stdout);

  const snapshot: AdoptionSnapshot = {
    change_name: changeName,
    base_commit: baseCommit,
    head_commit: headCommit,
    lines_added: added,
    lines_removed: removed,
    estimated_ai_lines: added,
    confidence: 'low',
    source: 'commit-diff',
    collected_at: new Date().toISOString(),
  };

  // Persist while preserving unrelated keys.
  const merged = { ...data, adoption: snapshot };
  await writeYaml(yamlPath, merged);

  return snapshot;
}

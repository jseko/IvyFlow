/**
 * Git Watch — file-level event generation (experimental, v0.6).
 *
 * Generates file_save events from git diff-tree output.
 * NO file content is read or stored per §9.11.
 */

import { execSync } from 'child_process';
import { statSync } from 'fs';
import path from 'path';

import { appendRawEvent, generateEventId, type RawEvent } from './sessions.js';

export interface FileSaveEventMeta {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  commitHash: string;
  fileSize: number;
  insertions: number;
  deletions: number;
}

export interface GitWatchOptions {
  cwd: string;
  change: string;
  since?: string;  // commit hash to diff from
}

/**
 * Run `git diff-tree --name-status` to detect changed files and emit file_save events.
 * Returns count of events emitted.
 */
export async function emitFileSaveEvents(opts: GitWatchOptions): Promise<number> {
  const { cwd, change, since = 'HEAD~1' } = opts;
  let count = 0;

  try {
    const commitHash = execSync('git rev-parse HEAD', { cwd, encoding: 'utf-8' }).trim();

    // Get file status summary
    const stats = execSync(`git diff --shortstat ${since} HEAD 2>/dev/null || echo ""`, { cwd, encoding: 'utf-8' }).trim();
    const insertions = parseInt(stats.match(/(\d+) insertion/)?.[1] ?? '0', 10);
    const deletions = parseInt(stats.match(/(\d+) deletion/)?.[1] ?? '0', 10);

    // Get changed files list with status
    const output = execSync(`git diff-tree --no-commit-id --name-status -r ${since} HEAD 2>/dev/null || git diff-tree --no-commit-id --name-status -r HEAD 2>/dev/null`, { cwd, encoding: 'utf-8' }).trim();

    if (!output) return 0;

    for (const line of output.split('\n')) {
      if (!line.trim()) continue;
      const parts = line.split('\t');
      if (parts.length < 2) continue;

      const statusChar = parts[0];
      const filePath = parts.slice(1).join('\t'); // handle tabs in paths

      // Map status character
      let status: FileSaveEventMeta['status'];
      switch (statusChar) {
        case 'A': status = 'added'; break;
        case 'D': status = 'deleted'; break;
        case 'M': status = 'modified'; break;
        case 'R': status = 'renamed'; break;
        default: status = 'modified';
      }

      let fileSize = 0;
      try {
        const fullPath = path.join(cwd, filePath);
        fileSize = statSync(fullPath).size;
      } catch {
        // file may have been deleted
      }

      const event: RawEvent = {
        ts: new Date().toISOString(),
        eventId: generateEventId(),
        change,
        event: 'file_save',
        source: 'git-hook',
        meta: {
          path: filePath,
          status,
          commitHash,
          fileSize,
          insertions,
          deletions,
        },
      };

      await appendRawEvent(cwd, event);
      count++;
    }
  } catch {
    // best-effort: failures are silently tolerated
  }

  return count;
}

/**
 * Detect if git watch is enabled via env var or project flag.
 */
export function isGitWatchEnabled(): boolean {
  return process.env.IVY_GIT_WATCH === '1' || process.env.IVY_GIT_WATCH === 'true';
}

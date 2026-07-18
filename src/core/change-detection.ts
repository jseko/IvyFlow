/**
 * change-detection — resolve the "current" OpenSpec change from the checkout.
 *
 * Previously duplicated in `commands/state.ts` and `commands/guard.ts`. The
 * lifecycle state file now lives at `openspec/changes/<name>/.ivy.yaml`, so this
 * helper picks the change whose `.ivy.yaml` was most recently written (the
 * active change), falling back to the most recently modified change directory.
 *
 * Synchronous on purpose: it is called from `getStatePath` inside the
 * low-level state module, which must stay free of async bootstrap overhead.
 */

import path from 'path';
import { existsSync, readdirSync, statSync } from 'fs';

const CHANGES_ROOT = path.join('openspec', 'changes');

/**
 * Resolve the current change name, or null when no active change exists.
 */
export function detectCurrentChangeSync(cwd: string): string | null {
  const changesRoot = path.join(cwd, CHANGES_ROOT);
  let entries: string[];
  try {
    entries = readdirSync(changesRoot).filter((e) => !e.startsWith('.') && e !== 'archive');
  } catch {
    return null;
  }
  if (entries.length === 0) return null;

  // Prefer the change whose .ivy.yaml was most recently written (the active one).
  let latestByState: string | null = null;
  let latestStateTime = 0;
  for (const name of entries) {
    const ivyPath = path.join(changesRoot, name, '.ivy.yaml');
    try {
      if (existsSync(ivyPath)) {
        const m = statSync(ivyPath).mtimeMs;
        if (m > latestStateTime) {
          latestStateTime = m;
          latestByState = name;
        }
      }
    } catch {
      // ignore unreadable entry
    }
  }
  if (latestByState) return latestByState;

  // Fallback: most recently modified change directory.
  let latestByDir: string | null = null;
  let latestDirTime = 0;
  for (const name of entries) {
    try {
      const m = statSync(path.join(changesRoot, name)).mtimeMs;
      if (m > latestDirTime) {
        latestDirTime = m;
        latestByDir = name;
      }
    } catch {
      // ignore unreadable entry
    }
  }
  return latestByDir;
}

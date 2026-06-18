/**
 * Knowledge Sync — Experimental reference sync for KB files.
 *
 * v0.11: Writes `<!-- ivy:managed -->` marker + reference line to
 * CLAUDE.md / CURSOR.md / WINDSURF.md. Never generates configuration content.
 * Idempotent: existing managed markers cause skip.
 */

import path from 'path';
import { promises as fs } from 'fs';
import { fileExists } from '../utils/fs.js';

// ─── Constants ───

const MANAGED_MARKER = '<!-- ivy:managed -->';
const REFERENCE_LINE =
  'IvyFlow managed. See `.ivy/project.yaml` for workflow configuration. Do not edit this section manually.';

// ─── Config ───

export interface KbFileSyncConfig {
  filePath: string;
}

export interface KbSyncResult {
  filePath: string;
  action: 'created' | 'synced' | 'skipped' | 'error';
  error?: string;
}

// ─── Sync ───

/**
 * Sync the managed marker + reference line into a KB file.
 * Idempotent: skips if `<!-- ivy:managed -->` already present.
 */
export async function syncReference(config: KbFileSyncConfig): Promise<KbSyncResult> {
  const { filePath } = config;

  try {
    if (!(await fileExists(filePath))) {
      // Create new file
      await fs.writeFile(filePath, `${MANAGED_MARKER}\n\n${REFERENCE_LINE}\n`, 'utf-8');
      return { filePath, action: 'created' };
    }

    const content = await fs.readFile(filePath, 'utf-8');

    if (content.includes(MANAGED_MARKER)) {
      return { filePath, action: 'skipped' };
    }

    // Append marker + reference
    const newContent = `${content.trimEnd()}\n\n${MANAGED_MARKER}\n${REFERENCE_LINE}\n`;
    await fs.writeFile(filePath, newContent, 'utf-8');
    return { filePath, action: 'synced' };
  } catch (err) {
    return { filePath, action: 'error', error: (err as Error).message };
  }
}

/**
 * Sync references for all installed platforms in a project.
 * Platform KB file mapping:
 *   claude → CLAUDE.md
 *   cursor → CURSOR.md
 *   windsurf → WINDSURF.md
 */
export async function syncReferencesForProject(
  projectPath: string,
  platformIds: string[],
): Promise<KbSyncResult[]> {
  const platformFileMap: Record<string, string> = {
    claude: 'CLAUDE.md',
    cursor: 'CURSOR.md',
    windsurf: 'WINDSURF.md',
  };

  const results: KbSyncResult[] = [];
  const seen = new Set<string>();

  for (const id of platformIds) {
    const fileName = platformFileMap[id];
    if (!fileName || seen.has(fileName)) continue;
    seen.add(fileName);

    const filePath = path.join(projectPath, fileName);
    const result = await syncReference({ filePath });
    results.push(result);
  }

  return results;
}

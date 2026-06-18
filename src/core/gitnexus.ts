/**
 * GitNexus Overlay — optional external intelligence layer.
 *
 * Zero coupling to core analytics:
 *   - Never writes to events.jsonl
 *   - Never modifies analytics.ts aggregates
 *   - Real-time query only, no caching
 *
 * Design constraint (design.md D4): external tool failure must not break dashboard.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface GitNexusOverlay {
  visible: boolean;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  affectedProcesses: string[];
  affectedModules: string[];
  error?: string;
}

export async function isGitNexusInstalled(): Promise<boolean> {
  try {
    await execFileAsync('gitnexus', ['--version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function execGitNexus(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('gitnexus', args, { timeout: 15000 });
  return stdout;
}

export async function queryGitNexusOverlay(
  _projectPath: string,
  changeName: string,
): Promise<GitNexusOverlay> {
  if (!(await isGitNexusInstalled())) {
    return { visible: false, risk: null, affectedProcesses: [], affectedModules: [] };
  }

  try {
    const result = await execGitNexus(['detect-changes', '--change', changeName, '--json']);
    const parsed = JSON.parse(result) as Record<string, unknown>;
    return {
      visible: true,
      risk: (parsed.risk as GitNexusOverlay['risk']) ?? null,
      affectedProcesses: Array.isArray(parsed.affectedProcesses) ? (parsed.affectedProcesses as string[]) : [],
      affectedModules: Array.isArray(parsed.affectedModules) ? (parsed.affectedModules as string[]) : [],
    };
  } catch (err) {
    return {
      visible: true,
      risk: null,
      affectedProcesses: [],
      affectedModules: [],
      error: err instanceof Error ? err.message : 'GitNexus query failed',
    };
  }
}

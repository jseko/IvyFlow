/**
 * Git pre-push hook installer — secondary defense layer.
 *
 * Copies `assets/hooks/ivy-git-prepush.sh` to `<gitDir>/hooks/pre-push` and
 * sets it executable (0755). When the project has no `.git/` directory the
 * function is a no-op (returns `installed: false, reason: 'no-git'`).
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';

import { fileExists, ensureDir, readFile, writeFile, chmod } from '../utils/fs.js';
import { resolveGitDir, isGitRepo } from '../utils/git.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

declare global {
  var __ivyflow_assets: Record<string, string> | undefined;
}

function readHookAsset(filename: string): string {
  const assets = globalThis.__ivyflow_assets;
  if (assets) {
    const target = 'hooks/' + filename;
    for (const key of Object.keys(assets)) {
      if (key === target || key.endsWith('/' + target)) {
        return assets[key];
      }
    }
    throw new Error(`Embedded hook not found: ${filename}`);
  }
  const srcPath = path.join(path.resolve(__dirname, '..', '..', 'assets'), 'hooks', filename);
  if (!existsSync(srcPath)) {
    throw new Error(`Hook source not found: ${srcPath}`);
  }
  return readFileSync(srcPath, 'utf-8');
}

export type HookInstallResult =
  | { installed: true; path: string }
  | { installed: false; reason: 'no-git' | 'skipped-existing'; path?: string };

const PRE_PUSH_HOOK_NAME = 'pre-push';
const PRE_PUSH_HOOK_SOURCE = 'ivy-git-prepush.sh';

export const HOOK_START_MARKER = '# === IvyFlow pre-push hook — auto-generated ===';
export const HOOK_END_MARKER = '# === IvyFlow pre-push hook END ===';

/**
 * Install a hook file with marker-based injection.
 *
 * When the destination already exists and overwrite=true:
 * - If both markers exist → replaces the IvyFlow section between them
 * - If markers are absent → appends the IvyFlow section at the end
 * When the destination does not exist, creates it with markers.
 */
async function installHookWithMarkers(
  destPath: string,
  content: string,
  startMarker: string,
  endMarker: string,
  overwrite: boolean,
): Promise<HookInstallResult> {
  const wrapped = `${startMarker}\n${content}\n${endMarker}\n`;

  if (!overwrite && (await fileExists(destPath))) {
    return { installed: false, reason: 'skipped-existing', path: destPath };
  }

  await ensureDir(path.dirname(destPath));

  // If file doesn't exist yet, write fresh.
  if (!(await fileExists(destPath))) {
    await writeFile(destPath, wrapped);
    await chmod(destPath, 0o755);
    return { installed: true, path: destPath };
  }

  // File exists and overwrite=true — inject or append.
  const existing = await readFile(destPath);

  // Try to find existing markers and replace the IvyFlow section.
  const startIdx = existing.indexOf(startMarker);
  const endIdx = existing.indexOf(endMarker);

  if (startIdx !== -1 && endIdx !== -1) {
    // Replace content between markers (inclusive).
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + endMarker.length);
    const updated = `${before}${startMarker}\n${content}\n${endMarker}${after}`;
    await writeFile(destPath, updated);
  } else {
    // No markers found — append.
    await writeFile(destPath, existing + '\n' + wrapped);
  }

  await chmod(destPath, 0o755);
  return { installed: true, path: destPath };
}

export async function installGitPrePushHook(
  projectRoot: string,
  overwrite: boolean,
): Promise<HookInstallResult> {
  if (!(await isGitRepo(projectRoot))) {
    return { installed: false, reason: 'no-git' };
  }

  const gitDir = await resolveGitDir(projectRoot);
  if (!gitDir) {
    return { installed: false, reason: 'no-git' };
  }

  const hooksDir = path.join(gitDir, 'hooks');
  const destPath = path.join(hooksDir, PRE_PUSH_HOOK_NAME);

  const content = await readHookAsset(PRE_PUSH_HOOK_SOURCE);
  return installHookWithMarkers(destPath, content, HOOK_START_MARKER, HOOK_END_MARKER, overwrite);
}

const POST_COMMIT_HOOK_NAME = 'post-commit';
const POST_COMMIT_HOOK_SOURCE = 'ivy-session-tracker.sh';

export const POST_COMMIT_START_MARKER = '# === IvyFlow post-commit hook — auto-generated ===';
export const POST_COMMIT_END_MARKER = '# === IvyFlow post-commit hook END ===';

/**
 * Install the post-commit hook for L1 session event tracking (v0.4 analytics).
 * Best-effort: failures are logged but do not block init.
 */
export async function installGitPostCommitHook(
  projectRoot: string,
  overwrite: boolean,
): Promise<HookInstallResult> {
  if (!(await isGitRepo(projectRoot))) {
    return { installed: false, reason: 'no-git' };
  }

  const gitDir = await resolveGitDir(projectRoot);
  if (!gitDir) {
    return { installed: false, reason: 'no-git' };
  }

  const hooksDir = path.join(gitDir, 'hooks');
  const destPath = path.join(hooksDir, POST_COMMIT_HOOK_NAME);

  const content = await readHookAsset(POST_COMMIT_HOOK_SOURCE);
  return installHookWithMarkers(destPath, content, POST_COMMIT_START_MARKER, POST_COMMIT_END_MARKER, overwrite);
}

/**
 * Git pre-push hook installer — secondary defense layer.
 *
 * Copies `assets/hooks/ivy-git-prepush.sh` to `<gitDir>/hooks/pre-push` and
 * sets it executable (0755). When the project has no `.git/` directory the
 * function is a no-op (returns `installed: false, reason: 'no-git'`).
 */

import path from 'path';

import { fileExists, ensureDir, readFile, writeFile, chmod } from '../utils/fs.js';
import { resolveGitDir, isGitRepo } from '../utils/git.js';
import { getAssetsDir } from './skills.js';

export type HookInstallResult =
  | { installed: true; path: string }
  | { installed: false; reason: 'no-git' | 'skipped-existing'; path?: string };

const PRE_PUSH_HOOK_NAME = 'pre-push';
const PRE_PUSH_HOOK_SOURCE = 'ivy-git-prepush.sh';

export const HOOK_START_MARKER = '# === IvyFlow pre-push hook — auto-generated ===';
export const HOOK_END_MARKER = '# === IvyFlow pre-push hook END ===';

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

  if (!overwrite && (await fileExists(destPath))) {
    return { installed: false, reason: 'skipped-existing', path: destPath };
  }

  const srcPath = path.join(getAssetsDir(), 'hooks', PRE_PUSH_HOOK_SOURCE);
  if (!(await fileExists(srcPath))) {
    throw new Error(`Hook source not found: ${srcPath}`);
  }

  await ensureDir(hooksDir);
  const content = await readFile(srcPath);
  const wrapped = `${HOOK_START_MARKER}\n${content}\n${HOOK_END_MARKER}\n`;
  await writeFile(destPath, wrapped);
  await chmod(destPath, 0o755);

  return { installed: true, path: destPath };
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

  if (!overwrite && (await fileExists(destPath))) {
    return { installed: false, reason: 'skipped-existing', path: destPath };
  }

  const srcPath = path.join(getAssetsDir(), 'hooks', POST_COMMIT_HOOK_SOURCE);
  if (!(await fileExists(srcPath))) {
    throw new Error(`Hook source not found: ${srcPath}`);
  }

  await ensureDir(hooksDir);
  const content = await readFile(srcPath);
  const wrapped = `${POST_COMMIT_START_MARKER}\n${content}\n${POST_COMMIT_END_MARKER}\n`;
  await writeFile(destPath, wrapped);
  await chmod(destPath, 0o755);

  return { installed: true, path: destPath };
}

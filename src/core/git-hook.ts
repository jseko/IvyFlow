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

const HOOK_NAME = 'pre-push';
const HOOK_SOURCE = 'ivy-git-prepush.sh';

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
  const destPath = path.join(hooksDir, HOOK_NAME);

  if (!overwrite && (await fileExists(destPath))) {
    return { installed: false, reason: 'skipped-existing', path: destPath };
  }

  const srcPath = path.join(getAssetsDir(), 'hooks', HOOK_SOURCE);
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

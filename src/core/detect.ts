/**
 * Platform detection — v0.1 returns the single supported platform when its
 * skills dir already exists in the project, otherwise defaults to it.
 */

import path from 'path';
import { fileExists } from '../utils/fs.js';
import { PLATFORMS, type Platform } from './platforms.js';

/**
 * Detect the active platform in `projectPath`. v0.1 only ships Claude Code,
 * so this returns it whether or not `.claude/` exists. Returns the same shape
 * Comet uses so the call site can stay consistent across versions.
 */
export async function detectPlatform(
  projectPath: string,
): Promise<{ platform: Platform; detected: boolean }> {
  const claude = PLATFORMS[0];
  const detected = await fileExists(path.join(projectPath, claude.skillsDir));
  return { platform: claude, detected };
}

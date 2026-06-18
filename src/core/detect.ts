/**
 * Platform detection — v0.8 scans all 16 platforms via Platform.detectionPaths.
 *   1.0 = settings/config file hit (e.g. .claude/settings.json)
 *   0.8 = explicit rules dir hit  (e.g. .cursor/rules)
 *   0.6 = generic dir hit         (e.g. .github/, may exist for Actions only)
 *
 * No DetectionStrategy interface, no git history, no network — design.md §9.2.
 * No fallback table: every platform carries its own detectionPaths (v0.8 migration).
 */

import path from 'path';
import { fileExists } from '../utils/fs.js';
import { PLATFORMS, type Platform, getPlatformById } from './platforms.js';

export type Confidence = 1.0 | 0.8 | 0.6;

export interface PlatformDetectResult {
  platform: Platform;
  detected: boolean;
  confidence: Confidence;
  matchedPath: string;
}

interface PathCheck {
  /** Path relative to the project root. */
  rel: string;
  confidence: Confidence;
}

async function probe(projectPath: string, checks: PathCheck[]): Promise<{ matchedPath: string; confidence: Confidence } | null> {
  for (const check of checks) {
    const abs = path.join(projectPath, check.rel);
    if (await fileExists(abs)) {
      return { matchedPath: check.rel, confidence: check.confidence };
    }
  }
  return null;
}

/**
 * Detect all 16 platforms in a project. Returns one result per platform; entries
 * with `detected: false` retain the lowest confidence value (0.6) as a default
 * placeholder — callers MUST gate on `detected` before reading confidence.
 *
 * Each platform defines its own detectionPaths — no fallback table needed.
 */
export async function detectPlatforms(projectPath: string): Promise<PlatformDetectResult[]> {
  const results: PlatformDetectResult[] = [];
  for (const platform of PLATFORMS) {
    const checks = platform.detectionPaths;
    if (!checks || checks.length === 0) {
      results.push({ platform, detected: false, confidence: 0.6, matchedPath: '' });
      continue;
    }
    const hit = await probe(projectPath, checks);
    if (hit) {
      results.push({ platform, detected: true, confidence: hit.confidence, matchedPath: hit.matchedPath });
    } else {
      results.push({ platform, detected: false, confidence: 0.6, matchedPath: '' });
    }
  }
  return results;
}

/**
 * v0.1-compatible single-platform detection. Always returns Claude Code.
 * Kept so existing call sites (init quick mode etc.) keep working unchanged.
 */
export async function detectPlatform(
  projectPath: string,
): Promise<{ platform: Platform; detected: boolean }> {
  const claude = getPlatformById('claude');
  if (!claude) throw new Error('claude platform missing from PLATFORMS');
  const detected = await fileExists(path.join(projectPath, claude.skillsDir));
  return { platform: claude, detected };
}

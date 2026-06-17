/**
 * Platform detection — v0.2 scans all 7 platforms with three-layer confidence:
 *   1.0 = settings/config file hit (e.g. .claude/settings.json)
 *   0.8 = explicit rules dir hit  (e.g. .cursor/rules)
 *   0.6 = generic dir hit         (e.g. .github/, may exist for Actions only)
 *
 * No DetectionStrategy interface, no git history, no network — design.md §9.2.
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

/**
 * Per-platform probe paths in priority order. First match wins → that confidence
 * is reported. Order MUST be: 1.0 (config) → 0.8 (rules dir) → 0.6 (generic).
 *
 * Hardcoded by design (D3): no continuous float scoring, no strategy registry.
 */
export const CONFIDENCE_BY_PATH: Record<string, PathCheck[]> = {
  claude: [
    { rel: '.claude/settings.json', confidence: 1.0 },
    { rel: '.claude/settings.local.json', confidence: 1.0 },
    { rel: '.claude/skills', confidence: 0.8 },
    { rel: '.claude', confidence: 0.6 },
  ],
  cursor: [
    { rel: '.cursor/settings.json', confidence: 1.0 },
    { rel: '.cursor/rules', confidence: 0.8 },
    { rel: '.cursor', confidence: 0.6 },
  ],
  'github-copilot': [
    { rel: '.github/copilot-instructions.md', confidence: 1.0 },
    { rel: '.github', confidence: 0.6 },
  ],
  windsurf: [
    { rel: '.windsurf/settings.json', confidence: 1.0 },
    { rel: '.windsurf/rules', confidence: 0.8 },
    { rel: '.windsurf', confidence: 0.6 },
  ],
  codebuddy: [
    { rel: '.codebuddy/rules', confidence: 0.8 },
    { rel: '.codebuddy', confidence: 0.6 },
  ],
  trae: [
    { rel: '.trae/rules/project_rules.md', confidence: 1.0 },
    { rel: '.trae/rules', confidence: 0.8 },
    { rel: '.trae', confidence: 0.6 },
  ],
  qoder: [
    { rel: '.qoder/rules', confidence: 0.8 },
    { rel: '.qoder', confidence: 0.6 },
  ],
};

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
 * Detect all 7 platforms in a project. Returns one result per platform; entries
 * with `detected: false` retain the lowest confidence value (0.6) as a default
 * placeholder — callers MUST gate on `detected` before reading confidence.
 */
export async function detectPlatforms(projectPath: string): Promise<PlatformDetectResult[]> {
  const results: PlatformDetectResult[] = [];
  for (const platform of PLATFORMS) {
    const checks = CONFIDENCE_BY_PATH[platform.id] ?? [];
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

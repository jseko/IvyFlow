/**
 * Platform Health Report — v0.8 read-only health assessment.
 *
 * Computes per-platform installation status across all 16 platforms:
 * detection, skills, rules, and hooks. Drives `ivy doctor --platforms`.
 *
 * Read-only by design (§9.4): never creates, modifies, or deletes files.
 */

import path from 'path';
import { PLATFORMS, type Platform, type PlatformCertification } from './platforms.js';
import { detectPlatforms } from './detect.js';
import { getManifestSkills } from './skills.js';
import { fileExists } from '../utils/fs.js';
import { logger } from '../utils/logger.js';

export interface PlatformHealthEntry {
  id: string;
  name: string;
  /** Platform's own certification level when detected; 'not_detected' otherwise. */
  certification: PlatformCertification | 'not_detected';
  detected: boolean;
  /** Detection confidence (0 for non-detected platforms). */
  confidence: number;
  skillsInstalled: boolean;
  rulesInstalled: boolean;
  /** null for platforms without hook support. */
  hooksInstalled: boolean | null;
}

export interface PlatformHealthReport {
  totalPlatforms: number;
  certifiedPlatforms: number;
  experimentalPlatforms: number;
  detectedPlatforms: number;
  platforms: PlatformHealthEntry[];
}

/**
 * Check whether ALL manifest skill files exist at the platform's skills directory.
 */
async function checkSkillsInstalled(
  projectPath: string,
  platform: Platform,
  manifestSkills: string[],
): Promise<boolean> {
  if (manifestSkills.length === 0) return false;
  const checks = manifestSkills.map(async (relPath) => {
    const p = path.join(projectPath, platform.skillsDir, 'skills', relPath);
    return fileExists(p);
  });
  const results = await Promise.all(checks);
  return results.every(Boolean);
}

/**
 * Resolve the expected rule file path for a given rule name on a given platform.
 * Mirrors the resolution logic in skills.ts `resolveRuleDest`.
 */
function resolveRuleDest(
  projectPath: string,
  platform: Platform,
  ruleName: string,
): string {
  // GitHub Copilot merges all rules into one instructions file.
  if (platform.rulesFormat === 'copilot') {
    return path.join(projectPath, platform.skillsDir, 'copilot-instructions.md');
  }

  const baseDir = platform.rulesBaseDir
    ? path.join(projectPath, platform.rulesBaseDir)
    : path.join(projectPath, platform.skillsDir);
  const rulesSubdir = platform.rulesDir ?? 'rules';
  const ext = platform.rulesFormat === 'mdc' ? '.mdc' : '.md';
  return path.join(baseDir, rulesSubdir, ruleName + ext);
}

/**
 * Check whether ALL manifest rule files exist at the platform's rules path.
 * For copilot-format platforms, a single copilot-instructions.md covers all rules.
 */
async function checkRulesInstalled(
  projectPath: string,
  platform: Platform,
): Promise<boolean> {
  if (!platform.rulesFormat) return false;

  // Copilot merges all rules into one file; a single existence check suffices.
  if (platform.rulesFormat === 'copilot') {
    return fileExists(path.join(projectPath, platform.skillsDir, 'copilot-instructions.md'));
  }

  // Check both rule files from the manifest.
  const ruleNames = ['ivy-phase-guard', 'ivy-security'];
  const checks = ruleNames.map(async (name) => {
    return fileExists(resolveRuleDest(projectPath, platform, name));
  });
  const results = await Promise.all(checks);
  return results.every(Boolean);
}

/**
 * Resolve the expected hook file path for a platform that supports hooks.
 */
function resolveHookDest(projectPath: string, platform: Platform): string {
  // Claude Code uses a static git pre-push hook (manifest hook: claude-code).
  if (platform.id === 'claude') {
    return path.join(projectPath, '.git', 'hooks', 'pre-push');
  }
  // Other hook-supporting platforms (Cursor, Windsurf) store hooks relative to skillsDir.
  if (platform.hookPath) {
    return path.join(projectPath, platform.skillsDir, platform.hookPath);
  }
  // Fallback — should not be reached for platforms with supportsHooks=true.
  return '';
}

/**
 * Check whether the hook file exists for a platform that supports hooks.
 */
async function checkHooksInstalled(
  projectPath: string,
  platform: Platform,
): Promise<boolean> {
  const dest = resolveHookDest(projectPath, platform);
  if (!dest) return false;
  return fileExists(dest);
}

/**
 * Compute a full platform health report for the given project.
 *
 * Scans all 16 platforms from PLATFORMS and reports detection status,
 * certification level, and whether skills / rules / hooks are installed.
 *
 * Read-only: never creates, modifies, or deletes files.
 */
export async function computePlatformHealth(projectPath: string): Promise<PlatformHealthReport> {
  logger.step('Scanning platform detection and installation status...');

  const detectResults = await detectPlatforms(projectPath);
  const manifestSkills = await getManifestSkills();

  const platforms: PlatformHealthEntry[] = [];

  for (const platform of PLATFORMS) {
    const dr = detectResults.find((r) => r.platform.id === platform.id);
    const detected = dr?.detected ?? false;
    // Non-detected platforms get confidence 0 per spec.
    const confidence = detected ? dr!.confidence : 0;
    const certification: PlatformCertification | 'not_detected' = detected
      ? platform.certification
      : 'not_detected';

    const [skillsInstalled, rulesInstalled, hooksInstalled] = await Promise.all([
      checkSkillsInstalled(projectPath, platform, manifestSkills),
      checkRulesInstalled(projectPath, platform),
      platform.supportsHooks ? checkHooksInstalled(projectPath, platform) : Promise.resolve(null),
    ]);

    platforms.push({
      id: platform.id,
      name: platform.name,
      certification,
      detected,
      confidence,
      skillsInstalled,
      rulesInstalled,
      hooksInstalled,
    });
  }

  const totalPlatforms = PLATFORMS.length;
  const certifiedPlatforms = PLATFORMS.filter((p) => p.certification === 'certified').length;
  const experimentalPlatforms = PLATFORMS.filter((p) => p.certification === 'experimental').length;
  const detectedPlatforms = platforms.filter((p) => p.detected).length;

  logger.success(`Detected ${detectedPlatforms}/${totalPlatforms} platforms`);

  return {
    totalPlatforms,
    certifiedPlatforms,
    experimentalPlatforms,
    detectedPlatforms,
    platforms,
  };
}

/**
 * Render the platform health report as a formatted ASCII string.
 *
 * Output format:
 *   IvyFlow Platform Certification Report
 *
 *     平台认证: 10 / 16 已检测
 *     Certified: 11 (其中 7 个已检测)
 *     Experimental: 5 (其中 3 个已检测)
 *
 *     各平台详情:
 *     claude           Certified     1.0  skills✅ rules✅ hooks✅
 *     cursor           Certified     1.0  skills✅ rules✅ hooks✅
 *     ...
 */
export function renderPlatformHealth(report: PlatformHealthReport): string {
  const lines: string[] = [];

  lines.push('IvyFlow Platform Certification Report');
  lines.push('');

  const certifiedDetected = report.platforms.filter(
    (p) => p.certification === 'certified' && p.detected,
  ).length;
  const experimentalDetected = report.platforms.filter(
    (p) => p.certification === 'experimental' && p.detected,
  ).length;

  lines.push(`  平台认证: ${report.detectedPlatforms} / ${report.totalPlatforms} 已检测`);
  lines.push(`  Certified: ${report.certifiedPlatforms} (其中 ${certifiedDetected} 个已检测)`);
  lines.push(`  Experimental: ${report.experimentalPlatforms} (其中 ${experimentalDetected} 个已检测)`);
  lines.push('');
  lines.push('  各平台详情:');

  // Column width calculation for alignment.
  const maxIdLen = Math.max(...report.platforms.map((p) => p.id.length));
  const maxCertLen = Math.max(
    ...report.platforms.map((p) => (p.certification === 'not_detected' ? 'not_detected'.length : p.certification.length)),
  );

  for (const entry of report.platforms) {
    const idPadded = entry.id.padEnd(maxIdLen);
    const certDisplay =
      entry.certification === 'not_detected' ? 'not_detected' : entry.certification;
    const certPadded = certDisplay.padEnd(maxCertLen);
    const confStr = entry.confidence.toFixed(1);

    const statusParts: string[] = [];
    statusParts.push(entry.skillsInstalled ? 'skills✅' : 'skills❌');
    statusParts.push(entry.rulesInstalled ? 'rules✅' : 'rules❌');
    if (entry.hooksInstalled !== null) {
      statusParts.push(entry.hooksInstalled ? 'hooks✅' : 'hooks❌');
    }

    lines.push(`  ${idPadded}  ${certPadded}  ${confStr}  ${statusParts.join(' ')}`);
  }

  return lines.join('\n');
}
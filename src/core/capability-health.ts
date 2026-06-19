/**
 * Capability Health — v0.14 Sprint 14.4 Lifecycle Integration.
 *
 * Minimal version for Verify-phase integration.
 * Full diagnostic version in Sprint 14.5.
 */

import path from 'path';

import { readYaml } from '../utils/yaml.js';
import { fileExists } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import { detectTechStack } from './capability-detector.js';
import { generateRules, validateRules } from './rule-generator.js';
import { generateVerifyProfile } from './verify-profile.js';

export interface HealthCheckResult {
  verifyProfileAligned: boolean;
  rulesActive: boolean;
  gaps: string[];
  warnings: string[];
  status: 'passed' | 'warning';
}

export async function runCapabilityHealthCheck(projectPath: string): Promise<HealthCheckResult> {
  const gaps: string[] = [];
  const warnings: string[] = [];
  let verifyProfileAligned = false;
  let rulesActive = false;

  try {
    const detection = await detectTechStack(projectPath);

    // Check verify profile
    const generatedProfile = await generateVerifyProfile(detection.techStack, 'development', detection.projectIntent);
    const verifyPath = path.join(projectPath, '.ivy', 'verify.yaml');
    if (await fileExists(verifyPath)) {
      const actual = await readYaml<Record<string, unknown>>(verifyPath).catch(() => null);
      if (actual) {
        verifyProfileAligned = true;
      } else {
        warnings.push('Verify profile file exists but is invalid');
      }
    } else {
      warnings.push('No verify profile found — run `ivy capability profile`');
    }

    // Check rules
    const profile = await generateRules(detection.techStack, detection.projectIntent);
    const rulesPath = path.join(projectPath, '.ivy', 'rules.yaml');
    if (await fileExists(rulesPath)) {
      const actual = await readYaml<Record<string, unknown>>(rulesPath).catch(() => null);
      if (actual) {
        rulesActive = true;
        const validation = validateRules(profile, detection.techStack);
        if (validation.skipped > 0) {
          warnings.push(`${validation.skipped} rule(s) skipped — tech stack mismatch`);
        }
      }
    } else {
      warnings.push('No .ivy/rules.yaml found — run `ivy rules generate`');
    }

    // Scan for gaps
    if (!verifyProfileAligned) gaps.push('Verify profile not configured');
    if (!rulesActive) gaps.push('Rules not deployed');
    if (!detection.techStack.language || detection.techStack.language.length === 0) {
      gaps.push('Tech stack not detected');
    }
  } catch (err) {
    warnings.push(`Health check error: ${(err as Error).message}`);
  }

  const status: 'passed' | 'warning' = gaps.length > 0 || warnings.length > 0 ? 'warning' : 'passed';

  return { verifyProfileAligned, rulesActive, gaps, warnings, status };
}

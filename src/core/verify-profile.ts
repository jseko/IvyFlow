/**
 * Verify Profile — v0.14 Sprint 14.3.
 *
 * Generates tech-stack-aware verification profiles with maturity levels
 * and stack-specific gate overrides.
 */

import path from 'path';

import { readYaml, writeYaml } from '../utils/yaml.js';
import { fileExists } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import type {
  TechStack,
  VerifyProfile,
  MaturityLevel,
  GateRequirement,
  ProjectIntent,
} from './capability-model.js';

// ─── Public API ───

export interface VerifyProfileOptions {
  techStack: TechStack;
  maturity: MaturityLevel;
  projectIntent?: ProjectIntent;
  mappingPath?: string;
}

/**
 * Generate a verification profile from tech stack + maturity.
 *
 * Steps:
 * 1. Start with default profile for maturity level
 * 2. Apply tech-stack-specific overrides
 * 3. Apply project intent filters
 */
export async function generateVerifyProfile(
  techStack: TechStack,
  maturity: MaturityLevel,
  projectIntent?: ProjectIntent,
  mappingPath?: string,
): Promise<VerifyProfile> {
  const mapFile = mappingPath ?? path.join(process.cwd(), 'assets', 'capability', 'verify-mapping.yaml');
  const mapping = (await readYaml(mapFile)) as Record<string, unknown> ?? {};

  // 1. Start with default profile for maturity level
  const defaults = (mapping.default as Record<string, Record<string, GateRequirement>>) ?? {};
  const maturityDefaults = defaults[maturity] ?? {};
  const profile: VerifyProfile = {
    maturity,
    compile: maturityDefaults.compile ?? 'required',
    unitTest: maturityDefaults.unitTest ?? 'optional',
    integrationTest: maturityDefaults.integrationTest ?? 'none',
    e2e: maturityDefaults.e2e ?? 'none',
    lint: maturityDefaults.lint ?? 'optional',
    coverage: maturityDefaults.coverage ?? 'none',
  };

  // 2. Apply tech-stack-specific overrides
  const overrides = (mapping.tech_stack_overrides as Array<{
    stack: string[];
    overrides: Partial<Record<keyof VerifyProfile, GateRequirement>>;
  }>) ?? [];

  const allTech = collectTech(techStack);
  for (const entry of overrides) {
    const matches = entry.stack.every((s) => allTech.includes(s));
    if (!matches) continue;

    for (const [gate, requirement] of Object.entries(entry.overrides)) {
      if (gate !== 'compile' && gate !== 'unitTest' && gate !== 'integrationTest' &&
          gate !== 'e2e' && gate !== 'lint' && gate !== 'coverage') continue;
      // Override only if more strict than current
      const current = profile[gate as keyof VerifyProfile] as GateRequirement;
      if (isMoreStrict(requirement as GateRequirement, current)) {
        (profile as unknown as Record<string, unknown>)[gate] = requirement;
      }
    }
  }

  // 3. Apply project intent filter
  if (projectIntent === 'api-only') {
    if (profile.e2e === 'required') profile.e2e = 'none';
  }
  if (projectIntent === 'prototype') {
    // Prototype intent overrides maturity: only compile required
    profile.compile = 'required';
    profile.unitTest = 'optional';
    profile.lint = 'optional';
    profile.integrationTest = 'none';
    profile.e2e = 'none';
    profile.coverage = 'none';
  }

  return profile;
}

/**
 * Load verify profile from .ivy/verify.yaml or project config.
 */
export async function loadVerifyProfile(
  projectPath: string,
): Promise<VerifyProfile | null> {
  const verifyYaml = path.join(projectPath, '.ivy', 'verify.yaml');
  const exists = await fileExists(verifyYaml).catch(() => false);
  if (!exists) return null;

  const data = await readYaml<Record<string, unknown>>(verifyYaml).catch(() => null);
  if (!data) return null;

  return {
    maturity: (data.maturity as MaturityLevel) ?? 'development',
    compile: (data.compile as GateRequirement) ?? 'required',
    unitTest: (data.unitTest as GateRequirement) ?? 'optional',
    integrationTest: (data.integrationTest as GateRequirement) ?? 'none',
    e2e: (data.e2e as GateRequirement) ?? 'none',
    lint: (data.lint as GateRequirement) ?? 'optional',
    coverage: (data.coverage as GateRequirement) ?? 'none',
  };
}

/**
 * Check if project config has manual override for verification profile.
 */
export function supportsManualOverride(config: { verification?: { profile?: string } }): boolean {
  return config.verification?.profile === 'manual';
}

/**
 * Write verify profile to .ivy/verify.yaml.
 */
export async function writeVerifyProfile(
  projectPath: string,
  profile: VerifyProfile,
): Promise<void> {
  const outputPath = path.join(projectPath, '.ivy', 'verify.yaml');
  await writeYaml(outputPath, profile as unknown as Record<string, unknown>);
  logger.success(`Verify profile written to .ivy/verify.yaml (maturity: ${profile.maturity})`);
}

// ─── Helpers ───

function collectTech(ts: TechStack): string[] {
  const result: string[] = [];
  if (ts.language) result.push(...ts.language);
  if (ts.frontend) result.push(...ts.frontend);
  if (ts.backend) result.push(...ts.backend);
  if (ts.testFramework) result.push(...ts.testFramework);
  if (ts.e2eFramework) result.push(ts.e2eFramework);
  return [...new Set(result)];
}

const STRICT_ORDER: GateRequirement[] = ['none', 'optional', 'required'];

function isMoreStrict(a: GateRequirement, b: GateRequirement): boolean {
  return STRICT_ORDER.indexOf(a) > STRICT_ORDER.indexOf(b);
}

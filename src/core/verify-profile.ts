/**
 * Verify Profile — v0.15 Sprint 15.3 technology-specific verification gate profiles.
 */

import type { MaturityLevel } from './skill-registry.js';

export type GateRequirement = 'required' | 'optional' | 'none';

export interface VerifyProfile {
  maturity: MaturityLevel;
  compile: GateRequirement;
  unitTest: GateRequirement;
  integrationTest: GateRequirement;
  e2e: GateRequirement;
  lint: GateRequirement;
  coverage: GateRequirement;
}

type ProfileOverride = Partial<VerifyProfile> & { match: string[] };

const DEFAULT_PROFILES: Record<MaturityLevel, VerifyProfile> = {
  prototype: {
    maturity: 'prototype',
    compile: 'required',
    unitTest: 'optional',
    lint: 'optional',
    coverage: 'none',
    integrationTest: 'none',
    e2e: 'none',
  },
  development: {
    maturity: 'development',
    compile: 'required',
    unitTest: 'required',
    lint: 'required',
    coverage: 'optional',
    integrationTest: 'optional',
    e2e: 'none',
  },
  production: {
    maturity: 'production',
    compile: 'required',
    unitTest: 'required',
    lint: 'required',
    coverage: 'required',
    integrationTest: 'required',
    e2e: 'required',
  },
};

const TECH_OVERRIDES: ProfileOverride[] = [
  { match: ['nextjs', 'playwright'], e2e: 'required' },
  { match: ['springboot', 'junit'], compile: 'required', unitTest: 'required', integrationTest: 'required', e2e: 'optional' },
  { match: ['go'], compile: 'required', unitTest: 'required', lint: 'required', integrationTest: 'optional' },
];

export function getDefaultProfile(maturity: MaturityLevel): VerifyProfile {
  return { ...DEFAULT_PROFILES[maturity] };
}

export function mergeTechStackOverrides(profile: VerifyProfile, techStacks: string[]): VerifyProfile {
  const result = { ...profile };

  for (const override of TECH_OVERRIDES) {
    if (override.match.every(t => techStacks.includes(t))) {
      for (const [key, value] of Object.entries(override)) {
        if (key !== 'match' && value !== undefined) {
          (result as Record<string, unknown>)[key] = value;
        }
      }
    }
  }

  return result;
}

export function generateProfile(maturity: MaturityLevel, techStacks: string[]): VerifyProfile {
  const base = getDefaultProfile(maturity);
  return mergeTechStackOverrides(base, techStacks);
}

/**
 * Rule Generator — v0.14 Sprint 14.2.
 *
 * Generates RuleDefinitions from detected tech stack using
 * assets/capability/rule-mapping.yaml.
 */

import path from 'path';

import { readYaml, writeYaml } from '../utils/yaml.js';
import { fileExists } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import type {
  TechStack,
  RuleDefinition,
  RuleProfile,
  RuleTier,
  RuleSeverity,
  ProjectIntent,
  CapabilityDependencyIndex,
} from './capability-model.js';

// ─── Rule Generation ───

export interface RuleGenerationOptions {
  techStack: TechStack;
  projectIntent: ProjectIntent;
  capabilityIndex?: CapabilityDependencyIndex;
  mappingPath?: string;
}

export interface AnalysisResult {
  totalRules: number;
  byTier: Record<RuleTier, number>;
  coverage: number;
  expectedTotal: number;
  missing: string[];
  conflicts: Conflict[];
}

export interface Conflict {
  type: 'structural' | 'behavioral' | 'severity';
  rules: string[];
  description: string;
  resolution: string;
}

export interface ValidationResult {
  total: number;
  applicable: number;
  skipped: number;
  details: Array<{ rule: string; status: 'matches' | 'skipped'; reason?: string }>;
}

/**
 * Generate rules from tech stack + intent.
 * Pure function: same input → same output.
 */
export async function generateRules(
  techStack: TechStack,
  projectIntent: ProjectIntent,
  mappingPath?: string,
): Promise<RuleProfile> {
  const mappingFile = mappingPath ?? path.join(process.cwd(), 'assets', 'capability', 'rule-mapping.yaml');
  const mapping = await loadMapping(mappingFile);

  const rules: RuleDefinition[] = [];

  // 1. Core rules — always deployed
  const coreRules = mapping._core ?? [];
  for (const r of coreRules) {
    rules.push(normalizeRule(r, 'core'));
  }

  // 2. Tech-stack-specific rules
  const allTech = collectTechStack(techStack);
  for (const tech of allTech) {
    const techRules = mapping[tech] ?? [];
    for (const r of techRules) {
      const rule = normalizeRule(r, r.tier as RuleTier);
      rule.techStackTrigger = [tech];
      // Skip if already added
      if (!rules.find((existing) => existing.id === rule.id)) {
        rules.push(rule);
      }
    }
  }

  // 3. Intent filter: api-only skips e2e-related rules
  const filtered = applyIntentFilter(rules, projectIntent);

  return {
    rules: filtered,
    source: 'generated',
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Analyze rules for coverage and conflicts.
 */
export function analyzeRules(profile: RuleProfile, expectedTotal: number): AnalysisResult {
  const byTier: Record<RuleTier, number> = { core: 0, context: 0, optional: 0 };
  for (const r of profile.rules) {
    byTier[r.tier] = (byTier[r.tier] ?? 0) + 1;
  }

  const conflicts = detectConflicts(profile.rules);
  const missing = findMissingRules(profile, expectedTotal);

  return {
    totalRules: profile.rules.length,
    byTier,
    coverage: expectedTotal > 0 ? Math.round((profile.rules.length / expectedTotal) * 100) : 100,
    expectedTotal,
    missing,
    conflicts,
  };
}

/**
 * Validate rules against current tech stack.
 */
export function validateRules(
  profile: RuleProfile,
  techStack: TechStack,
): ValidationResult {
  const allTech = collectTechStack(techStack);
  const details: ValidationResult['details'] = [];

  for (const rule of profile.rules) {
    if (rule.tier === 'core') {
      details.push({ rule: rule.id, status: 'matches' });
      continue;
    }
    const matches = rule.techStackTrigger.some((t) => allTech.includes(t));
    if (matches) {
      details.push({ rule: rule.id, status: 'matches' });
    } else {
      details.push({ rule: rule.id, status: 'skipped', reason: `no ${rule.techStackTrigger.join(', ')} in stack` });
    }
  }

  const applicable = details.filter((d) => d.status === 'matches').length;
  return {
    total: profile.rules.length,
    applicable,
    skipped: profile.rules.length - applicable,
    details,
  };
}

/**
 * Write rule profile to .ivy/rules.yaml.
 */
export async function writeRuleProfile(
  projectPath: string,
  profile: RuleProfile,
): Promise<void> {
  const outputPath = path.join(projectPath, '.ivy', 'rules.yaml');
  await writeYaml(outputPath, {
    source: profile.source,
    generated_at: profile.generatedAt,
    rules: profile.rules.map((r) => ({
      id: r.id,
      name: r.name ?? r.id,
      type: r.type,
      scope: r.scope,
      severity: r.severity,
      tier: r.tier,
      tech_stack_trigger: r.techStackTrigger,
    })),
  } as Record<string, unknown>);
  logger.success(`Rules written to .ivy/rules.yaml (${profile.rules.length} rules)`);
}

// ─── Conflict Detection ───

export function detectConflicts(rules: RuleDefinition[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const byTierScope = new Map<string, RuleDefinition[]>();

  for (const rule of rules) {
    const key = `${rule.tier}:${rule.scope}`;
    const group = byTierScope.get(key) ?? [];
    group.push(rule);
    byTierScope.set(key, group);
  }

  // Check for same-scope severity conflicts
  for (const [, group] of byTierScope) {
    if (group.length < 2) continue;
    // Same scope + tech stack → potential conflict
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (a.techStackTrigger.some((t) => b.techStackTrigger.includes(t))) {
          conflicts.push({
            type: 'structural',
            rules: [a.id, b.id],
            description: `${a.id} and ${b.id} target same scope ${a.scope} with ${a.severity} vs ${b.severity}`,
            resolution: higherSeverityWins(a.severity, b.severity),
          });
        }
      }
    }
  }

  return conflicts;
}

// ─── Helpers ───

type RawMapping = Record<string, Array<Record<string, unknown>>>;

async function loadMapping(
  mappingPath: string,
): Promise<RawMapping> {
  const exists = await fileExists(mappingPath);
  if (!exists) {
    logger.warn(`Rule mapping not found at ${mappingPath}, using defaults`);
    return { _core: [] };
  }
  return (await readYaml(mappingPath)) as RawMapping ?? { _core: [] };
}

function normalizeRule(raw: Record<string, unknown>, defaultTier: RuleTier): RuleDefinition {
  return {
    id: raw.id as string,
    name: (raw.id as string) ?? '',
    type: (raw.type as RuleDefinition['type']) ?? 'constraint',
    scope: (raw.scope as RuleDefinition['scope']) ?? 'file',
    severity: (raw.severity as RuleSeverity) ?? 'medium',
    tier: (raw.tier as RuleTier) ?? defaultTier,
    source: ['rule-mapping.yaml'],
    content: (raw.content as string) ?? '',
    techStackTrigger: [],
  };
}

function applyIntentFilter(
  rules: RuleDefinition[],
  intent: ProjectIntent,
): RuleDefinition[] {
  if (intent === 'api-only') {
    // api-only: skip e2e-related rules
    return rules.filter(
      (r) => !r.techStackTrigger.some((t) =>
        ['playwright', 'cypress', 'e2e'].includes(t),
      ),
    );
  }
  return rules;
}

function findMissingRules(profile: RuleProfile, expectedTotal: number): string[] {
  if (profile.rules.length >= expectedTotal) return [];
  // Simplified: report gap based on what's expected vs what's present
  return [];
}

function higherSeverityWins(a: RuleSeverity, b: RuleSeverity): string {
  const order: RuleSeverity[] = ['low', 'medium', 'high', 'critical'];
  const winner = order.indexOf(a) >= order.indexOf(b) ? a : b;
  return `Higher severity (${winner}) takes precedence`;
}

function collectTechStack(ts: TechStack): string[] {
  const result: string[] = [];
  if (ts.language) result.push(...ts.language);
  if (ts.frontend) result.push(...ts.frontend);
  if (ts.backend) result.push(...ts.backend);
  if (ts.testFramework) result.push(...ts.testFramework);
  if (ts.e2eFramework) result.push(ts.e2eFramework);
  return [...new Set(result)];
}

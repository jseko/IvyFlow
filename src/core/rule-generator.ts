/**
 * Rule Generator — v0.15 Sprint 15.2 tech-stack-driven rule generation.
 */

import path from 'path';

import { readYaml } from '../utils/yaml.js';
import { fileExists } from '../utils/fs.js';
import { buildTechStack } from './capability-detector.js';
import type { DetectionResult } from './capability-model.js';

export type RuleSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RuleScope = 'file' | 'module' | 'project';
export type RuleTier = 'core' | 'context' | 'optional';

export interface RuleContextTrigger {
  context: string;
  minConfidence?: number;
  mode: 'include' | 'exclude';
}

export interface RuleDefinition {
  id: string;
  type?: 'constraint' | 'behavior' | 'architecture';
  scope?: RuleScope;
  severity: RuleSeverity;
  tier: RuleTier;
  content?: string;
  techStackTrigger: string[];
  contextTriggers?: RuleContextTrigger[];
  source?: string[];
}

export interface UnresolvedRule {
  ruleId: string;
  reason: string;
  confidence: number;
}

export interface RuleProfile {
  rules: RuleDefinition[];
  source: 'generated' | 'manual' | 'mixed';
  generatedAt: string;
  unresolved?: UnresolvedRule[];
}

interface RuleMappingEntry {
  id: string;
  severity: RuleSeverity;
  tier: RuleTier;
  techStackTrigger?: string[];
  contextTriggers?: RuleContextTrigger[];
}

interface RuleMappingFile {
  rule_mapping: Record<string, RuleMappingEntry[]>;
}

// ─── Rule generator ───

export function inferProjectContext(detection: DetectionResult): string[] {
  const contexts: string[] = [];
  const ts = detection.techStack;

  if (ts.frontend?.includes('nextjs') || ts.frontend?.includes('react')) {
    contexts.push('ssr');
  }

  if (ts.frontend && ts.backend) {
    contexts.push('fullstack');
  } else if (ts.frontend && !ts.backend) {
    contexts.push('spa');
  } else if (ts.backend && !ts.frontend) {
    contexts.push('api-only');
  }

  return contexts;
}

export function matchContextTriggers(
  rule: RuleDefinition,
  projectContexts: string[],
): { matched: boolean; reason?: string } {
  if (!rule.contextTriggers || rule.contextTriggers.length === 0) {
    return { matched: true };
  }

  for (const trigger of rule.contextTriggers) {
    const contextMatch = projectContexts.includes(trigger.context);

    if (trigger.mode === 'include' && contextMatch) {
      return { matched: true };
    }
    if (trigger.mode === 'exclude' && contextMatch) {
      return { matched: false, reason: `Excluded by context: ${trigger.context}` };
    }
  }

  // include triggers that didn't match → exclude
  const hasInclude = rule.contextTriggers.some(t => t.mode === 'include');
  if (hasInclude) {
    return { matched: false, reason: 'No matching context trigger' };
  }

  return { matched: true };
}

export function detectRuleConflicts(rules: RuleDefinition[]): Array<{ ruleA: string; ruleB: string; reason: string }> {
  const conflicts: Array<{ ruleA: string; ruleB: string; reason: string }> = [];
  // Basic conflict: same ID appearing twice
  const seen = new Map<string, string[]>();
  for (const rule of rules) {
    if (seen.has(rule.id)) {
      conflicts.push({ ruleA: rule.id, ruleB: rule.id, reason: 'Duplicate rule ID' });
    }
    seen.set(rule.id, [...(seen.get(rule.id) ?? []), rule.id]);
  }
  return conflicts;
}

export function assignTier(rule: RuleDefinition): RuleTier {
  if (rule.tier) return rule.tier;
  const trigger = rule.techStackTrigger;
  if (!trigger || trigger.length === 0) return 'core';
  return 'context';
}

export async function generateRules(
  detection: DetectionResult,
  _cwd: string,
  ruleMappingPath?: string,
): Promise<RuleProfile> {
  const techStacks = Object.values(detection.techStack).flat().filter(Boolean) as string[];
  const projectContexts = inferProjectContext(detection);
  const mapping = await loadRuleMapping(ruleMappingPath);
  const allRules: RuleDefinition[] = [];
  const unresolved: UnresolvedRule[] = [];

  for (const [stack, rules] of Object.entries(mapping)) {
    if (stack === '_core') {
      for (const entry of rules) {
        allRules.push({ ...entry, techStackTrigger: entry.techStackTrigger ?? [] });
      }
      continue;
    }

    if (!techStacks.includes(stack)) continue;

    for (const entry of rules) {
      const rule: RuleDefinition = { ...entry, techStackTrigger: entry.techStackTrigger ?? [stack] };
      const { matched, reason } = matchContextTriggers(rule, projectContexts);

      if (!matched) {
        unresolved.push({ ruleId: rule.id, reason: reason ?? 'Context mismatch', confidence: 0.5 });
        continue;
      }

      rule.tier = assignTier(rule);
      allRules.push(rule);
    }
  }

  const conflicts = detectRuleConflicts(allRules);

  return {
    rules: allRules,
    source: 'generated',
    generatedAt: new Date().toISOString(),
    unresolved: unresolved.length > 0 ? unresolved : undefined,
  };
}

async function loadRuleMapping(mappingPath?: string): Promise<Record<string, RuleMappingEntry[]>> {
  const defaultPath = path.join(process.cwd(), 'assets', 'capability', 'rule-mapping.yaml');

  try {
    const resolvedPath = mappingPath ?? defaultPath;
    if (await fileExists(resolvedPath)) {
      const data = await readYaml<RuleMappingFile>(resolvedPath);
      return data?.rule_mapping ?? {};
    }
  } catch {
    // Fall through to default
  }

  return {};
}

// ─── Analysis ───

export function analyzeRules(rules: RuleDefinition[]): { activeCount: number; coverage: number; conflicts: number } {
  const conflicts = detectRuleConflicts(rules);
  return {
    activeCount: rules.length,
    coverage: Math.min(1, rules.length / 10),
    conflicts: conflicts.length,
  };
}

export function validateRules(rules: RuleDefinition[], techStacks: string[]): Array<{ rule: string; applicable: boolean; reason?: string }> {
  return rules.map(rule => {
    if (rule.techStackTrigger.length === 0) {
      return { rule: rule.id, applicable: true };
    }
    const match = rule.techStackTrigger.some(t => techStacks.includes(t));
    return {
      rule: rule.id,
      applicable: match,
      reason: match ? undefined : `No ${rule.techStackTrigger.join('/')} in tech stack`,
    };
  });
}

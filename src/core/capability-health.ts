/**
 * Capability Health — v0.15 Sprint 15.5 three-dimensional health assessment.
 *
 * Dimensions: coverage (expected vs actual), drift (tech stack delta over time),
 * risk (stale/conflict/misaligned signals). No aggregate status is produced.
 */

// ─── Types ───

export interface CapabilityGap {
  type: 'rule' | 'skill' | 'verification';
  expectedItem: string;
  severity: 'high' | 'medium' | 'low';
  actionability: 'auto_fixable' | 'suggestion_only' | 'manual_required';
  description: string;
}

export interface CoverageDimension {
  ratio: number;
  expected: number;
  actual: number;
  gaps: CapabilityGap[];
}

export interface DriftChange {
  type: 'added' | 'removed';
  item: string;
  category: string;
}

export interface DriftDimension {
  rate: number;
  changes: DriftChange[];
}

export interface RiskFlag {
  type: 'stale' | 'conflict' | 'missing' | 'misaligned';
  description: string;
  items: string[];
}

export interface RiskDimension {
  flags: RiskFlag[];
}

export interface RuleConflict {
  ruleA: string;
  ruleB: string;
}

export interface HealthReport {
  coverage: CoverageDimension;
  drift: DriftDimension;
  risk: RiskDimension;
  timestamp: string;
}

// ─── Coverage ───

export function assessCoverage(
  expectedCapabilities: string[],
  actualCapabilities: string[],
): CoverageDimension {
  const gaps: CapabilityGap[] = [];

  for (const expected of expectedCapabilities) {
    if (!actualCapabilities.includes(expected)) {
      const type = inferGapType(expected);
      gaps.push({
        type,
        expectedItem: expected,
        severity: type === 'rule' ? 'high' : 'medium',
        actionability: type === 'verification' ? 'manual_required' : 'suggestion_only',
        description: `Expected ${type} not deployed: ${expected}`,
      });
    }
  }

  const expectedCount = expectedCapabilities.length;
  const actualCount = actualCapabilities.length;
  const ratio = expectedCount > 0 ? Math.min(1, actualCount / expectedCount) : 1;

  return { ratio, expected: expectedCount, actual: actualCount, gaps };
}

function inferGapType(item: string): 'rule' | 'skill' | 'verification' {
  if (item.startsWith('e2e-') || item.endsWith('-rules') || item.includes('-rules')) return 'rule';
  if (item.startsWith('verify-') || item.endsWith('-gate')) return 'verification';
  return 'skill';
}

// ─── Drift ───

export function assessDrift(
  previousTechStack: string[],
  currentTechStack: string[],
): DriftDimension {
  const changes: DriftChange[] = [];

  const added = currentTechStack.filter(t => !previousTechStack.includes(t));
  const removed = previousTechStack.filter(t => !currentTechStack.includes(t));

  for (const item of added) {
    changes.push({ type: 'added', item, category: 'tech-stack' });
  }
  for (const item of removed) {
    changes.push({ type: 'removed', item, category: 'tech-stack' });
  }

  const rate = previousTechStack.length > 0 ? changes.length / previousTechStack.length : 0;

  return { rate: Math.min(1, rate), changes };
}

// ─── Risk ───

export function assessRisk(
  deployedCapabilities: string[],
  currentTechStack: string[],
  conflicts: RuleConflict[],
): RiskDimension {
  const flags: RiskFlag[] = [];

  // Stale: deployed capability not in current tech stack
  for (const cap of deployedCapabilities) {
    if (!currentTechStack.includes(cap)) {
      flags.push({
        type: 'stale',
        description: `Deployed capability '${cap}' has no matching tech stack entry`,
        items: [cap],
      });
    }
  }

  // Conflict: rule conflicts
  for (const c of conflicts) {
    flags.push({
      type: 'conflict',
      description: `Conflicting rules: ${c.ruleA} vs ${c.ruleB}`,
      items: [c.ruleA, c.ruleB],
    });
  }

  return { flags };
}

// ─── Orchestrator ───

export function generateHealthReport(
  expectedCapabilities: string[],
  actualCapabilities: string[],
  previousTechStack: string[],
  currentTechStack: string[],
  conflicts: RuleConflict[],
): HealthReport {
  const coverage = assessCoverage(expectedCapabilities, actualCapabilities);
  const drift = assessDrift(previousTechStack, currentTechStack);
  const risk = assessRisk(actualCapabilities, currentTechStack, conflicts);

  return {
    coverage,
    drift,
    risk,
    timestamp: new Date().toISOString(),
  };
}

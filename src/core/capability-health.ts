/**
 * Capability Health — v0.15 3D health assessment (coverage + drift + risk).
 *
 * Three-dimensional model: no aggregate status, no percentage score.
 */

import path from 'path';

import { readYaml } from '../utils/yaml.js';
import { fileExists } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import { detectCapabilities } from './capability-detector.js';
import { generateRules, validateRules } from './rule-generator.js';
import { generateProfile } from './verify-profile.js';
import { recordGapDetected } from './feedback-collector.js';
import { IvyPhase } from './phase-machine.js';

// ─── 3D Health Types ───

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

export interface CapabilityHealthReport {
  coverage: CoverageDimension;
  drift: DriftDimension;
  risk: RiskDimension;
  suggestions: string[];
}

// ─── Legacy Health Check (for lifecycle integration) ───

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
    const detection = await detectCapabilities(projectPath);

    // Check verify profile
    const techStacks = Object.values(detection.techStack).flat().filter(Boolean) as string[];
    const profile = generateProfile('development', techStacks);
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
    const ruleProfile = await generateRules(detection.techStack, detection.projectIntent);
    const rulesPath = path.join(projectPath, '.ivy', 'rules.yaml');
    if (await fileExists(rulesPath)) {
      const actual = await readYaml<Record<string, unknown>>(rulesPath).catch(() => null);
      if (actual) {
        rulesActive = true;
        const validation = validateRules(ruleProfile, detection.techStack);
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
    if (techStacks.length === 0) {
      gaps.push('Tech stack not detected');
    }
  } catch (err) {
    warnings.push(`Health check error: ${(err as Error).message}`);
  }

  const status: 'passed' | 'warning' = gaps.length > 0 || warnings.length > 0 ? 'warning' : 'passed';

  return { verifyProfileAligned, rulesActive, gaps, warnings, status };
}

// ─── 3D Health Assessment ───

export async function assessHealth(projectPath: string): Promise<CapabilityHealthReport> {
  const suggestions: string[] = [];

  // Coverage: expected vs actual
  const detection = await detectCapabilities(projectPath);
  const techStacks = Object.values(detection.techStack).flat().filter(Boolean) as string[];
  const expectedCapabilities = detection.candidates.map(c => c.id);
  const actualCapabilities = techStacks;

  const gaps: CapabilityGap[] = [];
  for (const expected of expectedCapabilities) {
    if (!actualCapabilities.includes(expected)) {
      const type = expected.startsWith('e2e-') || expected.endsWith('-rules') ? 'rule' : 'skill';
      const gap: CapabilityGap = {
        type,
        expectedItem: expected,
        severity: type === 'rule' ? 'high' : 'medium',
        actionability: type === 'rule' ? 'auto_fixable' : 'suggestion_only',
        description: `Expected ${type} not deployed: ${expected}`,
      };
      gaps.push(gap);

      // 记录 gap 信号（v0.16）
      await recordGapDetected(
        projectPath,
        type === 'rule' ? 'capability_gap' : 'capability_gap',
        gap.severity,
        { phase: IvyPhase.DESIGN },
        expected,
        gap.description
      );
    }
  }

  const coverage: CoverageDimension = {
    ratio: expectedCapabilities.length > 0 ? Math.min(1, actualCapabilities.length / expectedCapabilities.length) : 1,
    expected: expectedCapabilities.length,
    actual: actualCapabilities.length,
    gaps,
  };

  // Drift: compare against cached detection
  const capPath = path.join(projectPath, '.ivy', 'capability.yaml');
  let drift: DriftDimension = { rate: 0, changes: [] };
  try {
    if (await fileExists(capPath)) {
      const cached = await readYaml<{ tech_stack: Record<string, unknown> }>(capPath).catch(() => null);
      if (cached?.tech_stack) {
        const cachedKeys = Object.keys(cached.tech_stack).flat();
        const currentKeys = techStacks;
        const added = currentKeys.filter(k => !cachedKeys.includes(k));
        const removed = cachedKeys.filter(k => !currentKeys.includes(k));
        const changes: DriftChange[] = [
          ...added.map(item => ({ type: 'added' as const, item, category: 'tech-stack' })),
          ...removed.map(item => ({ type: 'removed' as const, item, category: 'tech-stack' })),
        ];
        const rate = cachedKeys.length > 0 ? changes.length / cachedKeys.length : 0;
        drift = { rate: Math.min(1, rate), changes };
      }
    }
  } catch {
    // Drift check unavailable
  }

  // Risk: stale rules, conflicts
  const riskFlags: RiskFlag[] = [];
  const rulesPath = path.join(projectPath, '.ivy', 'rules.yaml');
  try {
    if (await fileExists(rulesPath)) {
      const ruleData = await readYaml<Record<string, unknown>>(rulesPath).catch(() => null);
      if (ruleData?.rules) {
        const rules = ruleData.rules as Array<Record<string, unknown>>;
        for (const rule of rules) {
          const triggers = (rule.techStackTrigger as string[]) ?? [];
          if (triggers.length > 0 && !triggers.some(t => techStacks.includes(t))) {
            riskFlags.push({
              type: 'stale',
              description: `Stale rule: ${rule.id as string} — ${triggers.join(', ')} not in current stack`,
              items: [rule.id as string],
            });
          }
        }
      }
    }
  } catch {
    // Risk check unavailable
  }

  const risk: RiskDimension = { flags: riskFlags };

  // Suggestions
  if (gaps.length > 0) {
    suggestions.push(`Run 'ivy rules generate' to deploy missing rules`);
  }
  if (riskFlags.length > 0) {
    suggestions.push(`Review stale rules that don't match current tech stack`);
  }

  return { coverage, drift, risk, suggestions };
}

// ─── Health Recommendations (v0.16 Sprint 16.3) ───

/**
 * 健康检查推荐动作.
 */
export interface HealthRecommendation {
  gap: CapabilityGap;
  recommendedAction: string;
  actionabilityLabel: string;
}

/**
 * 生成健康检查推荐动作列表.
 * 所有推荐为只读 — 不自动执行.
 */
export async function generateHealthRecommendations(
  projectPath: string,
): Promise<HealthRecommendation[]> {
  const report = await assessHealth(projectPath);
  const recommendations: HealthRecommendation[] = [];

  for (const gap of report.coverage.gaps) {
    let recommendedAction: string;
    let actionabilityLabel: string;

    switch (gap.type) {
      case 'rule':
        recommendedAction = "Run: `ivy rules generate`";
        actionabilityLabel = gap.actionability === 'auto_fixable' ? '[auto_fixable]' : '[info]';
        break;
      case 'skill':
        recommendedAction = `Install: ` + (gap.expectedItem.includes('review') ? '`ivy skill install code-reviewer`' : '`ivy skill install <skill-name>`');
        actionabilityLabel = '[info]';
        break;
      case 'verification':
        recommendedAction = "Configure: `ivy capability profile --setup`";
        actionabilityLabel = '[info-manual]';
        break;
      default:
        recommendedAction = "Review gap details";
        actionabilityLabel = '[info]';
    }

    recommendations.push({
      gap,
      recommendedAction,
      actionabilityLabel,
    });
  }

  return recommendations;
}

/**
 * 格式化健康检查输出（含推荐动作）.
 */
export function formatHealthReportWithRecommendations(
  report: CapabilityHealthReport,
  recommendations: HealthRecommendation[],
): string {
  const lines: string[] = [];

  lines.push('\nCapability Health (with recommendations)');
  lines.push('═══════════════════════════════════════════════════════════════\n');

  // Gaps summary
  lines.push(`  Gaps: ${report.coverage.gaps.length} (${recommendations.filter(r => r.gap.actionability === 'auto_fixable').length} auto_fixable, ${recommendations.filter(r => r.gap.actionability === 'suggestion_only').length} info, ${recommendations.filter(r => r.gap.actionability === 'manual_required').length} manual)`);

  // Recommendations
  if (recommendations.length > 0) {
    lines.push('\n  ── Recommendations ──────────────────────────────────────\n');

    for (const rec of recommendations) {
      const icon = rec.gap.severity === 'high' ? '✗' : rec.gap.severity === 'medium' ? '⚠' : '•';
      lines.push(`  ${icon}   Missing ${rec.gap.type}: ${rec.gap.expectedItem}`);
      lines.push(`      → ${rec.recommendedAction}  ${rec.actionabilityLabel}`);
      lines.push('');
    }
  } else {
    lines.push('\n  ✓ No gaps detected — all capabilities deployed.\n');
  }

  return lines.join('\n');
}

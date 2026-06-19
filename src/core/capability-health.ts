/**
 * Capability Health — v0.14 Sprint 14.5 Capability Health.
 *
 * Full diagnostic system. Assessment is diagnostic-only:
 * NO scores, NO percentages, NO weighted averages.
 *
 * Reuses v0.12 EvidenceRecord format for diagnostics.
 * Deterministic: same input → same output.
 */

import path from 'path';

import { readYaml } from '../utils/yaml.js';
import { fileExists } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import { detectTechStack } from './capability-detector.js';
import { generateRules } from './rule-generator.js';
import { generateVerifyProfile } from './verify-profile.js';
import { indexSkills, getRecommendedSkills } from './skill-registry.js';
import type {
  TechStack,
  CapabilityDiagnosticReport,
  CapabilityGap,
  RiskFlag,
  CapabilityHealthStatus,
} from './capability-model.js';

// ─── Public API ───

/**
 * Full capability health assessment.
 * Deterministic: same project state → same report.
 */
export async function assessHealth(projectPath: string): Promise<CapabilityDiagnosticReport> {
  const gaps: CapabilityGap[] = [];
  const riskFlags: RiskFlag[] = [];
  const suggestions: string[] = [];

  const detectionResult = await checkDetection(projectPath);
  const coverageResult = await checkCoverage(projectPath);
  const riskResult = await checkRisk(projectPath);

  gaps.push(...coverageResult.gaps);
  riskFlags.push(...riskResult);

  if (detectionResult.status === 'fail') {
    gaps.push({
      type: 'verification',
      description: 'Tech stack detection failed — no configuration files found',
      recommendedAction: 'Ensure project has package.json, pom.xml, go.mod, or similar',
      severity: 'high',
    });
  }

  if (detectionResult.status === 'partial') {
    suggestions.push('Detection was partial — consider adding more configuration files');
  }

  // Status mapping: no gaps = healthy, gaps no high = warning, any high = error
  let status: CapabilityHealthStatus = 'healthy';
  if (gaps.length > 0) {
    const hasHigh = gaps.some((g) => g.severity === 'high');
    status = hasHigh ? 'error' : 'warning';
  }

  return { status, gaps, riskFlags, suggestions };
}

// ─── Internal Checks ───

async function checkDetection(
  projectPath: string,
): Promise<{ status: 'pass' | 'fail' | 'partial'; sources: string[] }> {
  try {
    const detection = await detectTechStack(projectPath);
    const sources = detection.sources ?? [];

    if (sources.length === 0) return { status: 'fail', sources: [] };
    if (detection.confidence >= 0.8) return { status: 'pass', sources };
    return { status: 'partial', sources };
  } catch {
    return { status: 'fail', sources: [] };
  }
}

async function checkCoverage(
  projectPath: string,
): Promise<{ gaps: CapabilityGap[]; warnings: string[] }> {
  const gaps: CapabilityGap[] = [];
  const warnings: string[] = [];

  try {
    const detection = await detectTechStack(projectPath);
    if (detection.sources.length === 0) return { gaps, warnings };

    // Check rules
    const expectedProfile = await generateRules(detection.techStack, detection.projectIntent);
    const rulesPath = path.join(projectPath, '.ivy', 'rules.yaml');
    const rulesExist = await fileExists(rulesPath).catch(() => false);

    if (!rulesExist) {
      // Count expected context rules (non-core, non-optional)
      const expectedContext = expectedProfile.rules.filter(
        (r) => r.tier === 'context' && !r.id.startsWith('no-'),
      ).length;
      if (expectedContext > 0) {
        gaps.push({
          type: 'rule',
          description: `No rules deployed — expected ~${expectedContext} context rules for detected stack`,
          recommendedAction: 'Run `ivy rules generate` to deploy rules',
          severity: 'high',
        });
      }
    }

    // Check skills
    const allSkills = await indexSkills();
    if (allSkills.length > 0) {
      const recs = await getRecommendedSkills(detection.techStack, detection.projectIntent);
      const autoRecs = recs.filter((r) => r.installMode === 'auto');
      if (autoRecs.length > 0) {
        gaps.push({
          type: 'skill',
          description: `${autoRecs.length} auto-recommended skill(s) available: ${autoRecs.map((r) => r.id).join(', ')}`,
          recommendedAction: 'Install via skill registry',
          severity: 'medium',
        });
      }
    }

    // Check verify profile
    const verifyPath = path.join(projectPath, '.ivy', 'verify.yaml');
    const verifyExists = await fileExists(verifyPath).catch(() => false);
    if (!verifyExists) {
      gaps.push({
        type: 'verification',
        description: 'No verification profile configured',
        recommendedAction: 'Run `ivy capability profile` to generate one',
        severity: 'medium',
      });
    }
  } catch (err) {
    warnings.push(`Coverage check error: ${(err as Error).message}`);
  }

  return { gaps, warnings };
}

async function checkRisk(
  projectPath: string,
): Promise<RiskFlag[]> {
  const flags: RiskFlag[] = [];

  try {
    const currentDetection = await detectTechStack(projectPath);
    const currentTech = collectTech(currentDetection.techStack);

    // Check for stale rules
    const rulesPath = path.join(projectPath, '.ivy', 'rules.yaml');
    if (await fileExists(rulesPath).catch(() => false)) {
      const ruleData = await readYaml<Record<string, unknown>>(rulesPath).catch(() => null);
      if (ruleData?.rules) {
        const rules = ruleData.rules as Array<Record<string, unknown>>;
        for (const rule of rules) {
          const triggers = (rule.tech_stack_trigger as string[]) ?? [];
          if (triggers.length > 0 && !triggers.some((t) => currentTech.includes(t))) {
            flags.push({
              type: 'stale',
              description: `Stale rule: ${rule.id as string} — ${triggers.join(', ')} not in current stack`,
            });
          }
        }
      }
    }

    // Tech stack drift between capability.yaml and current scan
    const capPath = path.join(projectPath, '.ivy', 'capability.yaml');
    if (await fileExists(capPath).catch(() => false)) {
      const cached = await readYaml<Record<string, unknown>>(capPath).catch(() => null);
      if (cached) {
        const cachedTech = (cached.tech_stack as Record<string, unknown>) ?? {};
        const cachedKeys = Object.keys(cachedTech);
        const currentKeys = Object.keys(currentDetection.techStack);

        if (cachedKeys.length > 0 && currentKeys.length > 0 && cachedKeys.join(',') !== currentKeys.join(',')) {
          flags.push({
            type: 'misaligned',
            description: 'Tech stack drift detected — cached detection differs from current scan',
          });
        }
      }
    }

    // Rule conflicts
    const expectedProfile = await generateRules(currentDetection.techStack, currentDetection.projectIntent);
    const { detectConflicts } = await import('./rule-generator.js');
    const conflicts = detectConflicts(expectedProfile.rules);
    if (conflicts.length > 0) {
      for (const c of conflicts) {
        flags.push({
          type: 'conflict',
          description: `Rule conflict: ${c.description}`,
        });
      }
    }
  } catch (err) {
    logger.dim(`Risk check error: ${(err as Error).message}`);
  }

  return flags;
}

// ─── Helper ───

function collectTech(ts: TechStack): string[] {
  const result: string[] = [];
  if (ts.language) result.push(...ts.language);
  if (ts.frontend) result.push(...ts.frontend);
  if (ts.backend) result.push(...ts.backend);
  if (ts.testFramework) result.push(...ts.testFramework);
  if (ts.e2eFramework) result.push(ts.e2eFramework);
  return [...new Set(result)];
}

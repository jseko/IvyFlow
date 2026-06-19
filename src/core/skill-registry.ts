/**
 * Skill Registry — v0.14 Sprint 14.3.
 *
 * Indexes built-in skills and provides deterministic/heuristic recommendations
 * based on detected tech stack.
 */

import path from 'path';

import { readYaml } from '../utils/yaml.js';
import { fileExists } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import type {
  TechStack,
  SkillEntry,
  SkillDeterminism,
  SkillInstallMode,
} from './capability-model.js';

// ─── Constants ───

const MAX_BUILTIN_SKILLS = 20;

// ─── Public API ───

export interface RecommendedSkill {
  id: string;
  name: string;
  category: SkillEntry['category'];
  determinism: SkillDeterminism;
  installMode: SkillInstallMode;
  reason: string;
}

/**
 * Index all built-in skills from skill-mapping.yaml.
 */
export async function indexSkills(
  mappingPath?: string,
): Promise<SkillEntry[]> {
  const mapFile = mappingPath ?? path.join(process.cwd(), 'assets', 'capability', 'skill-mapping.yaml');
  const exists = await fileExists(mapFile).catch(() => false);
  if (!exists) {
    logger.warn(`Skill mapping not found at ${mapFile}, returning empty registry`);
    return [];
  }

  const mapping = (await readYaml(mapFile)) as Record<string, unknown>;
  const entries: SkillEntry[] = [];

  // Deterministic skills
  const det = (mapping.deterministic as Record<string, unknown>) ?? {};
  for (const [tech, skills] of Object.entries(det)) {
    for (const s of skills as Array<Record<string, unknown>>) {
      entries.push({
        id: s.id as string,
        name: s.id as string,
        category: (s.category as SkillEntry['category']) ?? 'testing',
        determinism: 'deterministic',
        source: 'builtin',
        installMode: (s.installMode as SkillInstallMode) ?? 'recommend',
        techStackTrigger: [tech],
      });
    }
  }

  // Heuristic skills
  const heu = (mapping.heuristic as Record<string, unknown>) ?? {};
  const alwaysSkills = (heu._always as Array<Record<string, unknown>>) ?? [];
  for (const s of alwaysSkills) {
    entries.push({
      id: s.id as string,
      name: s.id as string,
      category: (s.category as SkillEntry['category']) ?? 'review',
      determinism: 'heuristic',
      source: 'builtin',
      installMode: (s.installMode as SkillInstallMode) ?? 'recommend',
      techStackTrigger: [],
    });
  }

  // Enforce max limit
  return entries.slice(0, MAX_BUILTIN_SKILLS);
}

/**
 * Get recommended skills based on tech stack + project intent.
 */
export async function getRecommendedSkills(
  techStack: TechStack,
  _projectIntent?: string,
): Promise<RecommendedSkill[]> {
  const all = await indexSkills();
  const allTech = collectAllTech(techStack);
  const recommended: RecommendedSkill[] = [];

  for (const skill of all) {
    if (skill.determinism === 'deterministic') {
      // Only recommend if tech stack matches
      const matches = skill.techStackTrigger.some((t) => allTech.includes(t));
      if (!matches) continue;
      recommended.push({
        id: skill.id,
        name: skill.name,
        category: skill.category,
        determinism: 'deterministic',
        installMode: skill.installMode,
        reason: `Detected: ${skill.techStackTrigger.join(', ')}`,
      });
    } else {
      // Heuristic: always recommend as advisory
      recommended.push({
        id: skill.id,
        name: skill.name,
        category: skill.category,
        determinism: 'heuristic',
        installMode: skill.installMode,
        reason: skill.installMode === 'manual'
          ? 'Has external dependencies — requires user confirmation'
          : 'General purpose',
      });
    }
  }

  return recommended;
}

/**
 * List all available skills in the registry.
 */
export async function listAvailableSkills(): Promise<SkillEntry[]> {
  return indexSkills();
}

// ─── Helpers ───

function collectAllTech(ts: TechStack): string[] {
  const result: string[] = [];
  if (ts.language) result.push(...ts.language);
  if (ts.frontend) result.push(...ts.frontend);
  if (ts.backend) result.push(...ts.backend);
  if (ts.testFramework) result.push(...ts.testFramework);
  if (ts.e2eFramework) result.push(ts.e2eFramework);
  return [...new Set(result)];
}

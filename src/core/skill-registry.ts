/**
 * Skill Registry — v0.15 Sprint 15.3.
 * Stub for Sprint 15.1 compilation. Will be fully implemented in Sprint 15.3.
 */

export interface SkillEntry {
  id: string;
  name: string;
  category: 'design' | 'review' | 'testing' | 'security' | 'performance' | 'documentation';
  source: 'builtin' | 'local';
  installMode: 'auto' | 'recommend' | 'manual';
  techStackTrigger: string[];
  path?: string;
}

export type MaturityLevel = 'prototype' | 'development' | 'production';

export const BUILTIN_SKILLS: SkillEntry[] = [
  { id: 'code-reviewer', name: 'Code Reviewer', category: 'review', source: 'builtin', installMode: 'recommend', techStackTrigger: ['_always'] },
  { id: 'security-review', name: 'Security Review', category: 'security', source: 'builtin', installMode: 'manual', techStackTrigger: ['_always'] },
  { id: 'playwright-e2e', name: 'Playwright E2E', category: 'testing', source: 'builtin', installMode: 'auto', techStackTrigger: ['playwright'] },
  { id: 'frontend-patterns', name: 'Frontend Patterns', category: 'design', source: 'builtin', installMode: 'recommend', techStackTrigger: ['nextjs', 'react'] },
];

export function getRecommendedSkills(techStacks: string[]): SkillEntry[] {
  return BUILTIN_SKILLS.filter(s =>
    s.techStackTrigger.includes('_always') ||
    s.techStackTrigger.some(t => techStacks.includes(t))
  ).filter(s => s.installMode !== 'manual');
}

export function listSkills(): SkillEntry[] {
  return BUILTIN_SKILLS;
}

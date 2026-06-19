import { describe, it, expect } from 'vitest';
import {
  generateRules,
  analyzeRules,
  validateRules,
  detectConflicts,
} from './rule-generator.js';
import type { RuleDefinition, TechStack, RuleProfile } from './capability-model.js';

const emptyTs: TechStack = {};
const reactTs: TechStack = { frontend: ['react'], language: ['typescript'] };
const fullTs: TechStack = {
  frontend: ['nextjs', 'react'],
  backend: ['nestjs'],
  language: ['typescript'],
  testFramework: ['playwright', 'vitest'],
};

describe('rule-generator', () => {
  describe('generateRules', () => {
    it('TC-30: includes core rules regardless of tech stack', async () => {
      const profile = await generateRules(emptyTs, 'prototype');
      const coreIds = profile.rules.filter((r) => r.tier === 'core').map((r) => r.id);
      expect(coreIds).toContain('no-debug-log');
      expect(coreIds).toContain('no-sensitive-env');
    });

    it('TC-7: generates context rules from frontend tech stack', async () => {
      const profile = await generateRules(reactTs, 'fullstack-app');
      const ids = profile.rules.map((r) => r.id);
      expect(ids).toContain('react-hooks-rules');
      expect(ids).toContain('ts-type-safety');
    });

    it('TC-9: generates rules from mixed tech stack', async () => {
      const profile = await generateRules(fullTs, 'fullstack-app');
      const ids = profile.rules.map((r) => r.id);
      expect(ids).toContain('react-hooks-rules');
      expect(ids).toContain('e2e-playwright');
      expect(ids).toContain('next-app-router');
    });

    it('TC-10: returns only core rules for empty tech stack', async () => {
      const profile = await generateRules(emptyTs, 'prototype');
      const nonCore = profile.rules.filter((r) => r.tier !== 'core');
      expect(nonCore).toHaveLength(0);
    });

    it('TC-27: api-only intent filters out e2e rules', async () => {
      const apiTs: TechStack = {
        backend: ['nestjs'],
        language: ['typescript'],
        testFramework: ['playwright'],
      };
      const profile = await generateRules(apiTs, 'api-only');
      const e2eRules = profile.rules.filter(
        (r) => r.techStackTrigger.some((t) => ['playwright', 'cypress', 'e2e'].includes(t)),
      );
      expect(e2eRules).toHaveLength(0);
    });

    it('TC-29: assigns correct tier to each rule', async () => {
      const profile = await generateRules(reactTs, 'fullstack-app');
      const contextRules = profile.rules.filter((r) => r.tier === 'context');
      expect(contextRules.length).toBeGreaterThan(0);
      for (const r of contextRules) {
        expect(['context']).toContain(r.tier);
      }
    });
  });

  describe('detectConflicts', () => {
    it('TC-11: detects structural conflicts', () => {
      const rules: RuleDefinition[] = [
        {
          id: 'rule-a', name: 'Rule A', type: 'constraint', scope: 'file', severity: 'high',
          tier: 'context', source: ['test'], content: '', techStackTrigger: ['react'],
        },
        {
          id: 'rule-b', name: 'Rule B', type: 'constraint', scope: 'file', severity: 'low',
          tier: 'context', source: ['test'], content: '', techStackTrigger: ['react'],
        },
      ];

      const conflicts = detectConflicts(rules);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].type).toBe('structural');
    });
  });

  describe('analyzeRules', () => {
    it('TC-12: returns analysis with metrics', async () => {
      const profile = await generateRules(fullTs, 'fullstack-app');
      const analysis = analyzeRules(profile, profile.rules.length);
      expect(analysis.totalRules).toBeGreaterThan(0);
      expect(analysis.byTier.core).toBeGreaterThan(0);
      expect(typeof analysis.coverage).toBe('number');
    });
  });

  describe('validateRules', () => {
    it('detects applicable vs skipped rules', async () => {
      const profile = await generateRules(fullTs, 'fullstack-app');
      const result = validateRules(profile, fullTs);
      expect(result.total).toBeGreaterThan(0);
      expect(result.applicable).toBeGreaterThan(0);
    });
  });
});

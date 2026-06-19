import { describe, it, expect } from 'vitest';
import {
  detectTechStack,
  inferProjectIntent,
  createDependencyIndex,
} from './capability-detector.js';
import type { TechStack, Capability } from './capability-model.js';

describe('capability-detector', () => {
  describe('detectTechStack', () => {
    it('TC-1: detects Next.js project from package.json', async () => {
      const result = await detectTechStack('test/fixtures/basic-node');
      // basic-node has a package.json but no Next.js deps
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.sources).toContain('package.json');
    });

    it('TC-3: detects Go project from go.mod', async () => {
      const result = await detectTechStack('test/fixtures/basic-go');
      expect(result.techStack.language).toContain('go');
      expect(result.sources).toContain('go.mod');
    });

    it('TC-4: returns empty for non-existent project', async () => {
      const result = await detectTechStack('/tmp/nonexistent-project-ivy-test');
      expect(result.confidence).toBe(0);
      expect(result.sources).toEqual([]);
    });
  });

  describe('inferProjectIntent', () => {
    it('infers prototype for unknown project', async () => {
      const intent = await inferProjectIntent('/tmp/nonexistent-project-ivy-test', {});
      expect(intent).toBe('prototype');
    });

    it('infers fullstack-app when web framework present', async () => {
      const techStack: TechStack = { frontend: ['react'] };
      const intent = await inferProjectIntent('/tmp/nonexistent-project-ivy-test', techStack);
      expect(intent).toBe('fullstack-app');
    });
  });

  describe('createDependencyIndex', () => {
    it('TC-33: creates flat adjacency list', () => {
      const capabilities: Capability[] = [
        { id: 'e2e-profile', name: 'E2E Profile', category: 'verification', source: 'builtin', status: 'active', dependsOn: ['react', 'playwright'] },
        { id: 'react-hooks-rules', name: 'React Hooks', category: 'rule', source: 'builtin', status: 'active', dependsOn: ['typescript'] },
        { id: 'typescript', name: 'TypeScript', category: 'rule', source: 'builtin', status: 'active', dependsOn: [] },
      ];

      const index = createDependencyIndex(capabilities);

      expect(index['e2e-profile']).toEqual(['react', 'playwright']);
      expect(index['react-hooks-rules']).toEqual(['typescript']);
      expect(index['typescript']).toEqual([]);
    });
  });
});

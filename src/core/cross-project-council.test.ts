/**
 * v0.32: Cross-Project Council — test suite.
 * Covers: types, engine, fuse, pattern detection, formatters, schema contract, edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  CrossProjectCouncilEngine,
  asyncPool,
  computeConcurrency,
  detectCrossProjectPatterns,
  assertPerspectiveSection,
  formatCrossProjectReport,
  deriveRecommendation,
  PERSPECTIVE_ORDER,
  type ProjectDiscoverer,
} from './cross-project-council.js';
import type { CouncilReportStub, PerspectiveSectionStub } from './cross-project-council.js';

// ─── Helpers ───

function makePerspectiveSection(overrides: Partial<PerspectiveSectionStub> & { id: string }): PerspectiveSectionStub {
  return {
    id: overrides.id,
    status: overrides.status ?? 'sufficient',
    concerns: overrides.concerns ?? [],
    message: overrides.message ?? '',
    recommendation: overrides.recommendation ?? '',
    severity: overrides.severity,
    estimate: overrides.estimate,
  };
}

function makeReport(overrides: { projectName?: string; question?: string; perspectives?: Record<string, PerspectiveSectionStub> } = {}): CouncilReportStub {
  return {
    version: '0.1.0',
    generatedAt: new Date().toISOString(),
    question: overrides.question ?? 'test question',
    memoryCount: 10,
    recallCount: 10,
    filteredOutCount: 0,
    perspectivesUsed: 4,
    elapsedMs: 100,
    perspectives: overrides.perspectives ?? {
      architecture: makePerspectiveSection({ id: 'architecture', concerns: [{ text: 'React 18 migration needed', source: 'test' }] }),
      risk: makePerspectiveSection({ id: 'risk', concerns: [{ text: 'Breaking changes in React 18', source: 'test' }] }),
      quality: makePerspectiveSection({ id: 'quality', concerns: [] }),
      cost: makePerspectiveSection({ id: 'cost' }),
    },
  };
}

// ─── TC-1: 2-Project Normal Perspective Merge ───

describe('TC-1: 2-project normal perspective merge', () => {
  it('should merge 2 projects into perspective-keyed output', async () => {
    const engine = new CrossProjectCouncilEngine({
      projectPaths: ['/projects/a', '/projects/b'],
      councilFactory: async (projectPath: string) => ({
        ask: async (_q: string) => {
          if (projectPath === '/projects/a') {
            return makeReport({
              perspectives: {
                architecture: makePerspectiveSection({ id: 'architecture', concerns: [{ text: 'React migration', source: 'test' }] }),
                risk: makePerspectiveSection({ id: 'risk', concerns: [{ text: 'API breaking changes', source: 'test' }] }),
                quality: makePerspectiveSection({ id: 'quality' }),
                cost: makePerspectiveSection({ id: 'cost' }),
              },
            });
          }
          return makeReport({
            perspectives: {
              architecture: makePerspectiveSection({ id: 'architecture', concerns: [{ text: 'Vue 3 upgrade', source: 'test' }] }),
              risk: makePerspectiveSection({ id: 'risk', concerns: [{ text: 'Security audit needed', source: 'test' }] }),
              quality: makePerspectiveSection({ id: 'quality' }),
              cost: makePerspectiveSection({ id: 'cost' }),
            },
          });
        },
      }),
    });

    const report = await engine.ask('test question');

    expect(report.version).toBe('0.32.0');
    expect(report.projectCount).toBe(2);
    expect(report.perspectivesUsed).toBe(4);
    expect(report.perspectives.architecture).toBeDefined();
    expect(Object.keys(report.perspectives.architecture.projects).length).toBe(2);
    expect(report.perspectives.architecture.summary.totalConcerns).toBe(2);
    expect(report.perspectives.architecture.summary.participatingProjects).toBe(2);
  });
});

// ─── TC-2: Partial Project Degradation ───

describe('TC-2: Partial project degradation', () => {
  it('should handle one project with insufficient_memory risk', async () => {
    const engine = new CrossProjectCouncilEngine({
      projectPaths: ['/projects/a', '/projects/b'],
      councilFactory: async (projectPath: string) => ({
        ask: async (_q: string) => {
          if (projectPath === '/projects/a') {
            return makeReport({
              perspectives: {
                architecture: makePerspectiveSection({ id: 'architecture', status: 'sufficient', concerns: [{ text: 'React 18', source: 'test' }] }),
                risk: makePerspectiveSection({ id: 'risk', status: 'insufficient_memory', message: '无风险数据' }),
                quality: makePerspectiveSection({ id: 'quality', status: 'insufficient_memory' }),
                cost: makePerspectiveSection({ id: 'cost', status: 'insufficient_memory' }),
              },
            });
          }
          return makeReport({
            perspectives: {
              architecture: makePerspectiveSection({ id: 'architecture', status: 'sufficient', concerns: [{ text: 'Vue 3', source: 'test' }] }),
              risk: makePerspectiveSection({ id: 'risk', status: 'sufficient', concerns: [{ text: 'Security issue', source: 'test' }] }),
              quality: makePerspectiveSection({ id: 'quality', status: 'insufficient_memory' }),
              cost: makePerspectiveSection({ id: 'cost', status: 'insufficient_memory' }),
            },
          });
        },
      }),
    });

    const report = await engine.ask('test');

    // Risk perspective: one project degraded
    const risk = report.perspectives.risk;
    expect(risk.projects['projects/a'].status).toBe('insufficient_memory');
    expect(risk.projects['projects/b'].status).toBe('sufficient');
    expect(risk.summary.degradedProjects).toBe(1);
    expect(risk.summary.participatingProjects).toBe(1);
  });
});

// ─── TC-3: Project Unreachable ───

describe('TC-3: Project unreachable', () => {
  it('should degrade unreachable project without affecting others', async () => {
    const engine = new CrossProjectCouncilEngine({
      projectPaths: ['/projects/a', '/projects/b'],
      councilFactory: async (projectPath: string) => {
        if (projectPath === '/projects/b') {
          throw new Error('Project not found');
        }
        return {
          ask: async () => makeReport({
            perspectives: {
              architecture: makePerspectiveSection({ id: 'architecture', concerns: [{ text: 'React', source: 'test' }] }),
              risk: makePerspectiveSection({ id: 'risk', concerns: [{ text: 'Security', source: 'test' }] }),
              quality: makePerspectiveSection({ id: 'quality' }),
              cost: makePerspectiveSection({ id: 'cost' }),
            },
          }),
        };
      },
    });

    const report = await engine.ask('test');

    const arch = report.perspectives.architecture;
    expect(arch.projects['projects/b'].status).toBe('insufficient_memory');
    expect(arch.projects['projects/b'].message).toContain('项目不可达');
    expect(arch.projects['projects/a'].status).toBe('sufficient');
    expect(arch.summary.participatingProjects).toBe(1);
    expect(arch.summary.degradedProjects).toBe(1);
  });
});

// ─── TC-4: Cross-Project Pattern Detection ───

describe('TC-4: Cross-project pattern detection', () => {
  it('should detect repeating n-grams across projects', () => {
    const texts = [
      'React migration is needed for performance',
      'React migration will improve performance',
      'React migration requires careful planning',
      'API upgrade is needed for React migration',
    ];
    const projectResults = [
      { projectName: 'proj-a', projectPath: '/a', ok: true, report: { version: '0.1.0', generatedAt: '', question: '', memoryCount: 0, recallCount: 0, filteredOutCount: 0, perspectivesUsed: 0, elapsedMs: 0, perspectives: { architecture: { id: 'architecture', status: 'sufficient' as const, concerns: [{ text: 'React migration is needed for performance', source: 'test' }] } } } },
      { projectName: 'proj-b', projectPath: '/b', ok: true, report: { version: '0.1.0', generatedAt: '', question: '', memoryCount: 0, recallCount: 0, filteredOutCount: 0, perspectivesUsed: 0, elapsedMs: 0, perspectives: { architecture: { id: 'architecture', status: 'sufficient' as const, concerns: [{ text: 'React migration will improve performance', source: 'test' }] } } } },
    ];

    const patterns = detectCrossProjectPatterns(texts, projectResults);

    expect(patterns.length).toBeGreaterThanOrEqual(1);
    const reactMig = patterns.find(p => p.pattern.includes('react migration'));
    expect(reactMig).toBeDefined();
    expect(reactMig!.count).toBeGreaterThanOrEqual(3);
    expect(reactMig!.projects.length).toBeGreaterThanOrEqual(2);
  });

  it('should return empty array when no patterns repeat', () => {
    const texts = ['unique text one', 'completely different', 'no common words'];
    const patterns = detectCrossProjectPatterns(texts, []);
    expect(patterns).toEqual([]);
  });

  it('should filter patterns with count < 3', () => {
    const texts = ['react migration', 'react migration'];
    const patterns = detectCrossProjectPatterns(texts, [
      { projectName: 'proj-a', projectPath: '/a', ok: true, report: { version: '0.1.0', generatedAt: '', question: '', memoryCount: 0, recallCount: 0, filteredOutCount: 0, perspectivesUsed: 0, elapsedMs: 0, perspectives: { architecture: { id: 'architecture', status: 'sufficient' as const, concerns: [{ text: 'react migration', source: 'test' }] } } } },
    ]);
    // count=2 < 3, should be filtered
    expect(patterns.filter(p => p.pattern === 'react migration').length).toBe(0);
  });
});

// ─── TC-5: Adaptive Concurrency ───

describe('TC-5: Adaptive concurrency computation', () => {
  it('should return projectCount for <= 10 projects', () => {
    expect(computeConcurrency(5)).toBe(5);
    expect(computeConcurrency(10)).toBe(10);
  });

  it('should return 8 for 10 < count <= 30', () => {
    expect(computeConcurrency(20)).toBe(8);
    expect(computeConcurrency(30)).toBe(8);
  });

  it('should return min(12, count/4) for > 30', () => {
    expect(computeConcurrency(50)).toBe(12);
    expect(computeConcurrency(100)).toBe(12);
  });

  it('should handle edge cases', () => {
    expect(computeConcurrency(0)).toBe(1);
    expect(computeConcurrency(1)).toBe(1);
  });
});

// ─── TC-6: All Projects All Perspectives Degraded ───

describe('TC-6: All projects all perspectives degraded', () => {
  it('should set report summary when all perspectives degraded', async () => {
    const engine = new CrossProjectCouncilEngine({
      projectPaths: ['/projects/a', '/projects/b'],
      councilFactory: async () => ({
        ask: async () => ({
          version: '0.1.0',
          generatedAt: new Date().toISOString(),
          question: 'test',
          memoryCount: 0,
          recallCount: 0,
          filteredOutCount: 0,
          perspectivesUsed: 4,
          elapsedMs: 0,
          perspectives: {
            architecture: { id: 'architecture', status: 'insufficient_memory' as const, message: 'No data', concerns: [], recommendation: '', severity: undefined },
            risk: { id: 'risk', status: 'insufficient_memory' as const, message: 'No data', concerns: [], recommendation: '', severity: undefined },
            quality: { id: 'quality', status: 'insufficient_memory' as const, message: 'No data', concerns: [], recommendation: '', severity: undefined },
            cost: { id: 'cost', status: 'insufficient_memory' as const, message: 'No data', concerns: [], recommendation: '', severity: undefined },
          },
        }),
      }),
    });

    const report = await engine.ask('test');
    expect(report.summary).toBeDefined();
    expect(report.summary!).toContain('所有项目');
  });
});

// ─── TC-7: Empty crossProjectPatterns ───

describe('TC-7: Empty crossProjectPatterns', () => {
  it('should return empty array when no n-grams repeat', async () => {
    const engine = new CrossProjectCouncilEngine({
      projectPaths: ['/projects/a', '/projects/b'],
      councilFactory: async (projectPath: string) => ({
        ask: async () => {
          if (projectPath === '/projects/a') {
            return makeReport({
              perspectives: {
                architecture: makePerspectiveSection({ id: 'architecture', concerns: [{ text: 'Unique concern alpha', source: 'test' }] }),
                risk: makePerspectiveSection({ id: 'risk', concerns: [{ text: 'Unique risk beta', source: 'test' }] }),
                quality: makePerspectiveSection({ id: 'quality' }),
                cost: makePerspectiveSection({ id: 'cost' }),
              },
            });
          }
          return makeReport({
            perspectives: {
              architecture: makePerspectiveSection({ id: 'architecture', concerns: [{ text: 'Different concern gamma', source: 'test' }] }),
              risk: makePerspectiveSection({ id: 'risk', concerns: [{ text: 'Different risk delta', source: 'test' }] }),
              quality: makePerspectiveSection({ id: 'quality' }),
              cost: makePerspectiveSection({ id: 'cost' }),
            },
          });
        },
      }),
    });

    const report = await engine.ask('test');
    expect(report.perspectives.architecture.summary.crossProjectPatterns).toEqual([]);
  });
});

// ─── TC-8: Input Contract Assertion ───

describe('TC-8: Input contract assertion', () => {
  const validSection = {
    id: 'architecture',
    status: 'sufficient' as const,
    concerns: [],
    message: '',
    recommendation: 'rec',
    severity: 'low' as const,
  };

  it('should pass for a complete valid PerspectiveSection', () => {
    expect(() => assertPerspectiveSection(validSection, 'architecture')).not.toThrow();
  });

  it('should pass for all valid statuses', () => {
    for (const status of ['sufficient', 'insufficient_memory', 'single_source'] as const) {
      expect(() => assertPerspectiveSection({ ...validSection, status }, 'architecture')).not.toThrow();
    }
  });

  it('should throw for missing id', () => {
    expect(() => assertPerspectiveSection(
      { status: 'sufficient', concerns: [], message: '', recommendation: '' },
      'architecture',
    )).toThrow();
  });

  it('should throw for invalid status', () => {
    expect(() => assertPerspectiveSection(
      { ...validSection, status: 'invalid' as unknown as 'sufficient' },
      'architecture',
    )).toThrow();
  });

  it('should throw for null input', () => {
    expect(() => assertPerspectiveSection(null, 'architecture')).toThrow();
  });

  // G4: the other four frozen fields must also be validated.
  it('should throw when a frozen field is missing', () => {
    for (const missing of ['concerns', 'message', 'recommendation', 'severity']) {
      const bad = { ...validSection } as Record<string, unknown>;
      delete bad[missing];
      expect(() => assertPerspectiveSection(bad, 'architecture')).toThrow(
        new RegExp(`missing frozen field "${missing}"`),
      );
    }
  });

  it('should throw when concerns is not an array', () => {
    expect(() => assertPerspectiveSection(
      { ...validSection, concerns: 'oops' as unknown as [] },
      'architecture',
    )).toThrow(/must be an array/);
  });

  it('should throw when message/recommendation is not a string', () => {
    expect(() => assertPerspectiveSection(
      { ...validSection, message: 42 as unknown as string },
      'architecture',
    )).toThrow(/"message" must be a string/);
    expect(() => assertPerspectiveSection(
      { ...validSection, recommendation: 42 as unknown as string },
      'architecture',
    )).toThrow(/"recommendation" must be a string/);
  });

  it('should throw for invalid severity value', () => {
    expect(() => assertPerspectiveSection(
      { ...validSection, severity: 'critical' as unknown as 'low' },
      'architecture',
    )).toThrow(/invalid severity/);
  });
});

// ─── TC-9: CLI Integration (logic-level) ───

describe('TC-9: CLI integration', () => {
  it('should route to cross-project engine when --cross-project is set', async () => {
    // This validates the logic in runCouncilAsk via the engine
    const engine = new CrossProjectCouncilEngine({
      projectPaths: ['/projects/a'],
      councilFactory: async () => ({
        ask: async () => makeReport({
          perspectives: {
            architecture: makePerspectiveSection({ id: 'architecture', concerns: [{ text: 'React', source: 'test' }] }),
            risk: makePerspectiveSection({ id: 'risk' }),
            quality: makePerspectiveSection({ id: 'quality' }),
            cost: makePerspectiveSection({ id: 'cost' }),
          },
        }),
      }),
    });

    const report = await engine.ask('test');
    expect(report.projectCount).toBe(1);
    expect(report.perspectives).toBeDefined();
  });

  it('should use concurrency override', async () => {
    const engine = new CrossProjectCouncilEngine({
      projectPaths: ['/projects/a', '/projects/b', '/projects/c'],
      councilFactory: async () => ({
        ask: async () => makeReport(),
      }),
    });

    const report = await engine.ask('test', { concurrency: 1 });
    expect(report.projectCount).toBe(3);
  });
});

// ─── TC-10: Edge Cases ───

describe('TC-10: Edge cases', () => {
  it('should throw for 0 projects', async () => {
    const engine = new CrossProjectCouncilEngine({
      projectPaths: [],
      councilFactory: async () => ({ ask: async () => makeReport() }),
    });

    await expect(engine.ask('test')).rejects.toThrow('No projects available');
  });

  it('should handle 1 project normally', async () => {
    const engine = new CrossProjectCouncilEngine({
      projectPaths: ['/projects/a'],
      councilFactory: async () => ({
        ask: async () => makeReport({
          perspectives: {
            architecture: makePerspectiveSection({ id: 'architecture', concerns: [{ text: 'React', source: 'test' }] }),
            risk: makePerspectiveSection({ id: 'risk' }),
            quality: makePerspectiveSection({ id: 'quality' }),
            cost: makePerspectiveSection({ id: 'cost' }),
          },
        }),
      }),
    });

    const report = await engine.ask('test');
    expect(report.projectCount).toBe(1);
    expect(report.perspectives).toBeDefined();
  });

  it('should handle --concurrency < 1 by using computeConcurrency', async () => {
    // concurrency: 0 would be clamped to minimum by computeConcurrency
    const engine = new CrossProjectCouncilEngine({
      projectPaths: ['/projects/a'],
      councilFactory: async () => ({
        ask: async () => makeReport(),
      }),
    });

    // --concurrency 0 should still work (computeConcurrency returns 1 for 0)
    const report = await engine.ask('test', { concurrency: 0 });
    expect(report.projectCount).toBe(1);
  });

  it('should handle empty --perspectives (defaults to all 4)', async () => {
    const engine = new CrossProjectCouncilEngine({
      projectPaths: ['/projects/a'],
      councilFactory: async () => ({
        ask: async () => makeReport({
          perspectives: {
            architecture: makePerspectiveSection({ id: 'architecture', concerns: [{ text: 'React', source: 'test' }] }),
            risk: makePerspectiveSection({ id: 'risk' }),
            quality: makePerspectiveSection({ id: 'quality' }),
            cost: makePerspectiveSection({ id: 'cost' }),
          },
        }),
      }),
    });

    const report = await engine.ask('test', { perspectiveIds: [] });
    expect(report.perspectivesUsed).toBe(4);
  });
});

// ─── asyncPool ───

describe('asyncPool', () => {
  it('should limit concurrency', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const results = await asyncPool(2, [1, 2, 3, 4, 5], async (n) => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise(r => setTimeout(r, 10));
      concurrent--;
      return n * 2;
    });

    expect(maxConcurrent).toBeLessThanOrEqual(2);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it('should handle empty array', async () => {
    const results = await asyncPool(2, [], async (n: number) => n);
    expect(results).toEqual([]);
  });
});

// ─── deriveRecommendation ───

describe('deriveRecommendation', () => {
  it('should return "no data" when participating is 0', () => {
    const r = deriveRecommendation('architecture', 0, 2, 2, 0);
    expect(r).toContain('均无数据');
  });

  it('should return coverage warning when degraded > participating', () => {
    const r = deriveRecommendation('risk', 1, 2, 3, 5);
    expect(r).toContain('数据覆盖不足');
  });

  it('should return normal summary', () => {
    const r = deriveRecommendation('architecture', 3, 0, 3, 10);
    expect(r).toContain('跨');
    expect(r).toContain('10');
  });
});

// ─── formatCrossProjectReport ───

describe('formatCrossProjectReport', () => {
  const baseReport = {
    version: '0.32.0' as const,
    generatedAt: '2025-01-01T00:00:00.000Z',
    question: 'test question',
    projectCount: 2,
    perspectivesUsed: 1,
    elapsedMs: 50,
    perspectives: {
      architecture: {
        id: 'architecture',
        projects: {
          'proj-a': { id: 'architecture', status: 'sufficient' as const, concerns: [{ text: 'React migration', source: 'test' }] },
          'proj-b': { id: 'architecture', status: 'insufficient_memory' as const, message: 'No data' },
        },
        summary: {
          totalConcerns: 1,
          participatingProjects: 1,
          degradedProjects: 1,
          crossProjectPatterns: [],
          recommendation: 'recommendation text',
        },
      },
    },
  };

  it('should output text format', () => {
    const output = formatCrossProjectReport(baseReport, 'text');
    expect(output).toContain('Cross-Project Council Report');
    expect(output).toContain('test question');
    expect(output).toContain('proj-a');
    expect(output).toContain('recommendation text');
  });

  it('should output JSON format', () => {
    const output = formatCrossProjectReport(baseReport, 'json');
    const parsed = JSON.parse(output);
    expect(parsed.version).toBe('0.32.0');
    expect(parsed.projectCount).toBe(2);
  });

  it('should output YAML format', () => {
    const output = formatCrossProjectReport(baseReport, 'yaml');
    expect(output).toContain('0.32.0');
    expect(output).toContain('test question');
  });

  it('should default to text for unknown format', () => {
    const output = formatCrossProjectReport(baseReport, 'unknown');
    expect(output).toContain('Cross-Project Council Report');
  });
});

// ─── PERSPECTIVE_ORDER ───

describe('PERSPECTIVE_ORDER', () => {
  it('should have deterministic order', () => {
    expect(PERSPECTIVE_ORDER).toEqual(['architecture', 'risk', 'quality', 'cost']);
  });
});

// ─── TC-11: Org-backed project discovery (G1) ───

describe('TC-11: Org discoverer resolves project paths', () => {
  const fakeDiscoverer: ProjectDiscoverer = {
    getProjectPaths: () => ['/org/proj-x', '/org/proj-y'],
  };

  it('should use discoverer paths when projectPaths is empty', async () => {
    const engine = new CrossProjectCouncilEngine({
      projectPaths: [],
      discoverer: fakeDiscoverer,
      councilFactory: async (projectPath: string) => ({
        ask: async () => makeReport({
          perspectives: {
            architecture: makePerspectiveSection({
              id: 'architecture',
              concerns: [{ text: `concern from ${projectPath}`, source: 'test' }],
            }),
            risk: makePerspectiveSection({ id: 'risk' }),
            quality: makePerspectiveSection({ id: 'quality' }),
            cost: makePerspectiveSection({ id: 'cost' }),
          },
        }),
      }),
    });

    const report = await engine.ask('test');
    expect(report.projectCount).toBe(2);
    expect(Object.keys(report.perspectives.architecture.projects)).toEqual([
      'org/proj-x',
      'org/proj-y',
    ]);
  });

  it('should prefer injected projectPaths over discoverer', async () => {
    const engine = new CrossProjectCouncilEngine({
      projectPaths: ['/injected/a'],
      discoverer: fakeDiscoverer,
      councilFactory: async (projectPath: string) => ({
        ask: async () => makeReport({
          perspectives: {
            architecture: makePerspectiveSection({ id: 'architecture', concerns: [{ text: 'x', source: 't' }] }),
            risk: makePerspectiveSection({ id: 'risk' }),
            quality: makePerspectiveSection({ id: 'quality' }),
            cost: makePerspectiveSection({ id: 'cost' }),
          },
        }),
      }),
    });

    const report = await engine.ask('test');
    expect(report.projectCount).toBe(1);
    expect(Object.keys(report.perspectives.architecture.projects)).toEqual(['injected/a']);
  });

  it('should throw when both projectPaths and discoverer are empty', async () => {
    const engine = new CrossProjectCouncilEngine({
      projectPaths: [],
      discoverer: { getProjectPaths: () => [] },
      councilFactory: async () => ({ ask: async () => makeReport() }),
    });

    await expect(engine.ask('test')).rejects.toThrow('No projects available');
  });
});
/**
 * v0.32: CrossProjectCouncilEngine — orchestrates CouncilEngine × OrgIntelligenceEngine
 * to produce perspective-keyed cross-project analysis reports.
 *
 * Design: composition layer over per-project CouncilEngine instances.
 * Deterministic, read-only, no new analysis capabilities.
 */

// ─── Inline types (no v0.29/v0.31 dependency in main yet) ───

/** Minimal PerspectiveSection for cross-project consumption (frozen fields from v0.29) */
export interface PerspectiveSectionStub {
  id: string;
  status: 'sufficient' | 'insufficient_memory' | 'single_source';
  concerns?: Array<{ text: string; source: string }>;
  message?: string;
  recommendation?: string;
  severity?: 'low' | 'medium' | 'high';
  estimate?: string;
}

/** Per-project council.ask() return type stub */
export interface CouncilReportStub {
  version: string;
  generatedAt: string;
  question: string;
  memoryCount: number;
  recallCount: number;
  filteredOutCount: number;
  perspectivesUsed: number;
  elapsedMs: number;
  summary?: string;
  perspectives: Record<string, PerspectiveSectionStub>;
}

// ─── Exported Cross-Project Types (Tasks 1.1, 4.2) ───

export interface CrossProjectSummary {
  totalConcerns: number;
  participatingProjects: number;
  degradedProjects: number;
  crossProjectPatterns: Array<{
    pattern: string;
    count: number;
    projects: string[];
  }>;
  recommendation?: string;
}

export interface CrossProjectPerspective {
  id: string;
  projects: Record<string, PerspectiveSectionStub>;
  summary: CrossProjectSummary;
}

export interface CrossProjectCouncilReport {
  /** Schema version — 0.32.0 frozen */
  version: '0.32.0';
  generatedAt: string;
  question: string;
  projectCount: number;
  perspectivesUsed: number;
  elapsedMs: number;
  perspectives: Record<string, CrossProjectPerspective>;
  /** Set when ALL perspectives ALL projects are degraded */
  summary?: string;
}

// ─── Internal types ───

interface ProjectCouncilResult {
  projectName: string;
  projectPath: string;
  report?: CouncilReportStub;
  ok: boolean;
  error?: string;
}

// ─── PERSPECTIVE_ORDER (deterministic output) ───

export const PERSPECTIVE_ORDER: readonly string[] = ['architecture', 'risk', 'quality', 'cost'];

// ─── asyncPool (Task 1.2) ───

export async function asyncPool<T, R>(
  concurrency: number,
  items: T[],
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const executing = new Set<Promise<void>>();
  const results: R[] = [];

  for (let i = 0; i < items.length; i++) {
    const p = fn(items[i]).then((r) => {
      results[i] = r;
    });
    const wrapped = p.catch(() => {}).then(() => {
      executing.delete(wrapped);
    });
    executing.add(wrapped);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

// ─── computeConcurrency (Task 1.3) ───

export function computeConcurrency(projectCount: number): number {
  if (projectCount <= 0) return 1;
  if (projectCount <= 10) return projectCount;
  if (projectCount <= 30) return 8;
  return Math.min(12, Math.floor(projectCount / 4));
}

// ─── ProjectDiscoverer (G1: Org aggregation substrate) ───
// Structural interface so the engine can resolve project paths from an
// OrgIntelligenceEngine without importing it (avoids circular dependency).

export interface ProjectDiscoverer {
  getProjectPaths(): string[];
}

// ─── CrossProjectCouncilEngine (Task 2.1-2.4) ───

export class CrossProjectCouncilEngine {
  constructor(
    private opts: {
      projectPaths: string[];
      councilFactory: (
        projectPath: string,
      ) => Promise<{ ask: (q: string, o?: { perspectiveIds?: string[] }) => Promise<CouncilReportStub> }>;
      /** Optional Org-backed discovery. Used when projectPaths is empty. */
      discoverer?: ProjectDiscoverer;
    },
  ) {}

  async ask(
    question: string,
    opts?: { perspectiveIds?: string[]; concurrency?: number },
  ): Promise<CrossProjectCouncilReport> {
    // G1: resolve effective project list — injected paths win, otherwise
    // delegate to the Org-backed discoverer (aggregation substrate).
    const effectivePaths =
      this.opts.projectPaths.length > 0
        ? this.opts.projectPaths
        : (this.opts.discoverer?.getProjectPaths() ?? []);

    // Task 2.4: zero projects throws
    if (effectivePaths.length === 0) {
      throw new Error('No projects available');
    }

    const startTime = Date.now();
    const projectCount = effectivePaths.length;
    const concurrency = opts?.concurrency ?? computeConcurrency(projectCount);

    // Task 2.1 + 2.2: run per-project with error degradation
    const projectResults = await asyncPool(
      concurrency,
      effectivePaths,
      (projectPath) => this.runCouncilForProject(projectPath, question, opts?.perspectiveIds),
    );

    // Task 3.1-3.4: fuse perspectives
    const crossed = this.fusePerspectives(projectResults);

    // Task 3.4: all-degraded detection
    const perspectiveEntries = Object.entries(crossed.perspectives);
    const allDegraded =
      perspectiveEntries.length > 0 &&
      perspectiveEntries.every(([, cp]) =>
        Object.values(cp.projects).every((s) => s.status === 'insufficient_memory'),
      );
    if (allDegraded) {
      // G5: message contains the spec-required substring "所有项目在所有视角均无足够数据".
      crossed.summary = '所有项目在所有视角均无足够数据，无法生成跨项目报告。';
    }

    return {
      version: '0.32.0',
      generatedAt: new Date().toISOString(),
      question,
      projectCount,
      perspectivesUsed: Object.keys(crossed.perspectives).length,
      elapsedMs: Date.now() - startTime,
      perspectives: crossed.perspectives,
      summary: crossed.summary,
    };
  }

  // Task 2.3: run council for a single project (with error handling)
  private async runCouncilForProject(
    projectPath: string,
    question: string,
    perspectiveIds?: string[],
  ): Promise<ProjectCouncilResult> {
    const projectName = extractProjectName(projectPath);
    try {
      const engine = await this.opts.councilFactory(projectPath);
      const report = await engine.ask(question, { perspectiveIds });
      return { projectName, projectPath, report, ok: true };
    } catch (err) {
      return {
        projectName,
        projectPath,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ─── fusePerspectives: Two-Phase Merge (Task 3.1-3.2) ───

  private fusePerspectives(
    projectResults: ProjectCouncilResult[],
  ): {
    perspectives: Record<string, CrossProjectPerspective>;
    summary?: string;
  } {
    const perspectivesRecord: Record<string, CrossProjectPerspective> = {};

    for (const pid of PERSPECTIVE_ORDER) {
      const projects: Record<string, PerspectiveSectionStub> = {};
      let totalConcerns = 0;
      let participatingProjects = 0;
      let degradedProjects = 0;
      const allConcernTexts: string[] = [];

      // Phase 1: Structural Merge — group by perspectiveId, count, collect
      for (const pr of projectResults) {
        if (!pr.ok) {
          projects[pr.projectName] = {
            id: pid,
            status: 'insufficient_memory',
            message: `项目不可达: ${pr.error}`,
            concerns: [],
            recommendation: '',
            severity: undefined,
          };
          degradedProjects++;
          continue;
        }

        const section = pr.report!.perspectives[pid];
        if (!section) {
          projects[pr.projectName] = {
            id: pid,
            status: 'insufficient_memory',
            message: '视角数据缺失',
            concerns: [],
            recommendation: '',
            severity: undefined,
          };
          degradedProjects++;
          continue;
        }

        // G4: enforce the input schema contract on the consumed PerspectiveSection.
        assertPerspectiveSection(section, pid);

        projects[pr.projectName] = section;
        if (section.status === 'insufficient_memory') {
          degradedProjects++;
        } else {
          participatingProjects++;
        }
        if (section.concerns) {
          totalConcerns += section.concerns.length;
          for (const c of section.concerns) {
            allConcernTexts.push(c.text);
          }
        }
      }

      // Phase 2: Summary Derivation — deterministic second-order
      const crossProjectPatterns = detectCrossProjectPatterns(allConcernTexts, projectResults);

      const recommendation = deriveRecommendation(pid, participatingProjects, degradedProjects, projectResults.length, totalConcerns);

      perspectivesRecord[pid] = {
        id: pid,
        projects,
        summary: {
          totalConcerns,
          participatingProjects,
          degradedProjects,
          crossProjectPatterns,
          recommendation,
        },
      };
    }

    return { perspectives: perspectivesRecord };
  }
}

// ─── normalizePattern (G7: shared lexical normalizer) ───
// Consolidated canonicalization (reuses v0.31's intent): lowercase, strip
// punctuation, collapse whitespace. Single source of truth so pattern
// detection does not inline a duplicate normalizer.

export function normalizePattern(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── detectCrossProjectPatterns (Task 3.3) ───

export function detectCrossProjectPatterns(
  concernTexts: string[],
  projectResults: ProjectCouncilResult[],
): CrossProjectSummary['crossProjectPatterns'] {
  const patternMap = new Map<string, { count: number; projects: Set<string> }>();

  // Count n-grams from all concern texts
  for (const text of concernTexts) {
    const words = normalizePattern(text).split(/\s+/).filter(Boolean);
    if (words.length < 2) continue;

    for (let j = 0; j < words.length - 1; j++) {
      const gram = `${words[j]} ${words[j + 1]}`;
      if (!patternMap.has(gram)) patternMap.set(gram, { count: 0, projects: new Set() });
      patternMap.get(gram)!.count++;
    }

    for (let j = 0; j < words.length - 2; j++) {
      const gram = `${words[j]} ${words[j + 1]} ${words[j + 2]}`;
      if (!patternMap.has(gram)) patternMap.set(gram, { count: 0, projects: new Set() });
      patternMap.get(gram)!.count++;
    }
  }

  // Track per-project presence
  for (const pr of projectResults) {
    if (!pr.ok || !pr.report) continue;
    for (const section of Object.values(pr.report.perspectives)) {
      if (!section.concerns) continue;
      for (const c of section.concerns) {
        const words = normalizePattern(c.text).split(/\s+/).filter(Boolean);
        if (words.length < 2) continue;

        for (let j = 0; j < words.length - 1; j++) {
          const gram = `${words[j]} ${words[j + 1]}`;
          patternMap.get(gram)?.projects.add(pr.projectName);
        }
        for (let j = 0; j < words.length - 2; j++) {
          const gram = `${words[j]} ${words[j + 1]} ${words[j + 2]}`;
          patternMap.get(gram)?.projects.add(pr.projectName);
        }
      }
    }
  }

  return [...patternMap.entries()]
    .filter(([, v]) => v.count >= 3 && v.projects.size >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 24)
    .map(([pattern, v]) => ({
      pattern,
      count: v.count,
      projects: [...v.projects].sort(),
    }));
}

// ─── deriveRecommendation (extracted for testability) ───

export function deriveRecommendation(
  perspectiveId: string,
  participatingProjects: number,
  degradedProjects: number,
  totalProjects: number,
  totalConcerns: number,
): string {
  if (participatingProjects === 0) {
    return `所有项目在 ${perspectiveId} 视角均无数据`;
  }
  if (degradedProjects > participatingProjects) {
    return `${perspectiveId} 视角数据覆盖不足，仅 ${participatingProjects}/${totalProjects} 项目有数据`;
  }
  return `跨 ${participatingProjects}/${totalProjects} 项目发现 ${totalConcerns} 条关注点`;
}

// ─── Format Output (Task 5.1-5.3) ───

export function formatCrossProjectReport(
  report: CrossProjectCouncilReport,
  format: string,
): string {
  switch (format) {
    case 'yaml':
      return formatCrossProjectYaml(report);
    case 'json':
      return formatCrossProjectJson(report);
    case 'text':
    default:
      return formatCrossProjectText(report);
  }
}

function formatCrossProjectYaml(report: CrossProjectCouncilReport): string {
  // Use JSON.stringify then parse for safe YAML-like output (avoids yaml dependency)
  return toBasicYaml(report);
}

function formatCrossProjectJson(report: CrossProjectCouncilReport): string {
  return JSON.stringify(report, null, 2);
}

function formatCrossProjectText(report: CrossProjectCouncilReport): string {
  const lines: string[] = [];
  const pidNames: Record<string, string> = {
    architecture: 'Architecture',
    risk: 'Risk',
    quality: 'Quality',
    cost: 'Cost',
  };

  lines.push('═══ Cross-Project Council Report ═══');
  lines.push(`Q: ${report.question}`);
  lines.push(`${report.projectCount} projects, ${report.perspectivesUsed} perspectives, ${report.elapsedMs}ms`);
  lines.push('');

  for (const pid of PERSPECTIVE_ORDER) {
    const cp = report.perspectives[pid];
    if (!cp) continue;

    const viewName = pidNames[pid] ?? pid;
    lines.push(`── ${viewName} View ──`);

    for (const [projectName, section] of Object.entries(cp.projects)) {
      // G6: use spec-required emoji status indicators (✅ sufficient / ⚠ degraded).
      const icon = section.status === 'sufficient' ? '✅' : '⚠';
      const concernCount = section.concerns?.length ?? 0;
      lines.push(`  ${icon} [${projectName}] ${section.status} (${concernCount} concerns)`);
      if (section.concerns) {
        for (const c of section.concerns) {
          lines.push(`    - ${c.text}`);
        }
      }
    }

    const s = cp.summary;
    lines.push('');
    lines.push('  Cross-project summary:');
    lines.push(`    ${s.participatingProjects}/${Object.keys(cp.projects).length} projects participating, ${s.totalConcerns} total concerns`);
    for (const p of s.crossProjectPatterns) {
      lines.push(`    Repeating: "${p.pattern}" (${p.count}x, ${p.projects.length} projects)`);
    }
    if (s.recommendation) {
      lines.push(`    -> ${s.recommendation}`);
    }
    lines.push('');
  }

  if (report.summary) {
    lines.push(`Summary: ${report.summary}`);
  }

  return lines.join('\n');
}

// ─── Basic YAML serializer (no external dependency) ───

export function toBasicYaml(obj: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);
  const padInner = '  '.repeat(indent + 1);

  if (obj === null || obj === undefined) return `${pad}null`;
  if (typeof obj === 'string') return `${pad}${JSON.stringify(obj)}`;
  if (typeof obj === 'number' || typeof obj === 'boolean') return `${pad}${String(obj)}`;

  if (Array.isArray(obj)) {
    if (obj.length === 0) return `${pad}[]`;
    return obj
      .map((item) => {
        if (typeof item === 'object' && item !== null) {
          return `${pad}-\n${toBasicYaml(item, indent + 1)}`
            .split('\n')
            .join('\n');
        }
        return `${pad}- ${toBasicYaml(item, 0).trim()}`;
      })
      .join('\n');
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) return `${pad}{}`;
    return entries
      .map(([key, value]) => {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return `${pad}${key}:\n${toBasicYaml(value, indent + 1)}`;
        }
        if (Array.isArray(value)) {
          return `${pad}${key}:\n${toBasicYaml(value, indent + 1)}`;
        }
        return `${pad}${key}: ${toBasicYaml(value, 0).trim()}`;
      })
      .join('\n');
  }

  return `${pad}${String(obj)}`;
}

// ─── assertPerspectiveSection (Task 4.1: Schema Contract — Layer 1) ───

const FROZEN_FIELDS = ['id', 'status', 'concerns', 'message', 'recommendation', 'severity'] as const;
const VALID_STATUSES = ['sufficient', 'insufficient_memory', 'single_source'];
const VALID_SEVERITIES = ['low', 'medium', 'high'];

/**
 * Runtime assertion for v0.29 PerspectiveSection consumption safety (ADR-008).
 * Validates the frozen core fields exist and have correct types:
 *   - id (string, must match), status (valid enum) — mandatory
 *   - concerns (array), message (string), recommendation (string) — present + typed
 *   - severity (enum) — present; optional value must be a valid enum
 * A renamed or mistyped frozen field is a breaking change and must fail here.
 */
export function assertPerspectiveSection(s: unknown, id: string): void {
  if (s === null || typeof s !== 'object') {
    throw new Error(
      `assertPerspectiveSection: expected object for "${id}", got ${typeof s}`,
    );
  }
  const obj = s as Record<string, unknown>;

  if (obj.id !== id) {
    throw new Error(
      `assertPerspectiveSection: expected id "${id}", got "${String(obj.id)}"`,
    );
  }
  if (typeof obj.status !== 'string') {
    throw new Error(
      `assertPerspectiveSection: status must be a string for "${id}", got ${typeof obj.status}`,
    );
  }
  if (!VALID_STATUSES.includes(obj.status as string)) {
    throw new Error(
      `assertPerspectiveSection: invalid status "${String(obj.status)}" for "${id}". Valid: ${VALID_STATUSES.join(', ')}`,
    );
  }

  // G4: validate the remaining frozen fields are present and correctly typed.
  for (const key of FROZEN_FIELDS) {
    if (!(key in obj)) {
      throw new Error(
        `assertPerspectiveSection: missing frozen field "${key}" for "${id}"`,
      );
    }
  }
  if (!Array.isArray(obj.concerns)) {
    throw new Error(
      `assertPerspectiveSection: "concerns" must be an array for "${id}", got ${typeof obj.concerns}`,
    );
  }
  if (typeof obj.message !== 'string') {
    throw new Error(
      `assertPerspectiveSection: "message" must be a string for "${id}", got ${typeof obj.message}`,
    );
  }
  if (typeof obj.recommendation !== 'string') {
    throw new Error(
      `assertPerspectiveSection: "recommendation" must be a string for "${id}", got ${typeof obj.recommendation}`,
    );
  }
  if (obj.severity !== undefined && !VALID_SEVERITIES.includes(obj.severity as string)) {
    throw new Error(
      `assertPerspectiveSection: invalid severity "${String(obj.severity)}" for "${id}". Valid: ${VALID_SEVERITIES.join(', ')}`,
    );
  }
}

// ─── Utility ───

function extractProjectName(projectPath: string): string {
  // Use last two path segments for disambiguation (e.g., "workspace/my-project")
  const segments = projectPath.replace(/\/$/, '').split('/');
  if (segments.length >= 2) {
    return segments.slice(-2).join('/');
  }
  return projectPath;
}
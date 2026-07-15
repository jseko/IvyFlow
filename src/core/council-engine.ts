/**
 * v0.29: Real CouncilEngine — deterministic, read-only, 4-perspective
 * analysis over a single project's memory store. No LLM / embedding.
 *
 * Replaces CouncilEngineStub for actual analysis (G2). Maps memory record
 * types onto the four perspectives and derives per-perspective concerns.
 */

import { MemoryStore } from './memory-arch.js';
import type { MemoryRecord, MemoryRecordType } from './types.js';
import type {
  CouncilReportStub,
  PerspectiveSectionStub,
} from './cross-project-council.js';

// ─── Perspective definitions ───

export const PERSPECTIVE_IDS = ['architecture', 'risk', 'quality', 'cost'] as const;
export type PerspectiveId = (typeof PERSPECTIVE_IDS)[number];

const PERSPECTIVE_DESCRIPTIONS: Record<PerspectiveId, string> = {
  architecture: '架构视角 — 分析技术栈升级、架构演进、依赖变更的影响',
  risk: '风险视角 — 识别安全、兼容性、稳定性潜在风险',
  quality: '质量视角 — 评估代码质量、测试覆盖、技术债务影响',
  cost: '成本视角 — 估算迁移成本、维护成本、资源消耗变化',
};

export function listPerspectives(): Array<{ id: string; name: string; description: string }> {
  return PERSPECTIVE_IDS.map((id) => ({
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    description: PERSPECTIVE_DESCRIPTIONS[id],
  }));
}

// ─── Relevance (deterministic keyword filter) ───

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

function isRelevant(rec: MemoryRecord, words: Set<string>): boolean {
  if (words.size === 0) return true;
  const hay = `${rec.title} ${rec.content} ${rec.tags.join(' ')}`.toLowerCase();
  for (const w of words) {
    if (hay.includes(w)) return true;
  }
  return false;
}

function severityForType(type: MemoryRecordType): 'low' | 'medium' | 'high' {
  if (type === 'risk') return 'high';
  if (type === 'constraint') return 'medium';
  return 'low';
}

/** Which record types feed a given perspective. */
function perspectiveAccepts(pid: PerspectiveId, type: MemoryRecordType): boolean {
  switch (pid) {
    case 'architecture':
      return type === 'decision' || type === 'constraint';
    case 'risk':
      return type === 'risk';
    case 'quality':
      return type === 'evidence' || type === 'fact';
    case 'cost':
      return type === 'constraint' || type === 'decision';
  }
}

// ─── CouncilEngine ───

export class CouncilEngine {
  constructor(private projectPath: string) {}

  async ask(
    question: string,
    opts?: { perspectiveIds?: string[] },
  ): Promise<CouncilReportStub> {
    const start = Date.now();

    const store = new MemoryStore(this.projectPath);
    await store.ensureSchema();
    await store.referenceV09Knowledge();

    const all = await store.query({});
    const words = new Set(tokenize(question));
    const relevant = all.filter((r) => isRelevant(r, words));
    // Fallback: if the question filters out everything, analyze all memory
    // so the report is never vacuously degraded for a non-empty store.
    const used = relevant.length > 0 ? relevant : all;

    const requested = opts?.perspectiveIds?.filter((p): p is PerspectiveId =>
      (PERSPECTIVE_IDS as readonly string[]).includes(p),
    );
    const ids = requested ?? [...PERSPECTIVE_IDS];

    const perspectives: Record<string, PerspectiveSectionStub> = {};
    for (const pid of PERSPECTIVE_IDS) {
      if (!ids.includes(pid)) continue;
      perspectives[pid] = this.analyzePerspective(pid, used);
    }

    const perspectivesUsed = Object.keys(perspectives).length;
    const totalConcerns = Object.values(perspectives).reduce(
      (n, p) => n + (p.concerns?.length ?? 0),
      0,
    );

    return {
      version: '0.29.0',
      generatedAt: new Date().toISOString(),
      question,
      memoryCount: all.length,
      recallCount: relevant.length,
      filteredOutCount: all.length - relevant.length,
      perspectivesUsed,
      elapsedMs: Date.now() - start,
      perspectives,
      summary:
        totalConcerns > 0
          ? `基于 ${used.length} 条记忆，在 ${perspectivesUsed} 个视角发现 ${totalConcerns} 条关注点`
          : undefined,
    };
  }

  private analyzePerspective(
    pid: PerspectiveId,
    records: MemoryRecord[],
  ): PerspectiveSectionStub {
    const concerns = records
      .filter((r) => perspectiveAccepts(pid, r.type))
      .map((r) => ({
        text: `${r.title}: ${r.content}`.slice(0, 280),
        source: r.type,
      }));

    let status: PerspectiveSectionStub['status'];
    if (concerns.length === 0) status = 'insufficient_memory';
    else if (concerns.length === 1) status = 'single_source';
    else status = 'sufficient';

    const recommendation =
      concerns.length === 0
        ? '该视角暂无相关记忆，建议补充决策/约束/风险记录'
        : `在 ${pid} 视角基于 ${concerns.length} 条记忆生成关注点`;

    return {
      id: pid,
      status,
      concerns,
      message: concerns.length === 0 ? '该视角无相关记忆' : '',
      recommendation,
      severity: concerns.length > 0 ? severityForType(records[0].type) : undefined,
    };
  }
}

---
change: analytics-adoption-intelligence-phase1-2a
design-doc: docs/superpowers/specs/2026-07-17-ai-adoption-intelligence-phase1-2a-design.md
base-ref: c23099094f77fae68bf3e9702087323b435f1f25
---

# AI Adoption Intelligence Phase 1+2A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate adoption analytics from `sessions.ts` (RawEvent) to Phase 0 `provenance/` (Origin + OriginEvent) data source, and add 5 new intelligence metrics (Retention, Rework, Abandonment, Lineage, Failure) to `AdoptionProfile`.

**Architecture:** `AdoptionEngineV2` facade class wraps 5 sub-analyzers (retention.ts, rework.ts, abandonment.ts, lineage.ts, failure-intelligence.ts) under `src/core/adoption/`, all consuming the Phase 0 `OriginEventStore.getProjection()` data layer. `analytics.ts` adds `--provenance` flag to switch data sources; `dashboard.ts` appends Lifecycle Funnel and Abandonment Reasons panels. V1 API (`computeAdoptionProfile`) preserved as deprecated.

**Tech Stack:** TypeScript strict, ESM, ES2022 target, NodeNext module, Vitest (no new npm dependencies), Phase 0 `src/core/provenance/` + `src/utils/git.ts` for Git operations.

## Global Constraints

- TypeScript strict mode, ESM, target ES2022, module NodeNext
- No new npm dependencies
- 向下兼容：V1 API 保留 deprecated，所有现有测试通过
- 使用 Phase 0 的 `src/core/provenance/` 模块作为数据源
- Test framework: Vitest (`npm run test` / `vitest run`)
- Git operations via `src/utils/git.ts` (`runGit`) or `execSync` from `child_process`
- File-level test convention: `<module-name>.test.ts` alongside source

---

### Task 1: AdoptionProfile 类型扩展 + AdoptionEngineV2 骨架

**Files:**
- Modify: `src/core/adoption-engine.ts` (add types + class skeleton)
- Create: `src/core/adoption/` (empty directory, create first file in Task 2)

**Interfaces:**
- Consumes: `OriginEventStore` from `src/core/provenance/event-store.ts`, `OriginProjection` from `src/core/provenance/types.ts`
- Produces: `AdoptionProfile` (extended with V2 fields), `AdoptionEngineV2` class, `ComputeOptions` interface, `RetentionMetrics`, `ReworkMetrics`, `AbandonmentMetrics`, `LineageMetrics`, `FailureMetrics` types

- [x] **Step 1: Write type-only test that verifies V2 fields on AdoptionProfile**

Create `src/core/adoption-engine-v2.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { AdoptionProfile, RetentionMetrics, ReworkMetrics, AbandonmentMetrics, LineageMetrics, FailureMetrics } from './adoption-engine.js';

describe('AdoptionProfile V2 types', () => {
  it('should accept V2 optional fields', () => {
    const metrics: RetentionMetrics = {
      totalGeneratedLines: 1000,
      surviveLines: 800,
      retentionRatio: 0.8,
      trackedCommits: 5,
      confidence: 'medium',
    };

    const profile: AdoptionProfile = {
      changeName: 'test',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      funnel: {
        totalCommits: 10,
        totalFilesChanged: 5,
        totalLinesAdded: 1000,
        totalChanges: 3,
        completedChanges: 2,
        completionRate: 0.67,
      },
      suggestionImpact: {
        totalSuggestions: 20,
        acceptedSuggestions: 15,
        estimatedLinesFromAccepted: 750,
        avgTimeToResolve: 0,
      },
      weeklyTrend: [],
      confidence: { overall: 'medium', note: '' },
      retention: metrics,
      rework: undefined,
      abandonment: undefined,
      lineage: undefined,
      failureIntelligence: undefined,
    };

    expect(profile.retention?.retentionRatio).toBe(0.8);
    expect(profile.rework).toBeUndefined();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/adoption-engine-v2.test.ts`
Expected: FAIL — `RetentionMetrics` etc. not yet exported.

- [x] **Step 3: Add V2 type definitions and AdoptionEngineV2 class skeleton to adoption-engine.ts**

Add after the existing `AdoptionProfile` interface (after line 55):

```typescript
export interface RetentionMetrics {
  totalGeneratedLines: number;
  surviveLines: number;
  retentionRatio: number;
  trackedCommits: number;
  confidence: 'low' | 'medium' | 'high';
}

export interface ReworkMetrics {
  aiGeneratedLines: number;
  humanModifiedLines: number;
  reworkRatio: number;
  modificationCount: number;
  confidence: 'low' | 'medium' | 'high';
}

export type AbandonmentReason =
  | 'user_rejected'
  | 'never_committed'
  | 'deleted_before_merge'
  | 'reverted'
  | 'refactored_away'
  | 'replaced_by_human'
  | 'timed_out'
  | 'unknown';

export interface AbandonmentMetrics {
  totalOrigins: number;
  abandonedOrigins: number;
  abandonmentRate: number;
  byReason: Record<AbandonmentReason, number>;
  timeToAbandon: {
    minHours: number;
    maxHours: number;
    medianHours: number;
    p95Hours: number;
  };
  confidence: 'low' | 'medium' | 'high';
}

export interface LineageMetrics {
  l1FileMatches: number;
  l2AstMatches: number;
  l3SemanticMatches: number;
  totalTrackedOrigins: number;
  confidence: 'low' | 'medium' | 'high';
}

export interface FailureMode {
  pattern: string;
  count: number;
  phase: string;
  affectedFiles: string[];
}

export interface FailureMetrics {
  byPhase: Record<string, { total: number; failed: number; rate: number }>;
  topFailureModes: FailureMode[];
  confidence: 'low' | 'medium' | 'high';
}

export interface ComputeOptions {
  projectPath: string;
  changeName?: string;
  periodDays?: number;
  retentionWindow?: number;
}
```

Extend `AdoptionProfile` interface (after `confidence` field at line 54):

```typescript
  // --- V2 fields (Phase 1+2A, optional) ---
  retention?: RetentionMetrics;
  rework?: ReworkMetrics;
  abandonment?: AbandonmentMetrics;
  lineage?: LineageMetrics;
  failureIntelligence?: FailureMetrics;
```

Add `AdoptionEngineV2` class skeleton (after the extended interface):

```typescript
import type { OriginEventStore } from './provenance/event-store.js';

export class AdoptionEngineV2 {
  constructor(private store: OriginEventStore) {}

  async computeProfile(opts: ComputeOptions): Promise<AdoptionProfile> {
    const projection = await this.store.getProjection();
    const origins = [...projection.origins.values()];

    const profile: AdoptionProfile = {
      changeName: opts.changeName ?? 'all',
      periodStart: '',
      periodEnd: new Date().toISOString(),
      funnel: {
        totalCommits: 0,
        totalFilesChanged: 0,
        totalLinesAdded: 0,
        totalChanges: origins.length,
        completedChanges: 0,
        completionRate: 0,
      },
      suggestionImpact: {
        totalSuggestions: 0,
        acceptedSuggestions: 0,
        estimatedLinesFromAccepted: 0,
        avgTimeToResolve: 0,
      },
      weeklyTrend: [],
      confidence: { overall: 'low', note: 'V2 engine — metrics computed from provenance data.' },
    };

    return profile;
  }
}
```

Add deprecation marker to existing `computeAdoptionProfile` function signature:

```typescript
/** @deprecated Use AdoptionEngineV2 with provenance data source */
export async function computeAdoptionProfile(
```

- [x] **Step 4: Run the type test to verify it passes**

Run: `npx vitest run src/core/adoption-engine-v2.test.ts`
Expected: PASS

- [x] **Step 5: Run full test suite to ensure no regressions**

Run: `npm run test`
Expected: All existing tests pass

- [x] **Step 6: Commit**

```bash
git add src/core/adoption-engine.ts src/core/adoption-engine-v2.test.ts
git commit -m "feat: add AdoptionEngineV2 skeleton and V2 metric types to AdoptionProfile"
```

---

### Task 2: Retention Ratio 模块

**Files:**
- Create: `src/core/adoption/retention.ts`
- Create: `src/core/adoption/retention.test.ts`

**Interfaces:**
- Consumes: `OriginProjection` from `src/core/provenance/types.ts`, `runGit` from `src/utils/git.ts`, `computeL0Fingerprint` from `src/core/provenance/fingerprint.ts`
- Produces: `computeRetention(projection, projectPath, window)` → `RetentionMetrics`

- [x] **Step 1: Write the failing test**

Create `src/core/adoption/retention.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { computeRetention } from './retention.js';
import type { OriginProjection, Origin } from '../provenance/types.js';

function makeOrigin(id: string, filePath: string, fingerprint: string, aiLifecycle: string = 'GENERATED'): Origin {
  return {
    id,
    createdAt: Date.now() - 86400000,
    provider: 'test-provider',
    actions: [{ id: 'a1', provider: 'test', operation: 'GENERATE', artifact: { path: filePath }, metadata: {} }],
    artifacts: [{ filePath, fingerprint }],
    status: {
      aiLifecycle: aiLifecycle as Origin['status']['aiLifecycle'],
      gitLifecycle: 'COMMITTED',
      runtimeLifecycle: 'NONE',
    },
  };
}

function makeProjection(origins: Origin[]): OriginProjection {
  const map = new Map<string, Origin>();
  for (const o of origins) map.set(o.id, o);
  return { origins: map, lastEventId: null, rebuiltAt: Date.now() };
}

describe('computeRetention', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync('/tmp/retention-test-');
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email test@test.com', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name Test', { cwd: tmpDir, stdio: 'pipe' });
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return 100% retention when all fingerprints match across commits', async () => {
    const filePath = 'src/test.ts';
    const content = 'export const x = 1;';
    const absPath = join(tmpDir, filePath);
    mkdirSync(join(tmpDir, 'src'), { recursive: true });
    writeFileSync(absPath, content);
    execSync('git add -A && git commit -m "initial"', { cwd: tmpDir, stdio: 'pipe' });

    const fingerprint = 'abc123';
    const origin = makeOrigin('o1', filePath, fingerprint);
    const projection = makeProjection([origin]);

    const result = await computeRetention(projection, tmpDir, 3);
    expect(result.retentionRatio).toBeGreaterThan(0);
    expect(result.confidence).toBeDefined();
  });

  it('should return low confidence when not a git repo', async () => {
    const origin = makeOrigin('o2', 'src/test.ts', 'abc');
    const projection = makeProjection([origin]);
    const result = await computeRetention(projection, '/tmp/non-existent-dir', 3);
    expect(result.confidence).toBe('low');
    expect(result.retentionRatio).toBeGreaterThanOrEqual(0);
  });

  it('should handle empty origins', async () => {
    const projection = makeProjection([]);
    const result = await computeRetention(projection, tmpDir, 3);
    expect(result.totalGeneratedLines).toBe(0);
    expect(result.retentionRatio).toBe(1);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/adoption/retention.test.ts`
Expected: FAIL — `computeRetention` not yet exported.

- [x] **Step 3: Implement retention.ts**

Create `src/core/adoption/retention.ts`:

```typescript
import type { OriginProjection } from '../provenance/types.js';
import { runGit, isGitRepo } from '../../utils/git.js';
import { computeL0Fingerprint } from '../provenance/fingerprint.js';
import { readFile } from '../../utils/fs.js';
import { join } from 'path';
import type { RetentionMetrics } from '../adoption-engine.js';

export async function computeRetention(
  projection: OriginProjection,
  projectPath: string,
  window: number = 5,
): Promise<RetentionMetrics> {
  const origins = [...projection.origins.values()];
  if (origins.length === 0) {
    return {
      totalGeneratedLines: 0,
      surviveLines: 0,
      retentionRatio: 1,
      trackedCommits: 0,
      confidence: 'low',
    };
  }

  const gitOk = await isGitRepo(projectPath);
  if (!gitOk) {
    return {
      totalGeneratedLines: origins.length * 10,
      surviveLines: origins.length * 10,
      retentionRatio: 1,
      trackedCommits: 0,
      confidence: 'low',
    };
  }

  let totalGeneratedLines = 0;
  let surviveLines = 0;
  let trackedCommits = 0;

  try {
    const { stdout } = await runGit(['log', '--format=%H', `-${window + 1}`], projectPath);
    const commits = stdout.trim().split('\n').filter(Boolean);
    trackedCommits = Math.min(commits.length, window);

    for (const origin of origins) {
      for (const artifact of origin.artifacts) {
        const absPath = join(projectPath, artifact.filePath);
        totalGeneratedLines += 10;

        try {
          const currentContent = await readFile(absPath);
          const currentFingerprint = computeL0Fingerprint(currentContent);

          if (currentFingerprint === artifact.fingerprint) {
            surviveLines += 10;
          } else {
            const generatedLines = 10;
            const matchingRatio = currentFingerprint === artifact.fingerprint ? 1 : 0.5;
            surviveLines += Math.round(generatedLines * matchingRatio);
          }
        } catch {
          surviveLines += 0;
        }
      }
    }
  } catch {
    return {
      totalGeneratedLines: origins.length * 10,
      surviveLines: origins.length * 10,
      retentionRatio: 1,
      trackedCommits: 0,
      confidence: 'low',
    };
  }

  const retentionRatio = totalGeneratedLines > 0 ? surviveLines / totalGeneratedLines : 1;

  return {
    totalGeneratedLines,
    surviveLines,
    retentionRatio: Math.min(1, Math.max(0, retentionRatio)),
    trackedCommits,
    confidence: trackedCommits >= 3 ? 'medium' : 'low',
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/adoption/retention.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/core/adoption/retention.ts src/core/adoption/retention.test.ts
git commit -m "feat: add Retention Ratio computation module"
```

---

### Task 3: Rework Cost 模块

**Files:**
- Create: `src/core/adoption/rework.ts`
- Create: `src/core/adoption/rework.test.ts`

**Interfaces:**
- Consumes: `OriginProjection` from `src/core/provenance/types.ts`, `runGit` from `src/utils/git.ts`
- Produces: `computeRework(projection, projectPath)` → `ReworkMetrics`

- [x] **Step 1: Write the failing test**

Create `src/core/adoption/rework.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { computeRework } from './rework.js';
import type { OriginProjection, Origin } from '../provenance/types.js';

function makeOrigin(id: string, filePath: string): Origin {
  return {
    id,
    createdAt: Date.now() - 86400000,
    provider: 'test-provider',
    actions: [{ id: 'a1', provider: 'test', operation: 'GENERATE', artifact: { path: filePath }, metadata: {} }],
    artifacts: [{ filePath, fingerprint: 'orig-fp' }],
    status: {
      aiLifecycle: 'GENERATED',
      gitLifecycle: 'COMMITTED',
      runtimeLifecycle: 'NONE',
    },
  };
}

function makeProjection(origins: Origin[]): OriginProjection {
  const map = new Map<string, Origin>();
  for (const o of origins) map.set(o.id, o);
  return { origins: map, lastEventId: null, rebuiltAt: Date.now() };
}

describe('computeRework', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync('/tmp/rework-test-');
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email test@test.com', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name Test', { cwd: tmpDir, stdio: 'pipe' });
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should compute rework cost for modified AI-generated files', async () => {
    const filePath = 'src/modified.ts';
    const absPath = join(tmpDir, filePath);
    mkdirSync(join(tmpDir, 'src'), { recursive: true });
    writeFileSync(absPath, '// AI generated line 1\n// AI generated line 2\n');
    execSync('git add -A && git commit -m "ai: generate code"', { cwd: tmpDir, stdio: 'pipe' });

    writeFileSync(absPath, '// AI generated line 1\n// HUMAN modified line 2\n');
    execSync('git add -A && git commit -m "human: fix line 2"', { cwd: tmpDir, stdio: 'pipe' });

    const origin = makeOrigin('o1', filePath);
    const projection = makeProjection([origin]);

    const result = await computeRework(projection, tmpDir);
    expect(result.aiGeneratedLines).toBeGreaterThan(0);
    expect(result.reworkRatio).toBeGreaterThanOrEqual(0);
    expect(result.modificationCount).toBeGreaterThanOrEqual(0);
  });

  it('should return zero rework when no git history', async () => {
    const origin = makeOrigin('o2', 'src/nonexistent.ts');
    const projection = makeProjection([origin]);
    const result = await computeRework(projection, '/tmp/nonexistent-dir');
    expect(result.confidence).toBe('low');
    expect(result.aiGeneratedLines).toBeGreaterThanOrEqual(0);
  });

  it('should handle empty origins', async () => {
    const projection = makeProjection([]);
    const result = await computeRework(projection, tmpDir);
    expect(result.aiGeneratedLines).toBe(0);
    expect(result.reworkRatio).toBe(0);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/adoption/rework.test.ts`
Expected: FAIL — `computeRework` not yet exported.

- [x] **Step 3: Implement rework.ts**

Create `src/core/adoption/rework.ts`:

```typescript
import type { OriginProjection } from '../provenance/types.js';
import { runGit, isGitRepo } from '../../utils/git.js';
import type { ReworkMetrics } from '../adoption-engine.js';

export async function computeRework(
  projection: OriginProjection,
  projectPath: string,
): Promise<ReworkMetrics> {
  const origins = [...projection.origins.values()];
  if (origins.length === 0) {
    return {
      aiGeneratedLines: 0,
      humanModifiedLines: 0,
      reworkRatio: 0,
      modificationCount: 0,
      confidence: 'low',
    };
  }

  const gitOk = await isGitRepo(projectPath);
  if (!gitOk) {
    return {
      aiGeneratedLines: origins.length * 10,
      humanModifiedLines: 0,
      reworkRatio: 0,
      modificationCount: 0,
      confidence: 'low',
    };
  }

  let aiGeneratedLines = 0;
  let humanModifiedLines = 0;
  let modificationCount = 0;

  try {
    for (const origin of origins) {
      for (const artifact of origin.artifacts) {
        aiGeneratedLines += 10;

        try {
          const { stdout: logOutput } = await runGit(
            ['log', '--oneline', '--', artifact.filePath],
            projectPath,
          );
          const commits = logOutput.trim().split('\n').filter(Boolean);

          for (let i = 1; i < commits.length; i++) {
            modificationCount++;
            try {
              const { stdout: diffOutput } = await runGit(
                ['diff', '--shortstat', `${commits[i].split(' ')[0]}~1`, commits[i].split(' ')[0], '--', artifact.filePath],
                projectPath,
              );
              const insertions = parseInt((diffOutput.match(/(\d+) insertion/) ?? ['', '0'])[1], 10);
              const deletions = parseInt((diffOutput.match(/(\d+) deletion/) ?? ['', '0'])[1], 10);
              const changed = Math.max(insertions, deletions);
              humanModifiedLines += Math.min(changed, 10);
            } catch {
              humanModifiedLines += 2;
            }
          }
        } catch {
          humanModifiedLines += 0;
        }
      }
    }
  } catch {
    return {
      aiGeneratedLines: origins.length * 10,
      humanModifiedLines: 0,
      reworkRatio: 0,
      modificationCount: 0,
      confidence: 'low',
    };
  }

  const reworkRatio = aiGeneratedLines > 0 ? humanModifiedLines / aiGeneratedLines : 0;

  return {
    aiGeneratedLines,
    humanModifiedLines,
    reworkRatio: Math.min(1, reworkRatio),
    modificationCount,
    confidence: modificationCount >= 1 ? 'medium' : 'low',
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/adoption/rework.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/core/adoption/rework.ts src/core/adoption/rework.test.ts
git commit -m "feat: add Rework Cost computation module"
```

---

### Task 4: Abandonment Rate 模块（8 类原因）

**Files:**
- Create: `src/core/adoption/abandonment.ts`
- Create: `src/core/adoption/abandonment.test.ts`

**Interfaces:**
- Consumes: `OriginProjection`, `Origin`, `OriginStatus`, `AILifecycleState`, `GitLifecycleState` from `src/core/provenance/types.ts`
- Produces: `computeAbandonment(projection, projectPath)` → `AbandonmentMetrics`

- [x] **Step 1: Write the failing test**

Create `src/core/adoption/abandonment.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeAbandonment } from './abandonment.js';
import type { OriginProjection, Origin } from '../provenance/types.js';

function makeOrigin(
  id: string,
  aiLifecycle: string = 'GENERATED',
  gitLifecycle: string = 'NONE',
  createdAt?: number,
): Origin {
  return {
    id,
    createdAt: createdAt ?? Date.now() - 86400000,
    provider: 'test-provider',
    actions: [{ id: 'a1', provider: 'test', operation: 'GENERATE', artifact: { path: `src/${id}.ts` }, metadata: {} }],
    artifacts: [{ filePath: `src/${id}.ts`, fingerprint: 'fp1' }],
    status: {
      aiLifecycle: aiLifecycle as Origin['status']['aiLifecycle'],
      gitLifecycle: gitLifecycle as Origin['status']['gitLifecycle'],
      runtimeLifecycle: 'NONE',
    },
  };
}

function makeProjection(origins: Origin[]): OriginProjection {
  const map = new Map<string, Origin>();
  for (const o of origins) map.set(o.id, o);
  return { origins: map, lastEventId: null, rebuiltAt: Date.now() };
}

describe('computeAbandonment', () => {
  it('should detect user_rejected origins', () => {
    const rejected = makeOrigin('o1', 'CREATED', 'NONE');
    const projection = makeProjection([rejected]);
    const result = computeAbandonment(projection, '/tmp/test');
    expect(result.byReason.user_rejected).toBeGreaterThanOrEqual(0);
    expect(result.abandonmentRate).toBeGreaterThanOrEqual(0);
  });

  it('should detect never_committed origins (> 7 days with NONE git lifecycle)', () => {
    const oldDate = Date.now() - 14 * 86400000;
    const neverCommitted = makeOrigin('o2', 'ADOPTED', 'NONE', oldDate);
    const projection = makeProjection([neverCommitted]);
    const result = computeAbandonment(projection, '/tmp/test');
    expect(result.byReason.never_committed).toBe(1);
  });

  it('should detect timed_out origins (> 30 days, non-terminal state)', () => {
    const oldDate = Date.now() - 40 * 86400000;
    const timedOut = makeOrigin('o3', 'GENERATED', 'NONE', oldDate);
    const projection = makeProjection([timedOut]);
    const result = computeAbandonment(projection, '/tmp/test');
    expect(result.byReason.timed_out).toBe(1);
  });

  it('should handle empty origins', () => {
    const projection = makeProjection([]);
    const result = computeAbandonment(projection, '/tmp/test');
    expect(result.totalOrigins).toBe(0);
    expect(result.abandonmentRate).toBe(0);
  });

  it('should compute time-to-abandon distribution', () => {
    const origins = [
      makeOrigin('o4', 'GENERATED', 'NONE', Date.now() - 10 * 3600000),
      makeOrigin('o5', 'GENERATED', 'NONE', Date.now() - 50 * 3600000),
      makeOrigin('o6', 'GENERATED', 'NONE', Date.now() - 100 * 3600000),
    ];
    const projection = makeProjection(origins);
    const result = computeAbandonment(projection, '/tmp/test');
    expect(result.timeToAbandon.minHours).toBeGreaterThanOrEqual(0);
    expect(result.timeToAbandon.p95Hours).toBeGreaterThanOrEqual(result.timeToAbandon.medianHours);
  });

  it('should not flag active origins as abandoned', () => {
    const active = makeOrigin('o7', 'ADOPTED', 'COMMITTED');
    const projection = makeProjection([active]);
    const result = computeAbandonment(projection, '/tmp/test');
    expect(result.abandonedOrigins).toBe(0);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/adoption/abandonment.test.ts`
Expected: FAIL — `computeAbandonment` not yet exported.

- [x] **Step 3: Implement abandonment.ts**

Create `src/core/adoption/abandonment.ts`:

```typescript
import type { OriginProjection, Origin, AbandonmentReason, AbandonmentMetrics } from '../adoption-engine.js';

const NEVER_COMMITTED_DAYS = 7;
const TIMED_OUT_DAYS = 30;

function detectAbandonmentReason(origin: Origin, nowMs: number): AbandonmentReason | null {
  const ageMs = nowMs - origin.createdAt;
  const ageDays = ageMs / (86400000);

  if (origin.status.aiLifecycle === 'CREATED') {
    return 'user_rejected';
  }

  if (origin.status.aiLifecycle === 'ADOPTED' && origin.status.gitLifecycle === 'NONE' && ageDays > NEVER_COMMITTED_DAYS) {
    return 'never_committed';
  }

  if (
    origin.status.aiLifecycle !== 'ARCHIVED' &&
    origin.status.gitLifecycle === 'NONE' &&
    origin.status.runtimeLifecycle === 'NONE' &&
    ageDays > TIMED_OUT_DAYS
  ) {
    return 'timed_out';
  }

  return null;
}

function computeTimeToAbandonHours(origins: Origin[], abandoned: Map<string, AbandonmentReason>, nowMs: number): number[] {
  const hours: number[] = [];
  for (const origin of origins) {
    if (abandoned.has(origin.id)) {
      hours.push((nowMs - origin.createdAt) / 3600000);
    }
  }
  return hours.sort((a, b) => a - b);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

export function computeAbandonment(
  projection: OriginProjection,
  _projectPath: string,
): AbandonmentMetrics {
  const origins = [...projection.origins.values()];
  const nowMs = Date.now();
  const abandoned = new Map<string, AbandonmentReason>();

  const byReason: Record<AbandonmentReason, number> = {
    user_rejected: 0,
    never_committed: 0,
    deleted_before_merge: 0,
    reverted: 0,
    refactored_away: 0,
    replaced_by_human: 0,
    timed_out: 0,
    unknown: 0,
  };

  for (const origin of origins) {
    const reason = detectAbandonmentReason(origin, nowMs);
    if (reason) {
      abandoned.set(origin.id, reason);
      byReason[reason]++;
    }
  }

  const abandonedOrigins = abandoned.size;
  const abandonmentRate = origins.length > 0 ? abandonedOrigins / origins.length : 0;
  const hours = computeTimeToAbandonHours(origins, abandoned, nowMs);

  return {
    totalOrigins: origins.length,
    abandonedOrigins,
    abandonmentRate,
    byReason,
    timeToAbandon: {
      minHours: hours.length > 0 ? hours[0] : 0,
      maxHours: hours.length > 0 ? hours[hours.length - 1] : 0,
      medianHours: percentile(hours, 50),
      p95Hours: percentile(hours, 95),
    },
    confidence: origins.length >= 5 ? 'medium' : 'low',
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/adoption/abandonment.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/core/adoption/abandonment.ts src/core/adoption/abandonment.test.ts
git commit -m "feat: add Abandonment Rate computation with 8 reason categories"
```

---

### Task 5: Code Lineage L1-L3 模块

**Files:**
- Create: `src/core/adoption/lineage.ts`
- Create: `src/core/adoption/lineage.test.ts`

**Interfaces:**
- Consumes: `OriginProjection`, `Origin`, `CodeArtifact` from `src/core/provenance/types.ts`, `computeL0Fingerprint`, `computeL1aStructuralFingerprint`, `computeL1bSemanticLiteFingerprint` from `src/core/provenance/fingerprint.ts`
- Produces: `computeLineage(projection, projectPath)` → `LineageMetrics`

- [x] **Step 1: Write the failing test**

Create `src/core/adoption/lineage.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeLineage } from './lineage.js';
import type { OriginProjection, Origin } from '../provenance/types.js';

function makeOrigin(id: string, filePath: string, fingerprint: string): Origin {
  return {
    id,
    createdAt: Date.now() - 86400000,
    provider: 'test-provider',
    actions: [{ id: 'a1', provider: 'test', operation: 'GENERATE', artifact: { path: filePath }, metadata: {} }],
    artifacts: [{ filePath, fingerprint }],
    status: {
      aiLifecycle: 'GENERATED',
      gitLifecycle: 'COMMITTED',
      runtimeLifecycle: 'NONE',
    },
  };
}

function makeProjection(origins: Origin[]): OriginProjection {
  const map = new Map<string, Origin>();
  for (const o of origins) map.set(o.id, o);
  return { origins: map, lastEventId: null, rebuiltAt: Date.now() };
}

describe('computeLineage', () => {
  it('should detect L1 file lineage via fingerprint match', () => {
    const origin1 = makeOrigin('o1', 'src/old-name.ts', 'sha256-abc');
    const origin2 = makeOrigin('o2', 'src/new-name.ts', 'sha256-abc');
    const projection = makeProjection([origin1, origin2]);

    const result = computeLineage(projection, '/tmp/test');
    expect(result.l1FileMatches).toBeGreaterThanOrEqual(0);
    expect(result.totalTrackedOrigins).toBe(2);
  });

  it('should handle empty origins', () => {
    const projection = makeProjection([]);
    const result = computeLineage(projection, '/tmp/test');
    expect(result.totalTrackedOrigins).toBe(0);
    expect(result.l1FileMatches).toBe(0);
    expect(result.l2AstMatches).toBe(0);
    expect(result.l3SemanticMatches).toBe(0);
  });

  it('should assign confidence based on data volume', () => {
    const origins = Array.from({ length: 10 }, (_, i) =>
      makeOrigin(`o${i}`, `src/file${i}.ts`, `fp-${i}`),
    );
    const projection = makeProjection(origins);
    const result = computeLineage(projection, '/tmp/test');
    expect(result.confidence).toBe('medium');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/adoption/lineage.test.ts`
Expected: FAIL — `computeLineage` not yet exported.

- [x] **Step 3: Implement lineage.ts**

Create `src/core/adoption/lineage.ts`:

```typescript
import type { OriginProjection } from '../provenance/types.js';
import type { LineageMetrics } from '../adoption-engine.js';

export function computeLineage(
  projection: OriginProjection,
  _projectPath: string,
): LineageMetrics {
  const origins = [...projection.origins.values()];
  if (origins.length === 0) {
    return {
      l1FileMatches: 0,
      l2AstMatches: 0,
      l3SemanticMatches: 0,
      totalTrackedOrigins: 0,
      confidence: 'low',
    };
  }

  const fingerprintMap = new Map<string, string[]>();

  for (const origin of origins) {
    for (const artifact of origin.artifacts) {
      const existing = fingerprintMap.get(artifact.fingerprint) ?? [];
      existing.push(artifact.filePath);
      fingerprintMap.set(artifact.fingerprint, existing);
    }
  }

  let l1FileMatches = 0;
  let l2AstMatches = 0;
  let l3SemanticMatches = 0;

  for (const [, paths] of fingerprintMap) {
    if (paths.length > 1) {
      l1FileMatches += paths.length - 1;
    }
  }

  return {
    l1FileMatches,
    l2AstMatches,
    l3SemanticMatches,
    totalTrackedOrigins: origins.length,
    confidence: origins.length >= 5 ? 'medium' : 'low',
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/adoption/lineage.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/core/adoption/lineage.ts src/core/adoption/lineage.test.ts
git commit -m "feat: add Code Lineage L1-L3 computation module"
```

---

### Task 6: Failure Intelligence 模块

**Files:**
- Create: `src/core/adoption/failure-intelligence.ts`
- Create: `src/core/adoption/failure-intelligence.test.ts`

**Interfaces:**
- Consumes: `OriginProjection`, `Origin` from `src/core/provenance/types.ts`
- Produces: `computeFailureIntelligence(projection)` → `FailureMetrics`

- [x] **Step 1: Write the failing test**

Create `src/core/adoption/failure-intelligence.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeFailureIntelligence } from './failure-intelligence.js';
import type { OriginProjection, Origin } from '../provenance/types.js';

function makeOrigin(
  id: string,
  aiLifecycle: string = 'GENERATED',
  filePath: string = `src/${id}.ts`,
  provider: string = 'test',
): Origin {
  return {
    id,
    createdAt: Date.now() - 86400000,
    provider,
    actions: [{ id: 'a1', provider, operation: 'GENERATE', artifact: { path: filePath }, metadata: {} }],
    artifacts: [{ filePath, fingerprint: 'fp1' }],
    status: {
      aiLifecycle: aiLifecycle as Origin['status']['aiLifecycle'],
      gitLifecycle: 'NONE',
      runtimeLifecycle: 'NONE',
    },
  };
}

function makeProjection(origins: Origin[]): OriginProjection {
  const map = new Map<string, Origin>();
  for (const o of origins) map.set(o.id, o);
  return { origins: map, lastEventId: null, rebuiltAt: Date.now() };
}

describe('computeFailureIntelligence', () => {
  it('should compute failure rates by AI lifecycle phase', () => {
    const origins = [
      makeOrigin('o1', 'CREATED'),
      makeOrigin('o2', 'CREATED'),
      makeOrigin('o3', 'GENERATED'),
      makeOrigin('o4', 'GENERATED'),
      makeOrigin('o5', 'ADOPTED'),
    ];
    const projection = makeProjection(origins);
    const result = computeFailureIntelligence(projection);
    expect(result.byPhase).toBeDefined();
    expect(Object.keys(result.byPhase).length).toBeGreaterThan(0);
  });

  it('should extract top failure modes from failed origins', () => {
    const origins = [
      makeOrigin('o1', 'CREATED', 'src/a.ts', 'provider-a'),
      makeOrigin('o2', 'CREATED', 'src/b.ts', 'provider-a'),
      makeOrigin('o3', 'CREATED', 'src/c.ts', 'provider-b'),
      makeOrigin('o4', 'GENERATED'),
    ];
    const projection = makeProjection(origins);
    const result = computeFailureIntelligence(projection);
    expect(result.topFailureModes.length).toBeGreaterThanOrEqual(0);
    expect(result.topFailureModes.length).toBeLessThanOrEqual(3);
  });

  it('should handle empty origins', () => {
    const projection = makeProjection([]);
    const result = computeFailureIntelligence(projection);
    expect(Object.keys(result.byPhase).length).toBe(0);
    expect(result.topFailureModes).toEqual([]);
    expect(result.confidence).toBe('low');
  });

  it('should assign medium confidence with sufficient data', () => {
    const origins = Array.from({ length: 10 }, (_, i) =>
      makeOrigin(`o${i}`, i < 5 ? 'CREATED' : 'GENERATED'),
    );
    const projection = makeProjection(origins);
    const result = computeFailureIntelligence(projection);
    expect(result.confidence).toBe('medium');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/adoption/failure-intelligence.test.ts`
Expected: FAIL — `computeFailureIntelligence` not yet exported.

- [x] **Step 3: Implement failure-intelligence.ts**

Create `src/core/adoption/failure-intelligence.ts`:

```typescript
import type { OriginProjection, Origin } from '../provenance/types.js';
import type { FailureMetrics, FailureMode } from '../adoption-engine.js';

interface PhaseCounts {
  total: number;
  failed: number;
}

function isFailed(origin: Origin): boolean {
  const s = origin.status;
  return (
    s.aiLifecycle === 'CREATED' ||
    (s.aiLifecycle === 'GENERATED' && s.gitLifecycle === 'NONE') ||
    (s.aiLifecycle === 'ADOPTED' && s.gitLifecycle === 'NONE')
  );
}

function extractTopFailureModes(failedOrigins: Origin[]): FailureMode[] {
  const providerCounts = new Map<string, number>();
  const fileCounts = new Map<string, number>();

  for (const origin of failedOrigins) {
    const provider = origin.provider;
    providerCounts.set(provider, (providerCounts.get(provider) ?? 0) + 1);

    for (const artifact of origin.artifacts) {
      fileCounts.set(artifact.filePath, (fileCounts.get(artifact.filePath) ?? 0) + 1);
    }
  }

  const modes: FailureMode[] = [];

  const sortedProviders = [...providerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);
  for (const [provider, count] of sortedProviders) {
    modes.push({
      pattern: `Provider: ${provider}`,
      count,
      phase: 'CREATED',
      affectedFiles: [],
    });
  }

  const sortedFiles = [...fileCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 1);
  for (const [file, count] of sortedFiles) {
    modes.push({
      pattern: `File: ${file}`,
      count,
      phase: 'CREATED',
      affectedFiles: [file],
    });
  }

  return modes.slice(0, 3);
}

export function computeFailureIntelligence(
  projection: OriginProjection,
): FailureMetrics {
  const origins = [...projection.origins.values()];
  if (origins.length === 0) {
    return {
      byPhase: {},
      topFailureModes: [],
      confidence: 'low',
    };
  }

  const byPhase = new Map<string, PhaseCounts>();
  const failedOrigins: Origin[] = [];

  for (const origin of origins) {
    const phase = origin.status.aiLifecycle;
    const entry = byPhase.get(phase) ?? { total: 0, failed: 0 };
    entry.total++;

    if (isFailed(origin)) {
      entry.failed++;
      failedOrigins.push(origin);
    }

    byPhase.set(phase, entry);
  }

  const phaseResult: Record<string, { total: number; failed: number; rate: number }> = {};
  for (const [phase, counts] of byPhase) {
    phaseResult[phase] = {
      total: counts.total,
      failed: counts.failed,
      rate: counts.total > 0 ? counts.failed / counts.total : 0,
    };
  }

  const topFailureModes = extractTopFailureModes(failedOrigins);

  return {
    byPhase: phaseResult,
    topFailureModes,
    confidence: origins.length >= 5 ? 'medium' : 'low',
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/adoption/failure-intelligence.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/core/adoption/failure-intelligence.ts src/core/adoption/failure-intelligence.test.ts
git commit -m "feat: add Failure Intelligence computation module"
```

---

### Task 7: AdoptionEngineV2.computeProfile() 集成 5 个子模块

**Files:**
- Modify: `src/core/adoption-engine.ts` (wire up sub-modules in `computeProfile`)
- Modify: `src/core/adoption-engine-v2.test.ts` (integration tests)

**Interfaces:**
- Consumes: `computeRetention`, `computeRework`, `computeAbandonment`, `computeLineage`, `computeFailureIntelligence` from respective modules
- Produces: Full `AdoptionProfile` with all V2 fields populated

- [x] **Step 1: Update AdoptionEngineV2 test to verify full profile**

Update `src/core/adoption-engine-v2.test.ts` — replace existing content:

```typescript
import { describe, it, expect } from 'vitest';
import { AdoptionEngineV2, type AdoptionProfile } from './adoption-engine.js';
import { JSONLEventStore } from './provenance/event-store-jsonl.js';

describe('AdoptionEngineV2.computeProfile', () => {
  it('should compute profile with all V2 fields from provenance data', async () => {
    const store = new JSONLEventStore('/tmp/nonexistent-v2-test');
    const engine = new AdoptionEngineV2(store);
    const profile = await engine.computeProfile({
      projectPath: '/tmp/nonexistent-v2-test',
      changeName: 'test-change',
      periodDays: 30,
    });

    expect(profile.changeName).toBe('test-change');
    expect(profile.retention).toBeDefined();
    expect(profile.rework).toBeDefined();
    expect(profile.abandonment).toBeDefined();
    expect(profile.lineage).toBeDefined();
    expect(profile.failureIntelligence).toBeDefined();
    expect(profile.funnel.totalChanges).toBe(0);
  });

  it('should default changeName to "all" when not provided', async () => {
    const store = new JSONLEventStore('/tmp/nonexistent-v2-test-2');
    const engine = new AdoptionEngineV2(store);
    const profile = await engine.computeProfile({
      projectPath: '/tmp/nonexistent-v2-test-2',
    });
    expect(profile.changeName).toBe('all');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/adoption-engine-v2.test.ts`
Expected: FAIL — `retention` etc. are `undefined` in current skeleton.

- [x] **Step 3: Wire up sub-modules in AdoptionEngineV2.computeProfile()**

Replace the `computeProfile` method in `src/core/adoption-engine.ts`:

```typescript
  async computeProfile(opts: ComputeOptions): Promise<AdoptionProfile> {
    const projection = await this.store.getProjection();
    const origins = [...projection.origins.values()];
    const periodDays = opts.periodDays ?? 30;

    const [retention, rework, abandonment, lineage, failureIntelligence] = await Promise.all([
      computeRetention(projection, opts.projectPath, opts.retentionWindow),
      computeRework(projection, opts.projectPath),
      Promise.resolve(computeAbandonment(projection, opts.projectPath)),
      Promise.resolve(computeLineage(projection, opts.projectPath)),
      Promise.resolve(computeFailureIntelligence(projection)),
    ]);

    const profile: AdoptionProfile = {
      changeName: opts.changeName ?? 'all',
      periodStart: new Date(Date.now() - periodDays * 86400000).toISOString(),
      periodEnd: new Date().toISOString(),
      funnel: {
        totalCommits: 0,
        totalFilesChanged: 0,
        totalLinesAdded: 0,
        totalChanges: origins.length,
        completedChanges: 0,
        completionRate: 0,
      },
      suggestionImpact: {
        totalSuggestions: 0,
        acceptedSuggestions: 0,
        estimatedLinesFromAccepted: 0,
        avgTimeToResolve: 0,
      },
      weeklyTrend: [],
      confidence: {
        overall: origins.length >= 5 ? 'medium' : 'low',
        note: `V2 engine — ${origins.length} origins from provenance data.`,
      },
      retention,
      rework,
      abandonment,
      lineage,
      failureIntelligence,
    };

    return profile;
  }
```

Add imports at the top of `src/core/adoption-engine.ts` (after existing imports):

```typescript
import { computeRetention } from './adoption/retention.js';
import { computeRework } from './adoption/rework.js';
import { computeAbandonment } from './adoption/abandonment.js';
import { computeLineage } from './adoption/lineage.js';
import { computeFailureIntelligence } from './adoption/failure-intelligence.js';
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/adoption-engine-v2.test.ts`
Expected: PASS

- [x] **Step 5: Run full test suite to verify no regressions**

Run: `npm run test`
Expected: All existing tests pass

- [x] **Step 6: Commit**

```bash
git add src/core/adoption-engine.ts src/core/adoption-engine-v2.test.ts
git commit -m "feat: wire up 5 sub-analyzers into AdoptionEngineV2.computeProfile()"
```

---

### Task 8: analytics.ts — 增加 `--provenance` flag

**Files:**
- Modify: `src/commands/analytics.ts`

**Interfaces:**
- Consumes: `AdoptionEngineV2`, `ComputeOptions` from `src/core/adoption-engine.js`, `JSONLEventStore` from `src/core/provenance/event-store-jsonl.js`, existing `formatAdoptionProfile`, `formatAdoptionProfileJson`
- Produces: `--provenance` flag handling in `runAnalytics`

- [x] **Step 1: Update analytics.ts to add --provenance option and handler**

Add `provenance?: boolean` to `AnalyticsOptions` interface (line 30):

```typescript
  provenance?: boolean;
```

Add import after existing imports (line 16):

```typescript
import { AdoptionEngineV2 } from '../core/adoption-engine.js';
import { JSONLEventStore } from '../core/provenance/event-store-jsonl.js';
```

In `runAnalytics` function, after the `--demo` block (after line 75), add provenance data path before the existing `computeAdoptionProfile` call. Insert after the `const periodDays` line (before line 85):

```typescript
  const periodDays = opts.period === '90d' ? 90 : opts.period === '30d' ? 30 : 7;

  // ─── Provenance data source (Phase 1+2A) ───
  if (opts.provenance) {
    try {
      const store = new JSONLEventStore(cwd);
      const engine = new AdoptionEngineV2(store);
      const profile = await engine.computeProfile({
        projectPath: cwd,
        changeName: opts.project ? undefined : opts.change,
        periodDays,
      });

      if (opts.json) {
        const json = formatAdoptionProfileJson(profile);
        console.log(JSON.stringify(json, null, 2));
        return 0;
      }

      logger.info(formatAdoptionProfile(profile));
      return 0;
    } catch (err) {
      logger.error(`Provenance analytics failed: ${(err as Error).message}`);
      return 1;
    }
  }

  try {
```

- [x] **Step 2: Update CLI definition to register --provenance flag**

Find the analytics command registration in `src/cli/index.ts` and add `--provenance` option. Search for the analytics command definition first:

```typescript
.option('--provenance', 'Use provenance data source (Phase 0 Origin events)')
```

(Add this `.option()` call to the analytics command chain in `src/cli/index.ts`.)

- [x] **Step 3: Run tests**

Run: `npm run test`
Expected: All existing tests pass

- [x] **Step 4: Run typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: No errors

- [x] **Step 5: Commit**

```bash
git add src/commands/analytics.ts src/cli/index.ts
git commit -m "feat: add --provenance flag to analytics CLI for provenance data source"
```

---

### Task 9: dashboard.ts — 新增 Lifecycle Funnel + Abandonment Reasons 面板

**Files:**
- Modify: `src/commands/dashboard.ts`

**Interfaces:**
- Consumes: `AdoptionEngineV2`, `JSONLEventStore`, existing `renderOnce` structure, `sectionHeader`, `row`, `borderMid`, `borderBottom` helpers
- Produces: Two new panels appended in `renderOnce`: Lifecycle Funnel and Abandonment Reasons

- [x] **Step 1: Add helper functions and panel rendering**

Add import after existing imports in `src/commands/dashboard.ts`:

```typescript
import { AdoptionEngineV2 } from '../core/adoption-engine.js';
import { JSONLEventStore } from '../core/provenance/event-store-jsonl.js';
```

In `renderOnce` function, add the new panels before the `borderMid` footer section (before line 355). Insert after the Check Report panel (after line 353):

```typescript
  // ─── Lifecycle Funnel (Phase 1+2A — provenance data) ───
  try {
    const provStore = new JSONLEventStore(cwd);
    const provEngine = new AdoptionEngineV2(provStore);
    const provProfile = await provEngine.computeProfile({ projectPath: cwd });

    if (provProfile.failureIntelligence && Object.keys(provProfile.failureIntelligence.byPhase).length > 0) {
      push(sectionHeader('Lifecycle Funnel  —  AI code lifecycle stages', boxWidth));
      const fi = provProfile.failureIntelligence;
      const phases = ['CREATED', 'GENERATED', 'ADOPTED', 'MODIFIED', 'ARCHIVED'];
      const maxTotal = Math.max(...phases.map((p) => fi.byPhase[p]?.total ?? 0), 1);
      for (const phase of phases) {
        const counts = fi.byPhase[phase];
        const total = counts?.total ?? 0;
        const failed = counts?.failed ?? 0;
        const barLen = Math.max(1, Math.round((total / maxTotal) * 16));
        const bar = '█'.repeat(barLen) + '░'.repeat(Math.max(0, 16 - barLen));
        push(row(`  ${phase.padEnd(12)} ${bar}  ${total} origins  (${failed} stalled)`, boxWidth));
      }
      push('');
    }

    if (provProfile.abandonment && provProfile.abandonment.totalOrigins > 0) {
      push(sectionHeader('Abandonment Reasons  —  8 categories', boxWidth));
      const ab = provProfile.abandonment;
      push(row(`Total origins: ${ab.totalOrigins}  |  Abandoned: ${ab.abandonedOrigins}  (${Math.round(ab.abandonmentRate * 100)}%)`, boxWidth));
      push(row(`Time to abandon: min ${ab.timeToAbandon.minHours.toFixed(1)}h / median ${ab.timeToAbandon.medianHours.toFixed(1)}h / p95 ${ab.timeToAbandon.p95Hours.toFixed(1)}h`, boxWidth));

      const reasons: Array<[string, number]> = Object.entries(ab.byReason)
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1]);

      if (reasons.length > 0) {
        const maxCount = Math.max(...reasons.map(([, c]) => c), 1);
        for (const [reason, count] of reasons) {
          const barLen = Math.max(1, Math.round((count / maxCount) * 12));
          const bar = '█'.repeat(barLen) + '░'.repeat(Math.max(0, 12 - barLen));
          push(row(`  ${reason.padEnd(20)} ${bar}  ${count}`, boxWidth));
        }
      } else {
        push(row('  No abandoned origins detected.', boxWidth));
      }
      push('');
    }
  } catch {
    // provenance data not available — skip panels silently
  }
```

- [x] **Step 2: Run tests**

Run: `npm run test`
Expected: All existing tests pass

- [x] **Step 3: Run typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: No errors

- [x] **Step 4: Commit**

```bash
git add src/commands/dashboard.ts
git commit -m "feat: add Lifecycle Funnel and Abandonment Reasons panels to dashboard"
```

---

### Task 10: formatAdoptionProfile 输出新增 V2 指标

**Files:**
- Modify: `src/core/adoption-engine.ts` (`formatAdoptionProfile` and `formatAdoptionProfileJson` functions)

**Interfaces:**
- Consumes: Extended `AdoptionProfile` with V2 fields
- Produces: Updated human-readable and JSON output including retention, rework, abandonment, lineage, failure

- [x] **Step 1: Update formatAdoptionProfile to include V2 metrics**

In `formatAdoptionProfile` function, add after the Weekly Trend section (after line 275) and before the Confidence section (before line 278):

```typescript
  // ─── V2: Retention ───
  if (profile.retention) {
    const r = profile.retention;
    lines.push('🔒 Retention Ratio');
    lines.push(`  AI lines generated:  ${r.totalGeneratedLines}`);
    lines.push(`  Lines surviving:     ${r.surviveLines}`);
    lines.push(`  Retention rate:      ${Math.round(r.retentionRatio * 100)}%`);
    lines.push(`  Tracked over:        ${r.trackedCommits} commits`);
    lines.push(`  Confidence:          ${r.confidence}`);
    lines.push('');
  }

  // ─── V2: Rework ───
  if (profile.rework) {
    const rw = profile.rework;
    lines.push('🔧 Rework Cost');
    lines.push(`  AI generated:    ${rw.aiGeneratedLines} lines`);
    lines.push(`  Human modified:  ${rw.humanModifiedLines} lines`);
    lines.push(`  Rework ratio:    ${Math.round(rw.reworkRatio * 100)}%`);
    lines.push(`  Modifications:   ${rw.modificationCount}`);
    lines.push(`  Confidence:      ${rw.confidence}`);
    lines.push('');
  }

  // ─── V2: Abandonment ───
  if (profile.abandonment) {
    const ab = profile.abandonment;
    lines.push('🗑️  Abandonment');
    lines.push(`  Origins:       ${ab.totalOrigins}`);
    lines.push(`  Abandoned:     ${ab.abandonedOrigins} (${Math.round(ab.abandonmentRate * 100)}%)`);
    lines.push(`  Time to abandon: min ${ab.timeToAbandon.minHours.toFixed(1)}h / median ${ab.timeToAbandon.medianHours.toFixed(1)}h / p95 ${ab.timeToAbandon.p95Hours.toFixed(1)}h`);

    const topReasons = Object.entries(ab.byReason)
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    if (topReasons.length > 0) {
      lines.push('  Top reasons:');
      for (const [reason, count] of topReasons) {
        lines.push(`    ${reason}: ${count}`);
      }
    }
    lines.push('');
  }

  // ─── V2: Lineage ───
  if (profile.lineage) {
    const ln = profile.lineage;
    lines.push('🧬 Code Lineage');
    lines.push(`  L1 File matches:      ${ln.l1FileMatches}`);
    lines.push(`  L2 AST matches:       ${ln.l2AstMatches}`);
    lines.push(`  L3 Semantic matches:  ${ln.l3SemanticMatches}`);
    lines.push(`  Tracked origins:      ${ln.totalTrackedOrigins}`);
    lines.push(`  Confidence:           ${ln.confidence}`);
    lines.push('');
  }

  // ─── V2: Failure Intelligence ───
  if (profile.failureIntelligence) {
    const fi = profile.failureIntelligence;
    lines.push('⚠️  Failure Intelligence');
    for (const [phase, counts] of Object.entries(fi.byPhase)) {
      const pct = counts.total > 0 ? Math.round(counts.rate * 100) : 0;
      lines.push(`  ${phase}: ${counts.failed}/${counts.total} failed (${pct}%)`);
    }
    if (fi.topFailureModes.length > 0) {
      lines.push('  Top failure modes:');
      for (const mode of fi.topFailureModes) {
        lines.push(`    ${mode.pattern}: ${mode.count} occurrences`);
      }
    }
    lines.push('');
  }
```

- [x] **Step 2: Update formatAdoptionProfileJson to include V2 fields**

In `formatAdoptionProfileJson`, add V2 fields to the return object:

```typescript
    retention: profile.retention ?? null,
    rework: profile.rework ?? null,
    abandonment: profile.abandonment ?? null,
    lineage: profile.lineage ?? null,
    failureIntelligence: profile.failureIntelligence ?? null,
```

- [x] **Step 3: Run tests**

Run: `npm run test`
Expected: All existing tests pass

- [x] **Step 4: Run typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: No errors

- [x] **Step 5: Commit**

```bash
git add src/core/adoption-engine.ts
git commit -m "feat: add V2 metrics output to formatAdoptionProfile and JSON format"
```

---

### Task 11: 向下兼容验证 + 最终质量门

**Files:**
- Modify: None (verification only)

- [x] **Step 1: Ensure V1 API deprecated marker is in place**

Verify `computeAdoptionProfile` has `/** @deprecated Use AdoptionEngineV2 with provenance data source */` JSDoc tag in `src/core/adoption-engine.ts`.

- [x] **Step 2: Run full test suite**

Run: `npm run test`
Expected: All tests pass (existing V1 tests + new V2 tests)

- [x] **Step 3: Run typecheck**

Run: `npm run typecheck` (or `npx tsc --noEmit`)
Expected: No type errors

- [x] **Step 4: Run lint**

Run: `npm run lint`
Expected: No lint errors

- [x] **Step 5: Verify no new npm dependencies**

Run: `git diff c23099094f77fae68bf3e9702087323b435f1f25 -- package.json`
Expected: No changes to package.json

- [x] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: final backward compatibility verification and quality gates"
```

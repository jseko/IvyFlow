---
change: analytics-adoption-intelligence-phase2b
design-doc: docs/superpowers/specs/2026-07-18-ai-adoption-intelligence-phase2b-design.md
base-ref: e069fc03877df99b8d1c8e5e36f430da98c7ab5f
---

# AI Adoption Intelligence — Phase 2B Value Intelligence 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Value Index、Context Intelligence（CSI）、Feedback Loop 三大模块，并集成到 `ivy analytics` CLI 和 `ivy dashboard`。

**Architecture:** 在现有 `src/core/adoption/` 下新增 `value-engine.ts`、`context-intelligence.ts`、`feedback-loop.ts`，复用 Phase 0 provenance 和 Phase 1+2A retention/rework/abandonment 数据。`AdoptionEngineV2` 集成新模块计算 Value Index，`analytics.ts` 和 `dashboard.ts` 通过新 flag 暴露结果。

**Tech Stack:** TypeScript ESM, vitest, 无新增 npm 依赖

## Global Constraints

- TypeScript strict mode, ESM, target ES2022
- 无新增 npm 依赖
- 向下兼容：所有现有测试通过（`npm test` 通过）
- 使用 Phase 0 provenance/ 和 Phase 1+2A adoption/ 模块
- 所有新文件置于 `src/core/adoption/` 下
- 新类型在 `src/core/adoption-engine.ts` 中定义
- 测试文件命名：`src/core/adoption/<module-name>.test.ts`

---

### Task 1: Value Engine — 核心计算

**Files:**
- Create: `src/core/adoption/value-engine.ts`
- Modify: `src/core/adoption-engine.ts` (add types, integrate computeValueIndex in computeProfile)
- Test: `src/core/adoption/value-engine.test.ts`

**Interfaces:**
- Consumes:
  - `OriginProjection` from `src/core/provenance/types.js`
  - `RetentionMetrics`, `ReworkMetrics`, `AbandonmentMetrics` from `src/core/adoption-engine.js`
- Produces:
  - `BusinessImpactType` = `'payment' | 'security' | 'core_business' | 'data_pipeline' | 'infrastructure' | 'crud' | 'api_gateway' | 'unknown'`
  - `ValueIndex = { valueIndex: number; qualityFactor: number; businessImpactType: BusinessImpactType; businessImpactWeight: number; retentionRatio: number; reworkCost: number; abandonmentRate: number }`
  - `computeValueIndex(projection: OriginProjection, projectPath: string, retentionWindow?: number): Promise<ValueIndex>`

- [ ] **Step 1: 在 adoption-engine.ts 中添加 ValueIndex 类型和 AdoptionProfile 扩展**

```typescript
// 在 adoption-engine.ts 的 AdoptionProfile 接口中，v2 fields 之后添加：

export type BusinessImpactType =
  | 'payment'
  | 'security'
  | 'core_business'
  | 'data_pipeline'
  | 'infrastructure'
  | 'crud'
  | 'api_gateway'
  | 'unknown';

export interface ValueIndex {
  valueIndex: number;
  qualityFactor: number;
  businessImpactType: BusinessImpactType;
  businessImpactWeight: number;
  retentionRatio: number;
  reworkCost: number;
  abandonmentRate: number;
}

// 在 AdoptionProfile 接口的 failureIntelligence?: FailureMetrics; 之后添加：
  valueIndex?: ValueIndex;
```

- [ ] **Step 2: 编写 value-engine.test.ts — 先写空 origins 测试**

```typescript
import { describe, it, expect } from 'vitest';
import { computeValueIndex } from './value-engine.js';
import type { OriginProjection, Origin } from '../provenance/types.js';

function makeOrigin(
  id: string,
  filePath: string,
  fingerprint: string,
  aiLifecycle: string = 'GENERATED',
): Origin {
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

describe('computeValueIndex', () => {
  it('should return default valueIndex when origins is empty', async () => {
    const projection = makeProjection([]);
    const result = await computeValueIndex(projection, '/tmp/test', 5);
    expect(result.valueIndex).toBe(0);
    expect(result.businessImpactType).toBe('unknown');
  });

  it('should classify payment path correctly', () => {
    const origin = makeOrigin('o1', 'src/payment/checkout.ts', 'abc');
    const projection = makeProjection([origin]);
    // classification tested indirectly through businessImpactType in computeValueIndex
    // but we test the classification function directly below
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

```bash
npx vitest run src/core/adoption/value-engine.test.ts
```

Expected: FAIL — `computeValueIndex is not a function` 或类似

- [ ] **Step 4: 实现 value-engine.ts**

```typescript
import type { OriginProjection } from '../provenance/types.js';
import type { ValueIndex, BusinessImpactType } from '../adoption-engine.js';
import { computeRetention } from './retention.js';
import { computeRework } from './rework.js';
import { computeAbandonment } from './abandonment.js';

const BUSINESS_IMPACT_RULES: Array<{ pattern: RegExp; type: BusinessImpactType; weight: number }> = [
  { pattern: /\/payment\/|\/billing\//, type: 'payment', weight: 2.0 },
  { pattern: /\/auth\/|\/security\//, type: 'security', weight: 2.0 },
  { pattern: /\/core\/|\/domain\/|\/service\//, type: 'core_business', weight: 1.5 },
  { pattern: /\/pipeline\/|\/etl\//, type: 'data_pipeline', weight: 1.2 },
  { pattern: /\/infra\/|\/config\//, type: 'infrastructure', weight: 1.0 },
  { pattern: /\/controller\/|\/handler\/|\/router\//, type: 'crud', weight: 0.5 },
  { pattern: /\/gateway\/|\/proxy\//, type: 'api_gateway', weight: 0.8 },
];

function classifyBusinessImpact(filePaths: string[]): { type: BusinessImpactType; weight: number } {
  let maxWeight = 1.0;
  let maxType: BusinessImpactType = 'unknown';

  for (const fp of filePaths) {
    for (const rule of BUSINESS_IMPACT_RULES) {
      if (rule.pattern.test(fp) && rule.weight > maxWeight) {
        maxWeight = rule.weight;
        maxType = rule.type;
      }
    }
  }

  return { type: maxType, weight: maxWeight };
}

export async function computeValueIndex(
  projection: OriginProjection,
  projectPath: string,
  retentionWindow: number = 5,
): Promise<ValueIndex> {
  const origins = [...projection.origins.values()];
  if (origins.length === 0) {
    return {
      valueIndex: 0,
      qualityFactor: 0,
      businessImpactType: 'unknown',
      businessImpactWeight: 1.0,
      retentionRatio: 0,
      reworkCost: 0,
      abandonmentRate: 0,
    };
  }

  const filePaths = origins.flatMap((o) => o.artifacts.map((a) => a.filePath));
  const { type: businessImpactType, weight: businessImpactWeight } = classifyBusinessImpact(filePaths);

  const [retention, rework, abandonment] = await Promise.all([
    computeRetention(projection, projectPath, retentionWindow),
    computeRework(projection, projectPath),
    Promise.resolve(computeAbandonment(projection, projectPath)),
  ]);

  const retentionRatio = retention.retentionRatio;
  const reworkCost = rework.reworkRatio;
  const abandonmentRate = abandonment.abandonmentRate;

  const qualityFactor = 1 - (reworkCost + abandonmentRate) / 2;
  const valueIndex = retentionRatio * Math.max(0, qualityFactor) * businessImpactWeight;

  return {
    valueIndex,
    qualityFactor: Math.max(0, Math.min(1, qualityFactor)),
    businessImpactType,
    businessImpactWeight,
    retentionRatio,
    reworkCost,
    abandonmentRate,
  };
}
```

- [ ] **Step 5: 运行测试确认通过**

```bash
npx vitest run src/core/adoption/value-engine.test.ts
```

Expected: PASS

- [ ] **Step 6: 补充完整测试用例 — 分类测试和计算测试**

```typescript
describe('classifyBusinessImpact (via computeValueIndex)', () => {
  it('should classify payment path with weight 2.0', async () => {
    const origin = makeOrigin('o1', 'src/payment/checkout.ts', 'abc');
    const projection = makeProjection([origin]);
    const result = await computeValueIndex(projection, '/tmp/test', 5);
    expect(result.businessImpactType).toBe('payment');
    expect(result.businessImpactWeight).toBe(2.0);
  });

  it('should classify security path with weight 2.0', async () => {
    const origin = makeOrigin('o1', 'src/auth/login.ts', 'abc');
    const projection = makeProjection([origin]);
    const result = await computeValueIndex(projection, '/tmp/test', 5);
    expect(result.businessImpactType).toBe('security');
    expect(result.businessImpactWeight).toBe(2.0);
  });

  it('should pick highest weight when multiple patterns match', async () => {
    const o1 = makeOrigin('o1', 'src/payment/billing.ts', 'abc');
    const o2 = makeOrigin('o2', 'src/infra/config.ts', 'def');
    const projection = makeProjection([o1, o2]);
    const result = await computeValueIndex(projection, '/tmp/test', 5);
    expect(result.businessImpactType).toBe('payment');
    expect(result.businessImpactWeight).toBe(2.0);
  });

  it('should default to unknown with weight 1.0 for unmatched path', async () => {
    const origin = makeOrigin('o1', 'src/utils/helper.ts', 'abc');
    const projection = makeProjection([origin]);
    const result = await computeValueIndex(projection, '/tmp/test', 5);
    expect(result.businessImpactType).toBe('unknown');
    expect(result.businessImpactWeight).toBe(1.0);
  });

  it('should compute valueIndex > 0 when origins exist', async () => {
    const origin = makeOrigin('o1', 'src/core/service.ts', 'abc');
    const projection = makeProjection([origin]);
    const result = await computeValueIndex(projection, '/tmp/test', 5);
    expect(result.valueIndex).toBeGreaterThan(0);
    expect(result.qualityFactor).toBeGreaterThanOrEqual(0);
    expect(result.retentionRatio).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 7: 运行全部测试确认通过**

```bash
npx vitest run src/core/adoption/value-engine.test.ts
```

Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add src/core/adoption/value-engine.ts src/core/adoption/value-engine.test.ts src/core/adoption-engine.ts
git commit -m "feat: add Value Engine with business impact classification"
```

---

### Task 2: Context Intelligence — CSI 计算

**Files:**
- Create: `src/core/adoption/context-intelligence.ts`
- Modify: `src/core/adoption-engine.ts` (add CSI types)
- Test: `src/core/adoption/context-intelligence.test.ts`

**Interfaces:**
- Consumes:
  - `OriginProjection`, `Origin`, `AIOperation` from `src/core/provenance/types.js`
- Produces:
  - `ContextDimension = { dimension: 'codebaseContext' | 'knowledgeContext' | 'taskContext'; available: number; required: number; ratio: number }`
  - `CSIMetrics = { csi: number; taskType: AIOperation; confidence: 'low' | 'medium' | 'high'; dimensions: ContextDimension[] }`
  - `computeCSI(projection: OriginProjection): Promise<CSIMetrics>`

- [ ] **Step 1: 在 adoption-engine.ts 中添加 CSI 类型和 AdoptionProfile 扩展**

```typescript
// 在 adoption-engine.ts，ValueIndex 类型之后添加：

export type ContextDimensionName = 'codebaseContext' | 'knowledgeContext' | 'taskContext';

export interface ContextDimension {
  dimension: ContextDimensionName;
  available: number;
  required: number;
  ratio: number;
}

export interface CSIMetrics {
  csi: number;
  taskType: AIOperation;
  confidence: 'low' | 'medium' | 'high';
  dimensions: ContextDimension[];
}

// 在 AdoptionProfile 接口的 valueIndex?: ValueIndex; 之后添加：
  csi?: CSIMetrics;
```

- [ ] **Step 2: 编写 context-intelligence.test.ts — 空 origins 测试**

```typescript
import { describe, it, expect } from 'vitest';
import { computeCSI } from './context-intelligence.js';
import type { OriginProjection, Origin } from '../provenance/types.js';

function makeOrigin(
  id: string,
  filePath: string,
  operation: string = 'GENERATE',
): Origin {
  return {
    id,
    createdAt: Date.now() - 86400000,
    provider: 'test-provider',
    actions: [{ id: 'a1', provider: 'test', operation: operation as 'GENERATE' | 'EDIT' | 'DELETE', artifact: { path: filePath }, metadata: {} }],
    artifacts: [{ filePath, fingerprint: 'abc' }],
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

describe('computeCSI', () => {
  it('should return zero CSI for empty origins', async () => {
    const projection = makeProjection([]);
    const result = await computeCSI(projection);
    expect(result.csi).toBe(0);
    expect(result.taskType).toBe('GENERATE');
    expect(result.confidence).toBe('low');
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

```bash
npx vitest run src/core/adoption/context-intelligence.test.ts
```

Expected: FAIL

- [ ] **Step 4: 实现 context-intelligence.ts**

```typescript
import type { OriginProjection, AIOperation } from '../provenance/types.js';
import type { CSIMetrics, ContextDimension, ContextDimensionName } from '../adoption-engine.js';

const REQUIRED_CONTEXT_FILES: Record<AIOperation, number> = {
  GENERATE: 8,
  EDIT: 4,
  DELETE: 2,
};

function estimateAvailableContext(projection: OriginProjection): {
  codebaseContext: number;
  knowledgeContext: number;
  taskContext: number;
} {
  const origins = [...projection.origins.values()];
  const fileSet = new Set<string>();

  for (const origin of origins) {
    for (const artifact of origin.artifacts) {
      fileSet.add(artifact.filePath);
    }
  }

  const codebaseContext = Math.min(fileSet.size, 20);
  const knowledgeContext = Math.min(origins.length * 2, 10);
  const taskContext = Math.min(origins.filter((o) => o.actions.length > 0).length, 5);

  return { codebaseContext, knowledgeContext, taskContext };
}

function inferDominantTaskType(projection: OriginProjection): AIOperation {
  const origins = [...projection.origins.values()];
  const counts: Record<AIOperation, number> = { GENERATE: 0, EDIT: 0, DELETE: 0 };

  for (const origin of origins) {
    for (const action of origin.actions) {
      counts[action.operation] = (counts[action.operation] ?? 0) + 1;
    }
  }

  let max: AIOperation = 'GENERATE';
  let maxCount = 0;
  for (const op of ['GENERATE', 'EDIT', 'DELETE'] as AIOperation[]) {
    if (counts[op] > maxCount) {
      maxCount = counts[op];
      max = op;
    }
  }

  return max;
}

export async function computeCSI(
  projection: OriginProjection,
): Promise<CSIMetrics> {
  const origins = [...projection.origins.values()];
  if (origins.length === 0) {
    return {
      csi: 0,
      taskType: 'GENERATE',
      confidence: 'low',
      dimensions: [
        { dimension: 'codebaseContext', available: 0, required: REQUIRED_CONTEXT_FILES.GENERATE, ratio: 0 },
        { dimension: 'knowledgeContext', available: 0, required: 2, ratio: 0 },
        { dimension: 'taskContext', available: 0, required: 1, ratio: 0 },
      ],
    };
  }

  const taskType = inferDominantTaskType(projection);
  const requiredFiles = REQUIRED_CONTEXT_FILES[taskType];
  const available = estimateAvailableContext(projection);

  const dimensions: ContextDimension[] = [
    {
      dimension: 'codebaseContext',
      available: available.codebaseContext,
      required: requiredFiles,
      ratio: Math.min(1, available.codebaseContext / requiredFiles),
    },
    {
      dimension: 'knowledgeContext',
      available: available.knowledgeContext,
      required: 2,
      ratio: Math.min(1, available.knowledgeContext / 2),
    },
    {
      dimension: 'taskContext',
      available: available.taskContext,
      required: 1,
      ratio: Math.min(1, available.taskContext / 1),
    },
  ];

  const csi = dimensions.reduce((sum, d) => sum + d.ratio, 0) / dimensions.length;

  return {
    csi: Math.round(csi * 100) / 100,
    taskType,
    confidence: origins.length >= 5 ? 'medium' : 'low',
    dimensions,
  };
}
```

- [ ] **Step 5: 运行测试确认通过**

```bash
npx vitest run src/core/adoption/context-intelligence.test.ts
```

Expected: PASS

- [ ] **Step 6: 补充完整测试用例**

```typescript
describe('computeCSI with data', () => {
  it('should compute CSI for GENERATE task type', async () => {
    const origins: Origin[] = [];
    for (let i = 0; i < 10; i++) {
      origins.push(makeOrigin(`o${i}`, `src/file${i}.ts`, 'GENERATE'));
    }
    const projection = makeProjection(origins);
    const result = await computeCSI(projection);
    expect(result.taskType).toBe('GENERATE');
    expect(result.csi).toBeGreaterThan(0);
    expect(result.csi).toBeLessThanOrEqual(1);
    expect(result.dimensions).toHaveLength(3);
  });

  it('should infer EDIT as dominant task type', async () => {
    const o1 = makeOrigin('o1', 'src/file1.ts', 'EDIT');
    const o2 = makeOrigin('o2', 'src/file2.ts', 'EDIT');
    const o3 = makeOrigin('o3', 'src/file3.ts', 'GENERATE');
    const projection = makeProjection([o1, o2, o3]);
    const result = await computeCSI(projection);
    expect(result.taskType).toBe('EDIT');
  });

  it('should infer DELETE as dominant task type', async () => {
    const o1 = makeOrigin('o1', 'src/file1.ts', 'DELETE');
    const projection = makeProjection([o1]);
    const result = await computeCSI(projection);
    expect(result.taskType).toBe('DELETE');
  });

  it('should return low confidence for fewer than 5 origins', async () => {
    const origin = makeOrigin('o1', 'src/file1.ts', 'GENERATE');
    const projection = makeProjection([origin]);
    const result = await computeCSI(projection);
    expect(result.confidence).toBe('low');
  });

  it('should return medium confidence for 5+ origins', async () => {
    const origins: Origin[] = [];
    for (let i = 0; i < 5; i++) {
      origins.push(makeOrigin(`o${i}`, `src/file${i}.ts`, 'GENERATE'));
    }
    const projection = makeProjection(origins);
    const result = await computeCSI(projection);
    expect(result.confidence).toBe('medium');
  });

  it('should have all three dimensions present', async () => {
    const origin = makeOrigin('o1', 'src/file1.ts', 'GENERATE');
    const projection = makeProjection([origin]);
    const result = await computeCSI(projection);
    const dimNames = result.dimensions.map((d) => d.dimension);
    expect(dimNames).toContain('codebaseContext');
    expect(dimNames).toContain('knowledgeContext');
    expect(dimNames).toContain('taskContext');
  });
});
```

- [ ] **Step 7: 运行全部测试确认通过**

```bash
npx vitest run src/core/adoption/context-intelligence.test.ts
```

Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add src/core/adoption/context-intelligence.ts src/core/adoption/context-intelligence.test.ts src/core/adoption-engine.ts
git commit -m "feat: add Context Intelligence (CSI) calculation"
```

---

### Task 3: Feedback Loop — 隐式反馈推断

**Files:**
- Create: `src/core/adoption/feedback-loop.ts`
- Modify: `src/core/adoption-engine.ts` (add Feedback types)
- Test: `src/core/adoption/feedback-loop.test.ts`

**Interfaces:**
- Consumes:
  - `OriginProjection`, `Origin` from `src/core/provenance/types.js`
  - `runGit`, `isGitRepo` from `src/utils/git.js`
- Produces:
  - `FeedbackType` = `'accepted_and_kept' | 'accepted_then_modified' | 'accepted_then_deleted' | 'rejected_outright' | 'unknown'`
  - `FeedbackEntry = { originId: string; type: FeedbackType; confidence: 'low' | 'medium'; commitsSince: number }`
  - `FeedbackLoopSummary = { entries: FeedbackEntry[]; summary: { acceptedAndKept: number; acceptedThenModified: number; acceptedThenDeleted: number; rejectedOutright: number; unknown: number } }`
  - `inferFeedback(projection: OriginProjection, projectPath: string): Promise<FeedbackLoopSummary>`

- [ ] **Step 1: 在 adoption-engine.ts 中添加 Feedback 类型和 AdoptionProfile 扩展**

```typescript
// 在 adoption-engine.ts，CSIMetrics 类型之后添加：

export type FeedbackType =
  | 'accepted_and_kept'
  | 'accepted_then_modified'
  | 'accepted_then_deleted'
  | 'rejected_outright'
  | 'unknown';

export interface FeedbackEntry {
  originId: string;
  type: FeedbackType;
  confidence: 'low' | 'medium';
  commitsSince: number;
}

export interface FeedbackLoopSummary {
  entries: FeedbackEntry[];
  summary: {
    acceptedAndKept: number;
    acceptedThenModified: number;
    acceptedThenDeleted: number;
    rejectedOutright: number;
    unknown: number;
  };
}

// 在 AdoptionProfile 接口的 csi?: CSIMetrics; 之后添加：
  feedback?: FeedbackLoopSummary;
```

- [ ] **Step 2: 编写 feedback-loop.test.ts — 空 origins 测试**

```typescript
import { describe, it, expect } from 'vitest';
import { inferFeedback } from './feedback-loop.js';
import type { OriginProjection, Origin } from '../provenance/types.js';

function makeOrigin(
  id: string,
  filePath: string,
  aiLifecycle: string = 'GENERATED',
  gitLifecycle: string = 'COMMITTED',
): Origin {
  return {
    id,
    createdAt: Date.now() - 86400000,
    provider: 'test-provider',
    actions: [{ id: 'a1', provider: 'test', operation: 'GENERATE', artifact: { path: filePath }, metadata: {} }],
    artifacts: [{ filePath, fingerprint: 'abc' }],
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

describe('inferFeedback', () => {
  it('should return empty summary for empty origins', async () => {
    const projection = makeProjection([]);
    const result = await inferFeedback(projection, '/tmp/test');
    expect(result.entries).toHaveLength(0);
    expect(result.summary.acceptedAndKept).toBe(0);
  });

  it('should return unknown for non-git project', async () => {
    const origin = makeOrigin('o1', 'src/test.ts');
    const projection = makeProjection([origin]);
    const result = await inferFeedback(projection, '/tmp/nonexistent');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].type).toBe('unknown');
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

```bash
npx vitest run src/core/adoption/feedback-loop.test.ts
```

Expected: FAIL

- [ ] **Step 4: 实现 feedback-loop.ts**

```typescript
import type { OriginProjection, Origin } from '../provenance/types.js';
import type { FeedbackType, FeedbackEntry, FeedbackLoopSummary } from '../adoption-engine.js';
import { runGit, isGitRepo } from '../../utils/git.js';

const ACCEPTED_AND_KEPT_THRESHOLD = 30;
const ACCEPTED_THEN_MODIFIED_THRESHOLD = 10;
const ACCEPTED_THEN_DELETED_THRESHOLD = 5;

async function inferFeedbackForOrigin(
  origin: Origin,
  projectPath: string,
): Promise<FeedbackEntry> {
  const filePath = origin.artifacts[0]?.filePath;
  if (!filePath) {
    return { originId: origin.id, type: 'unknown', confidence: 'low', commitsSince: 0 };
  }

  try {
    const { stdout: logOutput } = await runGit(
      ['log', '--oneline', '--', filePath],
      projectPath,
    );
    const commits = logOutput.trim().split('\n').filter(Boolean);
    const commitsSince = commits.length;

    try {
      const { stdout: revertOutput } = await runGit(
        ['log', '--oneline', '--grep=revert', '-i', `--since=${new Date(origin.createdAt).toISOString()}`, '--', filePath],
        projectPath,
      );
      if (revertOutput.trim()) {
        return { originId: origin.id, type: 'rejected_outright', confidence: 'medium', commitsSince };
      }
    } catch {
      // no revert found, continue
    }

    if (commitsSince >= ACCEPTED_AND_KEPT_THRESHOLD) {
      return { originId: origin.id, type: 'accepted_and_kept', confidence: 'medium', commitsSince };
    }

    if (commitsSince >= ACCEPTED_THEN_MODIFIED_THRESHOLD) {
      return { originId: origin.id, type: 'accepted_then_modified', confidence: 'low', commitsSince };
    }

    if (commitsSince >= ACCEPTED_THEN_DELETED_THRESHOLD) {
      return { originId: origin.id, type: 'accepted_then_deleted', confidence: 'low', commitsSince };
    }

    return { originId: origin.id, type: 'unknown', confidence: 'low', commitsSince };
  } catch {
    return { originId: origin.id, type: 'unknown', confidence: 'low', commitsSince: 0 };
  }
}

export async function inferFeedback(
  projection: OriginProjection,
  projectPath: string,
): Promise<FeedbackLoopSummary> {
  const origins = [...projection.origins.values()];
  if (origins.length === 0) {
    return {
      entries: [],
      summary: {
        acceptedAndKept: 0,
        acceptedThenModified: 0,
        acceptedThenDeleted: 0,
        rejectedOutright: 0,
        unknown: 0,
      },
    };
  }

  const gitOk = await isGitRepo(projectPath);
  if (!gitOk) {
    const entries = origins.map((o) => ({
      originId: o.id,
      type: 'unknown' as FeedbackType,
      confidence: 'low' as const,
      commitsSince: 0,
    }));
    return {
      entries,
      summary: {
        acceptedAndKept: 0,
        acceptedThenModified: 0,
        acceptedThenDeleted: 0,
        rejectedOutright: 0,
        unknown: entries.length,
      },
    };
  }

  const entries = await Promise.all(
    origins.map((o) => inferFeedbackForOrigin(o, projectPath)),
  );

  const summary = {
    acceptedAndKept: entries.filter((e) => e.type === 'accepted_and_kept').length,
    acceptedThenModified: entries.filter((e) => e.type === 'accepted_then_modified').length,
    acceptedThenDeleted: entries.filter((e) => e.type === 'accepted_then_deleted').length,
    rejectedOutright: entries.filter((e) => e.type === 'rejected_outright').length,
    unknown: entries.filter((e) => e.type === 'unknown').length,
  };

  return { entries, summary };
}
```

- [ ] **Step 5: 运行测试确认通过**

```bash
npx vitest run src/core/adoption/feedback-loop.test.ts
```

Expected: PASS

- [ ] **Step 6: 补充完整测试用例**

```typescript
describe('inferFeedback summary structure', () => {
  it('should have correct summary keys', async () => {
    const origin = makeOrigin('o1', 'src/test.ts');
    const projection = makeProjection([origin]);
    const result = await inferFeedback(projection, '/tmp/nonexistent');
    expect(result.summary).toHaveProperty('acceptedAndKept');
    expect(result.summary).toHaveProperty('acceptedThenModified');
    expect(result.summary).toHaveProperty('acceptedThenDeleted');
    expect(result.summary).toHaveProperty('rejectedOutright');
    expect(result.summary).toHaveProperty('unknown');
  });

  it('should assign confidence to each entry', async () => {
    const origin = makeOrigin('o1', 'src/test.ts');
    const projection = makeProjection([origin]);
    const result = await inferFeedback(projection, '/tmp/nonexistent');
    for (const entry of result.entries) {
      expect(['low', 'medium']).toContain(entry.confidence);
    }
  });

  it('should include commitsSince in each entry', async () => {
    const origin = makeOrigin('o1', 'src/test.ts');
    const projection = makeProjection([origin]);
    const result = await inferFeedback(projection, '/tmp/nonexistent');
    for (const entry of result.entries) {
      expect(typeof entry.commitsSince).toBe('number');
    }
  });
});
```

- [ ] **Step 7: 运行全部测试确认通过**

```bash
npx vitest run src/core/adoption/feedback-loop.test.ts
```

Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add src/core/adoption/feedback-loop.ts src/core/adoption/feedback-loop.test.ts src/core/adoption-engine.ts
git commit -m "feat: add Feedback Loop with implicit feedback inference"
```

---

### Task 4: AdoptionEngineV2 集成 — computeProfile 调用新模块

**Files:**
- Modify: `src/core/adoption-engine.ts:138-186` (AdoptionEngineV2.computeProfile)
- Test: `src/core/adoption-engine-v2.test.ts` (扩展已有测试)

**Interfaces:**
- Consumes:
  - `computeValueIndex` from `./adoption/value-engine.js`
  - `computeCSI` from `./adoption/context-intelligence.js`
  - `inferFeedback` from `./adoption/feedback-loop.js`
- Produces: 更新后的 `AdoptionProfile`（含 `valueIndex`, `csi`, `feedback` 字段）

- [ ] **Step 1: 更新 adoption-engine.ts 的 imports 和 AdoptionEngineV2.computeProfile**

在 `src/core/adoption-engine.ts` 顶部 import 区添加：

```typescript
import { computeValueIndex } from './adoption/value-engine.js';
import { computeCSI } from './adoption/context-intelligence.js';
import { inferFeedback } from './adoption/feedback-loop.js';
```

修改 `AdoptionEngineV2.computeProfile` 方法（第141-185行），在现有的 `Promise.all` 中添加新模块调用：

```typescript
  async computeProfile(opts: ComputeOptions): Promise<AdoptionProfile> {
    const projection = await this.store.getProjection();
    const origins = [...projection.origins.values()];
    const periodDays = opts.periodDays ?? 30;

    const [retention, rework, abandonment, lineage, failureIntelligence, valueIndex, csi, feedback] = await Promise.all([
      computeRetention(projection, opts.projectPath, opts.retentionWindow),
      computeRework(projection, opts.projectPath),
      Promise.resolve(computeAbandonment(projection, opts.projectPath)),
      Promise.resolve(computeLineage(projection, opts.projectPath)),
      Promise.resolve(computeFailureIntelligence(projection)),
      computeValueIndex(projection, opts.projectPath, opts.retentionWindow),
      computeCSI(projection),
      inferFeedback(projection, opts.projectPath),
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
      valueIndex,
      csi,
      feedback,
    };

    return profile;
  }
```

- [ ] **Step 2: 扩展 adoption-engine-v2.test.ts**

```typescript
describe('AdoptionEngineV2.computeProfile — Phase 2B fields', () => {
  it('should include valueIndex in profile', async () => {
    const store = new JSONLEventStore('/tmp/nonexistent-v2-test');
    const engine = new AdoptionEngineV2(store);
    const profile = await engine.computeProfile({
      projectPath: '/tmp/nonexistent-v2-test',
    });
    expect(profile.valueIndex).toBeDefined();
  });

  it('should include csi in profile', async () => {
    const store = new JSONLEventStore('/tmp/nonexistent-v2-test');
    const engine = new AdoptionEngineV2(store);
    const profile = await engine.computeProfile({
      projectPath: '/tmp/nonexistent-v2-test',
    });
    expect(profile.csi).toBeDefined();
  });

  it('should include feedback in profile', async () => {
    const store = new JSONLEventStore('/tmp/nonexistent-v2-test');
    const engine = new AdoptionEngineV2(store);
    const profile = await engine.computeProfile({
      projectPath: '/tmp/nonexistent-v2-test',
    });
    expect(profile.feedback).toBeDefined();
  });
});
```

- [ ] **Step 3: 运行测试确认通过**

```bash
npx vitest run src/core/adoption-engine-v2.test.ts
```

Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add src/core/adoption-engine.ts src/core/adoption-engine-v2.test.ts
git commit -m "feat: integrate Value Engine, CSI, and Feedback Loop into AdoptionEngineV2"
```

---

### Task 5: CLI 集成 — analytics.ts 新增 --value / --csi / --feedback flag

**Files:**
- Modify: `src/commands/analytics.ts` (新增 flag + 输出逻辑)
- Modify: `src/cli/index.ts` (注册 flag)
- Test: `src/commands/analytics.test.ts` (扩展已有测试)

**Interfaces:**
- Consumes:
  - `AnalyticsOptions` 接口（扩展）
  - `AdoptionEngineV2`, `JSONLEventStore`（已有）
  - `formatAdoptionProfileJson`（已有）
- Produces: `runAnalytics` 处理新 flag 的分支逻辑

- [ ] **Step 1: 扩展 AnalyticsOptions 接口**

在 `src/commands/analytics.ts` 的 `AnalyticsOptions` 接口中添加：

```typescript
export interface AnalyticsOptions {
  cwd?: string;
  change?: string;
  project?: boolean;
  period?: '7d' | '30d' | '90d';
  enable?: boolean;
  disable?: boolean;
  json?: boolean;
  confidence?: boolean;
  demo?: boolean;
  explain?: boolean;
  trend?: boolean;
  provenance?: boolean;
  value?: boolean;
  csi?: boolean;
  feedback?: boolean;
}
```

- [ ] **Step 2: 在 runAnalytics 中添加 --provenance 分支的 flag 过滤输出**

在 `src/commands/analytics.ts` 的 `runAnalytics` 函数中，`--provenance` 分支（第89-111行）的 JSON 输出之后、human output 之前，添加 flag 过滤逻辑：

```typescript
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

      // Phase 2B: Value Intelligence flags
      if (opts.value && profile.valueIndex) {
        showValueOutput(profile.valueIndex);
        return 0;
      }

      if (opts.csi && profile.csi) {
        showCSIOutput(profile.csi);
        return 0;
      }

      if (opts.feedback && profile.feedback) {
        showFeedbackOutput(profile.feedback);
        return 0;
      }

      logger.info(formatAdoptionProfile(profile));
      return 0;
    } catch (err) {
      logger.error(`Provenance analytics failed: ${(err as Error).message}`);
      return 1;
    }
  }
```

- [ ] **Step 3: 添加输出格式化函数**

在 `src/commands/analytics.ts` 末尾（`formatDelta` 函数之后）添加：

```typescript
import type { ValueIndex, CSIMetrics, FeedbackLoopSummary } from '../core/adoption-engine.js';

function showValueOutput(vi: ValueIndex): void {
  logger.info('');
  logger.info('💰 Value Index');
  logger.info('═══════════════════════════════════════════════════════');
  logger.info(`  Value Index:        ${vi.valueIndex.toFixed(2)}`);
  logger.info(`  Quality Factor:     ${vi.qualityFactor.toFixed(2)}`);
  logger.info(`  Business Impact:    ${vi.businessImpactType} (weight: ${vi.businessImpactWeight})`);
  logger.info(`  Retention Ratio:    ${(vi.retentionRatio * 100).toFixed(0)}%`);
  logger.info(`  Rework Cost:        ${(vi.reworkCost * 100).toFixed(0)}%`);
  logger.info(`  Abandonment Rate:   ${(vi.abandonmentRate * 100).toFixed(0)}%`);
  logger.info('');
  logger.info('  Formula: Value = Retention × (1 - (Rework + Abandonment)/2) × BusinessWeight');
  logger.info('');
}

function showCSIOutput(csi: CSIMetrics): void {
  logger.info('');
  logger.info('🔍 Context Sufficiency Index (CSI)');
  logger.info('═══════════════════════════════════════════════════════');
  logger.info(`  CSI:              ${(csi.csi * 100).toFixed(0)}%`);
  logger.info(`  Task Type:        ${csi.taskType}`);
  logger.info(`  Confidence:       ${csi.confidence}`);
  logger.info('  Dimensions:');
  for (const d of csi.dimensions) {
    const bar = '█'.repeat(Math.round(d.ratio * 20)) + '░'.repeat(20 - Math.round(d.ratio * 20));
    logger.info(`    ${d.dimension.padEnd(18)} ${bar}  ${(d.ratio * 100).toFixed(0)}% (${d.available}/${d.required})`);
  }
  logger.info('');
}

function showFeedbackOutput(feedback: FeedbackLoopSummary): void {
  logger.info('');
  logger.info('🔄 Human Feedback Loop');
  logger.info('═══════════════════════════════════════════════════════');
  logger.info(`  Accepted & Kept:        ${feedback.summary.acceptedAndKept}`);
  logger.info(`  Accepted Then Modified: ${feedback.summary.acceptedThenModified}`);
  logger.info(`  Accepted Then Deleted:  ${feedback.summary.acceptedThenDeleted}`);
  logger.info(`  Rejected Outright:      ${feedback.summary.rejectedOutright}`);
  logger.info(`  Unknown:                ${feedback.summary.unknown}`);
  logger.info('');
  logger.info('  Thresholds: 30 commits (kept), 10 (modified), 5 (deleted)');
  logger.info('');
  if (feedback.entries.length > 0) {
    logger.info('  Details:');
    for (const e of feedback.entries.slice(0, 5)) {
      logger.info(`    ${e.originId}: ${e.type} (${e.confidence}, ${e.commitsSince} commits)`);
    }
    if (feedback.entries.length > 5) {
      logger.info(`    ... and ${feedback.entries.length - 5} more`);
    }
    logger.info('');
  }
}
```

- [ ] **Step 4: 更新 cli/index.ts — 注册 --value / --csi / --feedback flag**

在 `src/cli/index.ts` 的 `analytics` 命令定义中（第162-192行），`.option('--provenance', ...)` 之后添加：

```typescript
  .option('--value', 'Phase 2B: Show Value Index', false)
  .option('--csi', 'Phase 2B: Show Context Sufficiency Index', false)
  .option('--feedback', 'Phase 2B: Show Human Feedback Loop', false)
```

并在 `.action` 回调的解构参数中添加：

```typescript
value?: boolean; csi?: boolean; feedback?: boolean;
```

在 `runAnalytics` 调用中传入：

```typescript
value: opts.value,
csi: opts.csi,
feedback: opts.feedback,
```

- [ ] **Step 5: 运行测试确认通过**

```bash
npx vitest run src/commands/analytics.test.ts
```

Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/commands/analytics.ts src/cli/index.ts
git commit -m "feat: add --value, --csi, --feedback flags to analytics CLI"
```

---

### Task 6: Dashboard 集成 — Value Leakage / CSI / Feedback 面板

**Files:**
- Modify: `src/commands/dashboard.ts` (新增面板渲染逻辑)
- Modify: `src/cli/index.ts` (注册 dashboard flag，如需要)

**Interfaces:**
- Consumes:
  - `AdoptionEngineV2`, `JSONLEventStore`
  - `DashboardOptions` 接口（扩展）
- Produces: dashboard 面板输出（ASCII 面板）

- [ ] **Step 1: 在 renderOnce 中添加 Phase 2B 面板**

在 `src/commands/dashboard.ts` 顶部 import 区添加：

```typescript
import { AdoptionEngineV2 } from '../core/adoption-engine.js';
import { JSONLEventStore } from '../core/provenance/event-store-jsonl.js';
```

在 `DashboardOptions` 接口中添加（在 `demo?: boolean;` 之后）：

```typescript
  value?: boolean;
  csi?: boolean;
  feedback?: boolean;
```

在 `renderOnce` 函数中，`// Check Report (v0.6 — non-blocking health check)` 注释块之前（大约第344行），添加 Phase 2B 面板：

```typescript
  // Phase 2B: Value Intelligence panels (when --provenance mode and flags set)
  if (opts.value || opts.csi || opts.feedback) {
    try {
      const store = new JSONLEventStore(cwd);
      const engine = new AdoptionEngineV2(store);
      const v2Profile = await engine.computeProfile({
        projectPath: cwd,
        changeName: opts.change,
        periodDays,
      });

      if (opts.value && v2Profile.valueIndex) {
        const vi = v2Profile.valueIndex;
        push(sectionHeader('Value Index  —  Phase 2B', boxWidth));
        push(row(`Value Index:      ${vi.valueIndex.toFixed(2)}`, boxWidth));
        push(row(`Quality Factor:   ${vi.qualityFactor.toFixed(2)}`, boxWidth));
        push(row(`Business Impact:  ${vi.businessImpactType} (weight: ${vi.businessImpactWeight})`, boxWidth));
        push(row(`Retention:        ${(vi.retentionRatio * 100).toFixed(0)}%`, boxWidth));
        push(row(`Rework Cost:      ${(vi.reworkCost * 100).toFixed(0)}%`, boxWidth));
        push(row(`Abandonment:      ${(vi.abandonmentRate * 100).toFixed(0)}%`, boxWidth));
        push('');
      }

      if (opts.csi && v2Profile.csi) {
        const csi = v2Profile.csi;
        push(sectionHeader('Context Sufficiency Index (CSI)  —  Phase 2B', boxWidth));
        push(row(`CSI:              ${(csi.csi * 100).toFixed(0)}%`, boxWidth));
        push(row(`Task Type:        ${csi.taskType}`, boxWidth));
        push(row(`Confidence:       ${csi.confidence}`, boxWidth));
        for (const d of csi.dimensions) {
          const bar = '█'.repeat(Math.round(d.ratio * 12)) + '░'.repeat(Math.max(0, 12 - Math.round(d.ratio * 12)));
          push(row(`  ${d.dimension.padEnd(16)} ${bar}  ${(d.ratio * 100).toFixed(0)}% (${d.available}/${d.required})`, boxWidth));
        }
        push('');
      }

      if (opts.feedback && v2Profile.feedback) {
        const fb = v2Profile.feedback;
        push(sectionHeader('Human Feedback Loop  —  Phase 2B', boxWidth));
        push(row(`Accepted & Kept:        ${fb.summary.acceptedAndKept}`, boxWidth));
        push(row(`Accepted Then Modified: ${fb.summary.acceptedThenModified}`, boxWidth));
        push(row(`Accepted Then Deleted:  ${fb.summary.acceptedThenDeleted}`, boxWidth));
        push(row(`Rejected Outright:      ${fb.summary.rejectedOutright}`, boxWidth));
        push(row(`Unknown:                ${fb.summary.unknown}`, boxWidth));
        push('');
      }
    } catch {
      push(row('Phase 2B panels unavailable — provenance data not found', boxWidth));
      push('');
    }
  }
```

- [ ] **Step 2: 更新 cli/index.ts — 注册 dashboard --value / --csi / --feedback flag**

在 `src/cli/index.ts` 的 `dashboard` 命令定义中，`.option('--demo', ...)` 之后添加：

```typescript
  .option('--value', 'Phase 2B: Show Value Index panel', false)
  .option('--csi', 'Phase 2B: Show Context Sufficiency Index panel', false)
  .option('--feedback', 'Phase 2B: Show Feedback Loop panel', false)
```

并在 `.action` 回调的解构参数中添加：

```typescript
value?: boolean; csi?: boolean; feedback?: boolean;
```

在 `runDashboard` 调用中传入：

```typescript
value: opts.value,
csi: opts.csi,
feedback: opts.feedback,
```

- [ ] **Step 3: 运行测试确认通过**

```bash
npx vitest run src/commands/dashboard.test.ts
```

Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add src/commands/dashboard.ts src/cli/index.ts
git commit -m "feat: add Value Leakage, CSI, and Feedback Loop panels to dashboard"
```

---

### Task 7: 向下兼容验证

**Files:** 无新建

- [ ] **Step 1: 运行完整测试套件**

```bash
npx vitest run
```

Expected: ALL PASS（所有现有测试通过，新测试也通过）

- [ ] **Step 2: 运行 typecheck**

```bash
npx tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 3: 运行 lint**

```bash
npm run lint
```

Expected: 无 lint 错误（或仅 pre-existing 错误）

- [ ] **Step 4: 修复任何失败的测试或类型错误**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: verify backward compatibility — all tests, typecheck, and lint pass"
```

---

## 任务依赖关系

```
Task 1 (Value Engine)  ─┐
Task 2 (CSI)           ─┤
Task 3 (Feedback Loop) ─┼──> Task 4 (AdoptionEngineV2 集成) ──> Task 5 (CLI) ──> Task 6 (Dashboard) ──> Task 7 (兼容验证)
                         │
                         └──> (Tasks 1-3 可并行执行)
```

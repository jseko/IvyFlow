---
change: analytics-adoption-intelligence-phase0
design-doc: docs/superpowers/specs/2026-07-17-ai-code-observatory-phase0-design.md
base-ref: b71402acca60d061005d5dbf8da7ecee781fafcd
---

# AI Code Provenance Foundation — Phase 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AI Code Provenance Foundation — AI Provider Gateway, Origin Entity model, three-dimensional lifecycle, immutable event store, and code fingerprinting — as a pure-library module with no runtime environment dependencies.

**Architecture:** Four independently testable modules compose via clean interfaces. AI Provider Gateway (Adapter → Normalizer pipeline) produces AIActions. Origin Entity binds AIActions to CodeArtifacts and tracks status through three independent lifecycle dimensions (AI / Git / Runtime). JSONL-backed Event Store provides immutable append-only persistence with queryable projections. Code Fingerprint computes L0 (SHA256), L1a (structural), and L1b (semantic-lite) hashes with TypeScript Compiler API.

**Tech Stack:** TypeScript (ESM, NodeNext), Vitest for testing, TypeScript Compiler API for AST analysis, Node.js `crypto` for SHA256, `fs` utils from existing `src/utils/fs.js` for file I/O.

## Global Constraints

- TypeScript strict mode, ESM (`"type": "module"`), target ES2022, module NodeNext
- No new npm dependencies — use only `crypto`, `fs`, `path`, `readline`, TypeScript Compiler API (`typescript` devDependency is already in project)
- All modules are pure-library: no runtime environment setup, no filesystem writes without explicit projectPath parameter
- Storage path: `.ivy/provenance/` — fully independent from `.ivy/sessions/`
- Test framework: Vitest with `describe`/`it`/`expect` patterns matching existing `src/**/*.test.ts` conventions
- Downward compatible — no changes to existing `src/core/`, `src/commands/`, `src/cli/`, `src/utils/` modules
- Git Lineage interfaces defined but unimplemented in Phase 0

---

### Task 1: Core Types — `src/core/provenance/types.ts`

**Files:**
- Create: `src/core/provenance/types.ts`

**Interfaces:**
- Produces: `AIAction`, `Origin`, `CodeArtifact`, `OriginStatus`, `OriginEvent`, `OriginEventType`, `OriginProjection`, `EventQuery`, `EventStoreError`

- [x] **Step 1: Write the test file**

Create `src/core/provenance/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('Core Provenance Types', () => {
  it('AIAction type has required fields', () => {
    const action = {
      id: 'act_001',
      provider: 'claude-code',
      operation: 'GENERATE' as const,
      artifact: { path: 'src/index.ts' },
      metadata: { toolName: 'Write' },
    };
    expect(action.operation).toBe('GENERATE');
    expect(action.artifact.path).toBe('src/index.ts');
    expect(action.provider).toBe('claude-code');
  });

  it('Origin type has required fields', () => {
    const origin = {
      id: 'orig_001',
      createdAt: Date.now(),
      provider: 'claude-code',
      actions: [],
      artifacts: [],
      status: {
        aiLifecycle: 'CREATED' as const,
        gitLifecycle: 'NONE' as const,
        runtimeLifecycle: 'NONE' as const,
      },
    };
    expect(origin.status.aiLifecycle).toBe('CREATED');
    expect(origin.status.gitLifecycle).toBe('NONE');
    expect(origin.status.runtimeLifecycle).toBe('NONE');
  });

  it('OriginEvent type has required fields', () => {
    const event = {
      eventId: 'evt_001',
      type: 'origin_created' as const,
      originId: 'orig_001',
      timestamp: Date.now(),
      payload: {},
    };
    expect(event.type).toBe('origin_created');
    expect(event.originId).toBe('orig_001');
  });

  it('OriginProjection holds current state', () => {
    const projection = {
      origins: new Map(),
      lastEventId: 'evt_001',
      rebuiltAt: Date.now(),
    };
    expect(projection.origins.size).toBe(0);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/provenance/types.test.ts`
Expected: TypeScript compilation error (types not defined)

- [x] **Step 3: Write core types**

Create `src/core/provenance/types.ts`:

```typescript
export type AIOperation = 'GENERATE' | 'EDIT' | 'DELETE';

export type AILifecycleState = 'CREATED' | 'GENERATED' | 'ADOPTED' | 'MODIFIED' | 'ARCHIVED';

export type GitLifecycleState = 'NONE' | 'COMMITTED' | 'PR_CREATED' | 'MERGED';

export type RuntimeLifecycleState = 'NONE' | 'DEPLOYED' | 'STABLE' | 'FAILED' | 'ROLLED_BACK';

export type OriginEventType = 'origin_created' | 'lifecycle_changed' | 'artifact_added' | 'fingerprint_updated';

export interface AIAction {
  id: string;
  provider: string;
  operation: AIOperation;
  artifact: { path: string };
  metadata: Record<string, unknown>;
}

export interface CodeArtifact {
  filePath: string;
  fingerprint: string;
  git?: {
    commit?: string;
    branch?: string;
    pr?: string;
  };
}

export interface OriginStatus {
  aiLifecycle: AILifecycleState;
  gitLifecycle: GitLifecycleState;
  runtimeLifecycle: RuntimeLifecycleState;
}

export interface Origin {
  id: string;
  createdAt: number;
  provider: string;
  actions: AIAction[];
  artifacts: CodeArtifact[];
  status: OriginStatus;
}

export interface OriginEvent {
  eventId: string;
  type: OriginEventType;
  originId: string;
  timestamp: number;
  payload: Record<string, unknown>;
}

export interface OriginProjection {
  origins: Map<string, Origin>;
  lastEventId: string | null;
  rebuiltAt: number;
}

export interface EventQuery {
  originId?: string;
  eventTypes?: OriginEventType[];
  fromTimestamp?: number;
  toTimestamp?: number;
  provider?: string;
  limit?: number;
}

export class EventStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventStoreError';
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/provenance/types.test.ts`
Expected: All tests PASS

- [x] **Step 5: Commit**

```bash
git add src/core/provenance/types.ts src/core/provenance/types.test.ts
git commit -m "feat(provenance): add core provenance types (AIAction, Origin, OriginEvent, etc.)"
```

---

### Task 2: Provider Types — `src/providers/types.ts`

**Files:**
- Create: `src/providers/types.ts`

**Interfaces:**
- Consumes: `AIAction` from `src/core/provenance/types.ts`
- Produces: `IntermediateEvent`, `AIProviderAdapter`, `Normalizer`, `AIProviderGateway` (interface)

- [x] **Step 1: Write the test file**

Create `src/providers/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('Provider Types', () => {
  it('IntermediateEvent has required fields', () => {
    const event = {
      name: 'claude-code',
      operation: 'GENERATE' as const,
      rawEvent: { tool_name: 'Write', tool_input: { file_path: 'src/a.ts' } },
    };
    expect(event.name).toBe('claude-code');
    expect(event.operation).toBe('GENERATE');
  });

  it('IntermediateEvent operation supports EDIT and DELETE', () => {
    const events = [
      { name: 'test', operation: 'EDIT' as const, rawEvent: {} },
      { name: 'test', operation: 'DELETE' as const, rawEvent: {} },
    ];
    expect(events[0].operation).toBe('EDIT');
    expect(events[1].operation).toBe('DELETE');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/providers/types.test.ts`
Expected: TypeScript compilation error (module not found)

- [x] **Step 3: Write provider types**

Create `src/providers/types.ts`:

```typescript
import type { AIAction, AIOperation } from '../core/provenance/types.js';

export interface IntermediateEvent {
  name: string;
  operation: AIOperation;
  rawEvent: Record<string, unknown>;
}

export interface AIProviderAdapter {
  readonly name: string;
  adapt(rawEvent: Record<string, unknown>): IntermediateEvent | null;
}

export interface Normalizer {
  normalize(event: IntermediateEvent): AIAction;
}

export interface AIProviderGateway {
  register(adapter: AIProviderAdapter): void;
  process(rawEvent: Record<string, unknown>): AIAction | null;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/providers/types.test.ts`
Expected: All tests PASS

- [x] **Step 5: Commit**

```bash
git add src/providers/types.ts src/providers/types.test.ts
git commit -m "feat(providers): add AIProviderAdapter, Normalizer, AIProviderGateway interfaces"
```

---

### Task 3: Claude Code Adapter — `src/providers/claude-code.ts`

**Files:**
- Create: `src/providers/claude-code.ts`
- Create: `src/providers/claude-code.test.ts`

**Interfaces:**
- Consumes: `AIProviderAdapter`, `IntermediateEvent` from `src/providers/types.ts`, `AIOperation` from `src/core/provenance/types.ts`
- Produces: `ClaudeCodeAdapter` class implementing `AIProviderAdapter`

- [x] **Step 1: Write the test file**

Create `src/providers/claude-code.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ClaudeCodeAdapter } from './claude-code.js';

describe('ClaudeCodeAdapter', () => {
  const adapter = new ClaudeCodeAdapter();

  it('has name "claude-code"', () => {
    expect(adapter.name).toBe('claude-code');
  });

  it('adapts Write tool event to GENERATE', () => {
    const result = adapter.adapt({
      tool_name: 'Write',
      tool_input: { file_path: 'src/index.ts', content: 'hello' },
    });
    expect(result).not.toBeNull();
    expect(result!.operation).toBe('GENERATE');
    expect(result!.name).toBe('claude-code');
  });

  it('adapts Edit tool event to EDIT', () => {
    const result = adapter.adapt({
      tool_name: 'Edit',
      tool_input: { file_path: 'src/index.ts', old_string: 'a', new_string: 'b' },
    });
    expect(result).not.toBeNull();
    expect(result!.operation).toBe('EDIT');
  });

  it('adapts MultiEdit tool event to EDIT', () => {
    const result = adapter.adapt({
      tool_name: 'MultiEdit',
      tool_input: { file_path: 'src/index.ts', edits: [] },
    });
    expect(result).not.toBeNull();
    expect(result!.operation).toBe('EDIT');
  });

  it('adapts NotebookEdit tool event to EDIT', () => {
    const result = adapter.adapt({
      tool_name: 'NotebookEdit',
      tool_input: { file_path: 'src/notebook.ipynb' },
    });
    expect(result).not.toBeNull();
    expect(result!.operation).toBe('EDIT');
  });

  it('returns null for non-code tool events', () => {
    expect(adapter.adapt({ tool_name: 'Bash' })).toBeNull();
    expect(adapter.adapt({ tool_name: 'Read' })).toBeNull();
    expect(adapter.adapt({ tool_name: 'TodoWrite' })).toBeNull();
  });

  it('returns null for empty or missing tool_name', () => {
    expect(adapter.adapt({})).toBeNull();
    expect(adapter.adapt({ tool_name: '' })).toBeNull();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/providers/claude-code.test.ts`
Expected: FAIL (module not found)

- [x] **Step 3: Write ClaudeCodeAdapter**

Create `src/providers/claude-code.ts`:

```typescript
import type { AIProviderAdapter, IntermediateEvent } from './types.js';
import type { AIOperation } from '../core/provenance/types.js';

const CODE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

const TOOL_OPERATION_MAP: Record<string, AIOperation> = {
  Write: 'GENERATE',
  Edit: 'EDIT',
  MultiEdit: 'EDIT',
  NotebookEdit: 'EDIT',
};

export class ClaudeCodeAdapter implements AIProviderAdapter {
  readonly name = 'claude-code';

  adapt(rawEvent: Record<string, unknown>): IntermediateEvent | null {
    const toolName = typeof rawEvent.tool_name === 'string' ? rawEvent.tool_name : '';
    if (!toolName || !CODE_TOOLS.has(toolName)) {
      return null;
    }

    const operation = TOOL_OPERATION_MAP[toolName];
    if (!operation) {
      return null;
    }

    return {
      name: this.name,
      operation,
      rawEvent,
    };
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/providers/claude-code.test.ts`
Expected: All tests PASS

- [x] **Step 5: Commit**

```bash
git add src/providers/claude-code.ts src/providers/claude-code.test.ts
git commit -m "feat(providers): add ClaudeCodeAdapter with Write/Edit/MultiEdit/NotebookEdit support"
```

---

### Task 4: Provider Normalizer — `src/providers/normalizer.ts`

**Files:**
- Create: `src/providers/normalizer.ts`
- Create: `src/providers/normalizer.test.ts`

**Interfaces:**
- Consumes: `Normalizer` from `src/providers/types.ts`, `AIAction`, `AIOperation` from `src/core/provenance/types.ts`, `IntermediateEvent` from `src/providers/types.ts`
- Produces: `ProviderNormalizer` class implementing `Normalizer`

- [x] **Step 1: Write the test file**

Create `src/providers/normalizer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ProviderNormalizer } from './normalizer.js';

describe('ProviderNormalizer', () => {
  const normalizer = new ProviderNormalizer();

  it('normalizes a Claude Code intermediate event to AIAction', () => {
    const action = normalizer.normalize({
      name: 'claude-code',
      operation: 'GENERATE',
      rawEvent: {
        tool_name: 'Write',
        tool_input: { file_path: 'src/index.ts', content: 'hello' },
      },
    });
    expect(action.id).toMatch(/^act_/);
    expect(action.provider).toBe('claude-code');
    expect(action.operation).toBe('GENERATE');
    expect(action.artifact.path).toBe('src/index.ts');
    expect(action.metadata.toolName).toBe('Write');
  });

  it('normalizes an Edit event to AIAction with EDIT operation', () => {
    const action = normalizer.normalize({
      name: 'claude-code',
      operation: 'EDIT',
      rawEvent: {
        tool_name: 'Edit',
        tool_input: { file_path: 'src/index.ts', old_string: 'a', new_string: 'b' },
      },
    });
    expect(action.operation).toBe('EDIT');
    expect(action.artifact.path).toBe('src/index.ts');
  });

  it('generates unique IDs for each call', () => {
    const event = { name: 'test', operation: 'GENERATE' as const, rawEvent: { tool_input: { file_path: 'a.ts' } } };
    const a1 = normalizer.normalize(event);
    const a2 = normalizer.normalize(event);
    expect(a1.id).not.toBe(a2.id);
  });

  it('falls back to unknown path when file_path is missing', () => {
    const action = normalizer.normalize({
      name: 'unknown-provider',
      operation: 'GENERATE',
      rawEvent: {},
    });
    expect(action.artifact.path).toBe('unknown');
  });

  it('marks confidence as low for unrecognized provider', () => {
    const action = normalizer.normalize({
      name: 'unknown-provider',
      operation: 'GENERATE',
      rawEvent: {},
    });
    expect(action.metadata.confidence).toBe('low');
  });

  it('marks confidence as high for recognized providers', () => {
    const action = normalizer.normalize({
      name: 'claude-code',
      operation: 'GENERATE',
      rawEvent: { tool_name: 'Write', tool_input: { file_path: 'a.ts' } },
    });
    expect(action.metadata.confidence).toBe('high');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/providers/normalizer.test.ts`
Expected: FAIL (module not found)

- [x] **Step 3: Write ProviderNormalizer**

Create `src/providers/normalizer.ts`:

```typescript
import { randomBytes } from 'crypto';
import type { Normalizer, IntermediateEvent } from './types.js';
import type { AIAction } from '../core/provenance/types.js';

const KNOWN_PROVIDERS = new Set(['claude-code', 'cursor', 'codex', 'codebuddy']);

function extractFilePath(rawEvent: Record<string, unknown>): string {
  const toolInput = rawEvent.tool_input as Record<string, unknown> | undefined;
  if (toolInput && typeof toolInput.file_path === 'string') {
    return toolInput.file_path;
  }
  return 'unknown';
}

function generateActionId(): string {
  return 'act_' + randomBytes(8).toString('hex');
}

export class ProviderNormalizer implements Normalizer {
  normalize(event: IntermediateEvent): AIAction {
    const filePath = extractFilePath(event.rawEvent);
    const confidence = KNOWN_PROVIDERS.has(event.name) ? 'high' : 'low';

    return {
      id: generateActionId(),
      provider: event.name,
      operation: event.operation,
      artifact: { path: filePath },
      metadata: {
        toolName: (event.rawEvent as Record<string, unknown>).tool_name ?? 'unknown',
        confidence,
      },
    };
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/providers/normalizer.test.ts`
Expected: All tests PASS

- [x] **Step 5: Commit**

```bash
git add src/providers/normalizer.ts src/providers/normalizer.test.ts
git commit -m "feat(providers): add ProviderNormalizer with confidence-based normalization"
```

---

### Task 5: AIProviderGateway — `src/providers/gateway.ts`

**Files:**
- Create: `src/providers/gateway.ts`
- Create: `src/providers/gateway.test.ts`

**Interfaces:**
- Consumes: `AIProviderGateway`, `AIProviderAdapter`, `IntermediateEvent` from `src/providers/types.ts`, `AIAction` from `src/core/provenance/types.ts`, `ProviderNormalizer` from `src/providers/normalizer.ts`
- Produces: `DefaultAIProviderGateway` class implementing `AIProviderGateway`

- [x] **Step 1: Write the test file**

Create `src/providers/gateway.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { DefaultAIProviderGateway } from './gateway.js';
import { ClaudeCodeAdapter } from './claude-code.js';
import type { AIProviderAdapter, IntermediateEvent } from './types.js';

describe('DefaultAIProviderGateway', () => {
  it('returns null when no adapter matches', () => {
    const gateway = new DefaultAIProviderGateway();
    const result = gateway.process({ tool_name: 'UnknownTool' });
    expect(result).toBeNull();
  });

  it('processes Claude Code Write event through full pipeline', () => {
    const gateway = new DefaultAIProviderGateway();
    gateway.register(new ClaudeCodeAdapter());

    const result = gateway.process({
      tool_name: 'Write',
      tool_input: { file_path: 'src/hello.ts', content: 'console.log("hi");' },
    });

    expect(result).not.toBeNull();
    expect(result!.provider).toBe('claude-code');
    expect(result!.operation).toBe('GENERATE');
    expect(result!.artifact.path).toBe('src/hello.ts');
    expect(result!.id).toMatch(/^act_/);
  });

  it('processes Claude Code Edit event', () => {
    const gateway = new DefaultAIProviderGateway();
    gateway.register(new ClaudeCodeAdapter());

    const result = gateway.process({
      tool_name: 'Edit',
      tool_input: { file_path: 'src/hello.ts' },
    });

    expect(result).not.toBeNull();
    expect(result!.operation).toBe('EDIT');
  });

  it('skips adapters that return null and falls through', () => {
    const gateway = new DefaultAIProviderGateway();
    const nullAdapter: AIProviderAdapter = {
      name: 'null-adapter',
      adapt: () => null,
    };
    gateway.register(nullAdapter);
    gateway.register(new ClaudeCodeAdapter());

    const result = gateway.process({
      tool_name: 'Write',
      tool_input: { file_path: 'src/test.ts' },
    });

    expect(result).not.toBeNull();
    expect(result!.provider).toBe('claude-code');
  });

  it('returns null when no adapters registered', () => {
    const gateway = new DefaultAIProviderGateway();
    expect(gateway.process({})).toBeNull();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/providers/gateway.test.ts`
Expected: FAIL (module not found)

- [x] **Step 3: Write DefaultAIProviderGateway**

Create `src/providers/gateway.ts`:

```typescript
import type { AIProviderGateway, AIProviderAdapter } from './types.js';
import type { AIAction } from '../core/provenance/types.js';
import { ProviderNormalizer } from './normalizer.js';

export class DefaultAIProviderGateway implements AIProviderGateway {
  private adapters: AIProviderAdapter[] = [];
  private normalizer = new ProviderNormalizer();

  register(adapter: AIProviderAdapter): void {
    this.adapters.push(adapter);
  }

  process(rawEvent: Record<string, unknown>): AIAction | null {
    for (const adapter of this.adapters) {
      const intermediate = adapter.adapt(rawEvent);
      if (intermediate) {
        return this.normalizer.normalize(intermediate);
      }
    }
    return null;
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/providers/gateway.test.ts`
Expected: All tests PASS

- [x] **Step 5: Commit**

```bash
git add src/providers/gateway.ts src/providers/gateway.test.ts
git commit -m "feat(providers): add DefaultAIProviderGateway with adapter registration and pipeline"
```

---

### Task 6: Generic Agent Adapter — `src/providers/generic-agent.ts`

**Files:**
- Create: `src/providers/generic-agent.ts`
- Create: `src/providers/generic-agent.test.ts`

**Interfaces:**
- Consumes: `AIProviderAdapter`, `IntermediateEvent` from `src/providers/types.ts`
- Produces: `GenericAgentAdapter` class implementing `AIProviderAdapter`

- [x] **Step 1: Write the test file**

Create `src/providers/generic-agent.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { GenericAgentAdapter } from './generic-agent.js';

describe('GenericAgentAdapter', () => {
  const adapter = new GenericAgentAdapter();

  it('has name "generic-agent"', () => {
    expect(adapter.name).toBe('generic-agent');
  });

  it('adapts event with file_path to GENERATE', () => {
    const result = adapter.adapt({
      provider: 'unknown-ai-tool',
      file_path: 'src/hello.ts',
      content: 'console.log("hi");',
    });
    expect(result).not.toBeNull();
    expect(result!.operation).toBe('GENERATE');
    expect(result!.name).toBe('generic-agent');
    expect((result!.rawEvent as Record<string, unknown>).file_path).toBe('src/hello.ts');
  });

  it('adapts event with path field', () => {
    const result = adapter.adapt({
      provider: 'unknown-ai-tool',
      path: 'src/foo.ts',
    });
    expect(result).not.toBeNull();
    expect(result!.operation).toBe('GENERATE');
  });

  it('adapts event with target_file field', () => {
    const result = adapter.adapt({
      provider: 'unknown-ai-tool',
      target_file: 'src/bar.ts',
    });
    expect(result).not.toBeNull();
    expect(result!.operation).toBe('GENERATE');
  });

  it('returns null for events without any file path field', () => {
    expect(adapter.adapt({ provider: 'unknown', text: 'hello' })).toBeNull();
  });

  it('returns null for empty object', () => {
    expect(adapter.adapt({})).toBeNull();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/providers/generic-agent.test.ts`
Expected: FAIL (module not found)

- [x] **Step 3: Write GenericAgentAdapter**

Create `src/providers/generic-agent.ts`:

```typescript
import type { AIProviderAdapter, IntermediateEvent } from './types.js';

const FILE_PATH_KEYS = ['file_path', 'path', 'target_file'];

export class GenericAgentAdapter implements AIProviderAdapter {
  readonly name = 'generic-agent';

  adapt(rawEvent: Record<string, unknown>): IntermediateEvent | null {
    for (const key of FILE_PATH_KEYS) {
      if (typeof rawEvent[key] === 'string' && rawEvent[key] !== '') {
        return {
          name: this.name,
          operation: 'GENERATE',
          rawEvent,
        };
      }
    }
    return null;
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/providers/generic-agent.test.ts`
Expected: All tests PASS

- [x] **Step 5: Commit**

```bash
git add src/providers/generic-agent.ts src/providers/generic-agent.test.ts
git commit -m "feat(providers): add GenericAgentAdapter as fallback for unknown AI tools"
```

---

### Task 7: Event Store Interface — `src/core/provenance/event-store.ts`

**Files:**
- Create: `src/core/provenance/event-store.ts`

**Interfaces:**
- Consumes: `OriginEvent`, `OriginEventType`, `OriginProjection`, `EventQuery`, `EventStoreError` from `src/core/provenance/types.ts`
- Produces: `OriginEventStore` abstract interface

- [x] **Step 1: Write the test file**

Create `src/core/provenance/event-store.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { OriginEventStore } from './event-store.js';

describe('OriginEventStore interface', () => {
  it('defines the required methods (type-level check)', () => {
    const methods: (keyof OriginEventStore)[] = [
      'append',
      'query',
      'stream',
      'rebuildProjection',
      'getProjection',
    ];
    expect(methods.length).toBe(5);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/provenance/event-store.test.ts`
Expected: FAIL (module not found)

- [x] **Step 3: Write OriginEventStore interface**

Create `src/core/provenance/event-store.ts`:

```typescript
import type { OriginEvent, OriginProjection, EventQuery } from './types.js';

export interface OriginEventStore {
  append(event: OriginEvent): Promise<void>;
  query(filter: EventQuery): Promise<OriginEvent[]>;
  stream(fromEventId?: string): AsyncGenerator<OriginEvent>;
  rebuildProjection(): Promise<OriginProjection>;
  getProjection(): Promise<OriginProjection>;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/provenance/event-store.test.ts`
Expected: All tests PASS

- [x] **Step 5: Commit**

```bash
git add src/core/provenance/event-store.ts src/core/provenance/event-store.test.ts
git commit -m "feat(provenance): add OriginEventStore abstract interface"
```

---

### Task 8: JSONL Event Store — `src/core/provenance/event-store-jsonl.ts`

**Files:**
- Create: `src/core/provenance/event-store-jsonl.ts`
- Create: `src/core/provenance/event-store-jsonl.test.ts`

**Interfaces:**
- Consumes: `OriginEventStore` from `src/core/provenance/event-store.ts`, `OriginEvent`, `OriginEventType`, `OriginProjection`, `EventQuery`, `Origin` from `src/core/provenance/types.ts`, `ensureDir`, `fileExists`, `writeFile`, `readFile` from `src/utils/fs.js`
- Produces: `JSONLEventStore` class implementing `OriginEventStore`

- [x] **Step 1: Write the test file**

Create `src/core/provenance/event-store-jsonl.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { JSONLEventStore } from './event-store-jsonl.js';

async function tmpProject(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-prov-'));
}

describe('JSONLEventStore', () => {
  let projectPath: string;
  let store: JSONLEventStore;

  beforeEach(async () => {
    projectPath = await tmpProject();
    store = new JSONLEventStore(projectPath);
  });

  afterEach(async () => {
    await fs.rm(projectPath, { recursive: true, force: true });
  });

  it('appends an event to events.jsonl', async () => {
    const event = {
      eventId: 'evt_001',
      type: 'origin_created' as const,
      originId: 'orig_001',
      timestamp: Date.now(),
      payload: {},
    };
    await store.append(event);

    const events = await store.query({});
    expect(events.length).toBe(1);
    expect(events[0].eventId).toBe('evt_001');
    expect(events[0].type).toBe('origin_created');
  });

  it('query filters by event type', async () => {
    await store.append({
      eventId: 'evt_001',
      type: 'origin_created',
      originId: 'orig_001',
      timestamp: Date.now(),
      payload: {},
    });
    await store.append({
      eventId: 'evt_002',
      type: 'lifecycle_changed',
      originId: 'orig_001',
      timestamp: Date.now(),
      payload: {},
    });

    const result = await store.query({ eventTypes: ['origin_created'] });
    expect(result.length).toBe(1);
    expect(result[0].type).toBe('origin_created');
  });

  it('query respects limit', async () => {
    for (let i = 0; i < 5; i++) {
      await store.append({
        eventId: `evt_00${i}`,
        type: 'origin_created',
        originId: `orig_00${i}`,
        timestamp: Date.now(),
        payload: {},
      });
    }
    const result = await store.query({ limit: 3 });
    expect(result.length).toBe(3);
  });

  it('query filters by originId', async () => {
    await store.append({
      eventId: 'evt_001',
      type: 'origin_created',
      originId: 'orig_a',
      timestamp: Date.now(),
      payload: {},
    });
    await store.append({
      eventId: 'evt_002',
      type: 'origin_created',
      originId: 'orig_b',
      timestamp: Date.now(),
      payload: {},
    });

    const result = await store.query({ originId: 'orig_a' });
    expect(result.length).toBe(1);
    expect(result[0].originId).toBe('orig_a');
  });

  it('stream yields all events in order', async () => {
    await store.append({
      eventId: 'evt_001',
      type: 'origin_created',
      originId: 'orig_001',
      timestamp: 1000,
      payload: {},
    });
    await store.append({
      eventId: 'evt_002',
      type: 'lifecycle_changed',
      originId: 'orig_001',
      timestamp: 2000,
      payload: {},
    });

    const events: string[] = [];
    for await (const event of store.stream()) {
      events.push(event.eventId);
    }
    expect(events).toEqual(['evt_001', 'evt_002']);
  });

  it('stream starts from given eventId', async () => {
    await store.append({
      eventId: 'evt_001',
      type: 'origin_created',
      originId: 'orig_001',
      timestamp: 1000,
      payload: {},
    });
    await store.append({
      eventId: 'evt_002',
      type: 'lifecycle_changed',
      originId: 'orig_001',
      timestamp: 2000,
      payload: {},
    });

    const events: string[] = [];
    for await (const event of store.stream('evt_002')) {
      events.push(event.eventId);
    }
    expect(events).toEqual(['evt_002']);
  });

  it('rebuildProjection creates projection file', async () => {
    await store.append({
      eventId: 'evt_001',
      type: 'origin_created',
      originId: 'orig_001',
      timestamp: Date.now(),
      payload: {},
    });

    const projection = await store.rebuildProjection();
    expect(projection.lastEventId).toBe('evt_001');

    const projectionPath = path.join(projectPath, '.ivy', 'provenance', 'projections', 'current-state.json');
    const stat = await fs.stat(projectionPath);
    expect(stat.isFile()).toBe(true);
  });

  it('getProjection returns cached projection after rebuild', async () => {
    await store.append({
      eventId: 'evt_001',
      type: 'origin_created',
      originId: 'orig_001',
      timestamp: Date.now(),
      payload: {},
    });

    await store.rebuildProjection();
    const projection = await store.getProjection();
    expect(projection.lastEventId).toBe('evt_001');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/provenance/event-store-jsonl.test.ts`
Expected: FAIL (module not found)

- [x] **Step 3: Write JSONLEventStore**

Create `src/core/provenance/event-store-jsonl.ts`:

```typescript
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import path from 'path';
import { ensureDir, fileExists, writeFile, readFile } from '../../utils/fs.js';
import type { OriginEventStore } from './event-store.js';
import type { OriginEvent, OriginEventType, OriginProjection, EventQuery } from './types.js';

export class JSONLEventStore implements OriginEventStore {
  private projectPath: string;
  private projectionCache: OriginProjection | null = null;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  private get eventsPath(): string {
    return path.join(this.projectPath, '.ivy', 'provenance', 'events.jsonl');
  }

  private get projectionPath(): string {
    return path.join(this.projectPath, '.ivy', 'provenance', 'projections', 'current-state.json');
  }

  async append(event: OriginEvent): Promise<void> {
    await ensureDir(path.dirname(this.eventsPath));
    await writeFile(this.eventsPath, JSON.stringify(event) + '\n', { flag: 'a' });
    this.projectionCache = null;
  }

  async query(filter: EventQuery): Promise<OriginEvent[]> {
    const results: OriginEvent[] = [];
    const { originId, eventTypes, fromTimestamp, toTimestamp, limit } = filter;

    for await (const event of this.stream()) {
      if (originId && event.originId !== originId) continue;
      if (eventTypes && !eventTypes.includes(event.type)) continue;
      if (fromTimestamp !== undefined && event.timestamp < fromTimestamp) continue;
      if (toTimestamp !== undefined && event.timestamp > toTimestamp) continue;

      results.push(event);
      if (limit !== undefined && results.length >= limit) break;
    }

    return results;
  }

  async *stream(fromEventId?: string): AsyncGenerator<OriginEvent> {
    if (!(await fileExists(this.eventsPath))) return;

    let foundFrom = fromEventId === undefined;
    const rl = createInterface({ input: createReadStream(this.eventsPath), crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as OriginEvent;
        if (!foundFrom) {
          if (parsed.eventId === fromEventId) {
            foundFrom = true;
            yield parsed;
          }
          continue;
        }
        yield parsed;
      } catch {
        // skip corrupted lines
      }
    }
  }

  async rebuildProjection(): Promise<OriginProjection> {
    const origins = new Map<string, any>();
    let lastEventId: string | null = null;

    for await (const event of this.stream()) {
      lastEventId = event.eventId;
    }

    const projection: OriginProjection = {
      origins,
      lastEventId,
      rebuiltAt: Date.now(),
    };

    await ensureDir(path.dirname(this.projectionPath));
    await writeFile(this.projectionPath, JSON.stringify({
      lastEventId: projection.lastEventId,
      rebuiltAt: projection.rebuiltAt,
    }, null, 2));

    this.projectionCache = projection;
    return projection;
  }

  async getProjection(): Promise<OriginProjection> {
    if (this.projectionCache) {
      return this.projectionCache;
    }
    return this.rebuildProjection();
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/provenance/event-store-jsonl.test.ts`
Expected: All tests PASS

- [x] **Step 5: Commit**

```bash
git add src/core/provenance/event-store-jsonl.ts src/core/provenance/event-store-jsonl.test.ts
git commit -m "feat(provenance): add JSONLEventStore with append, query, stream, and projection"
```

---

### Task 9: Origin Entity Model — `src/core/provenance/origin.ts`

**Files:**
- Create: `src/core/provenance/origin.ts`
- Create: `src/core/provenance/origin.test.ts`

**Interfaces:**
- Consumes: `Origin`, `OriginStatus`, `AIAction`, `CodeArtifact`, `AILifecycleState`, `GitLifecycleState`, `RuntimeLifecycleState` from `src/core/provenance/types.ts`
- Produces: `createOrigin()`, `addAction()`, `addArtifact()`, `getStatus()`, `generateOriginId()`

- [x] **Step 1: Write the test file**

Create `src/core/provenance/origin.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createOrigin, addAction, addArtifact, getStatus, generateOriginId } from './origin.js';
import type { AIAction, CodeArtifact } from './types.js';

describe('Origin Entity', () => {
  it('generateOriginId produces prefixed hex string', () => {
    const id = generateOriginId();
    expect(id).toMatch(/^orig_[0-9a-f]{16}$/);
  });

  it('generateOriginId produces unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateOriginId()));
    expect(ids.size).toBe(100);
  });

  it('createOrigin returns a new Origin with CREATED status', () => {
    const origin = createOrigin('claude-code');
    expect(origin.id).toMatch(/^orig_/);
    expect(origin.provider).toBe('claude-code');
    expect(origin.createdAt).toBeGreaterThan(0);
    expect(origin.actions).toEqual([]);
    expect(origin.artifacts).toEqual([]);
    expect(origin.status.aiLifecycle).toBe('CREATED');
    expect(origin.status.gitLifecycle).toBe('NONE');
    expect(origin.status.runtimeLifecycle).toBe('NONE');
  });

  it('addAction appends an AIAction to the origin', () => {
    const origin = createOrigin('claude-code');
    const action: AIAction = {
      id: 'act_001',
      provider: 'claude-code',
      operation: 'GENERATE',
      artifact: { path: 'src/hello.ts' },
      metadata: {},
    };
    const updated = addAction(origin, action);
    expect(updated.actions.length).toBe(1);
    expect(updated.actions[0].id).toBe('act_001');
  });

  it('addAction does not mutate the original origin', () => {
    const origin = createOrigin('claude-code');
    addAction(origin, {
      id: 'act_001',
      provider: 'claude-code',
      operation: 'GENERATE',
      artifact: { path: 'src/hello.ts' },
      metadata: {},
    });
    expect(origin.actions.length).toBe(0);
  });

  it('addArtifact appends a CodeArtifact to the origin', () => {
    const origin = createOrigin('claude-code');
    const artifact: CodeArtifact = {
      filePath: 'src/hello.ts',
      fingerprint: 'abc123',
    };
    const updated = addArtifact(origin, artifact);
    expect(updated.artifacts.length).toBe(1);
    expect(updated.artifacts[0].filePath).toBe('src/hello.ts');
  });

  it('addArtifact does not mutate the original origin', () => {
    const origin = createOrigin('claude-code');
    addArtifact(origin, {
      filePath: 'src/hello.ts',
      fingerprint: 'abc123',
    });
    expect(origin.artifacts.length).toBe(0);
  });

  it('getStatus returns current OriginStatus', () => {
    const origin = createOrigin('claude-code');
    const status = getStatus(origin);
    expect(status.aiLifecycle).toBe('CREATED');
    expect(status.gitLifecycle).toBe('NONE');
    expect(status.runtimeLifecycle).toBe('NONE');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/provenance/origin.test.ts`
Expected: FAIL (module not found)

- [x] **Step 3: Write Origin Entity model**

Create `src/core/provenance/origin.ts`:

```typescript
import { randomBytes } from 'crypto';
import type { Origin, OriginStatus, AIAction, CodeArtifact } from './types.js';

export function generateOriginId(): string {
  return 'orig_' + randomBytes(8).toString('hex');
}

export function createOrigin(provider: string): Origin {
  return {
    id: generateOriginId(),
    createdAt: Date.now(),
    provider,
    actions: [],
    artifacts: [],
    status: {
      aiLifecycle: 'CREATED',
      gitLifecycle: 'NONE',
      runtimeLifecycle: 'NONE',
    },
  };
}

export function addAction(origin: Origin, action: AIAction): Origin {
  return {
    ...origin,
    actions: [...origin.actions, action],
  };
}

export function addArtifact(origin: Origin, artifact: CodeArtifact): Origin {
  return {
    ...origin,
    artifacts: [...origin.artifacts, artifact],
  };
}

export function getStatus(origin: Origin): OriginStatus {
  return { ...origin.status };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/provenance/origin.test.ts`
Expected: All tests PASS

- [x] **Step 5: Commit**

```bash
git add src/core/provenance/origin.ts src/core/provenance/origin.test.ts
git commit -m "feat(provenance): add Origin Entity model (create, addAction, addArtifact, getStatus)"
```

---

### Task 10: Three-Dimensional Lifecycle — `src/core/provenance/lifecycle.ts`

**Files:**
- Create: `src/core/provenance/lifecycle.ts`
- Create: `src/core/provenance/lifecycle.test.ts`

**Interfaces:**
- Consumes: `Origin`, `OriginStatus`, `AILifecycleState`, `GitLifecycleState`, `RuntimeLifecycleState` from `src/core/provenance/types.ts`
- Produces: `transitionAILifecycle()`, `transitionGitLifecycle()`, `transitionRuntimeLifecycle()`

- [x] **Step 1: Write the test file**

Create `src/core/provenance/lifecycle.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { transitionAILifecycle, transitionGitLifecycle, transitionRuntimeLifecycle } from './lifecycle.js';
import { createOrigin } from './origin.js';
import type { Origin } from './types.js';

describe('Lifecycle Transitions', () => {
  describe('AI Lifecycle', () => {
    let origin: Origin;
    beforeEach(() => {
      origin = createOrigin('claude-code');
    });

    it('CREATED → GENERATED is valid', () => {
      const updated = transitionAILifecycle(origin, 'GENERATED');
      expect(updated.status.aiLifecycle).toBe('GENERATED');
    });

    it('GENERATED → ADOPTED is valid', () => {
      const updated = transitionAILifecycle(
        { ...origin, status: { ...origin.status, aiLifecycle: 'GENERATED' } },
        'ADOPTED',
      );
      expect(updated.status.aiLifecycle).toBe('ADOPTED');
    });

    it('ADOPTED → MODIFIED is valid', () => {
      const updated = transitionAILifecycle(
        { ...origin, status: { ...origin.status, aiLifecycle: 'ADOPTED' } },
        'MODIFIED',
      );
      expect(updated.status.aiLifecycle).toBe('MODIFIED');
    });

    it('MODIFIED → ARCHIVED is valid', () => {
      const updated = transitionAILifecycle(
        { ...origin, status: { ...origin.status, aiLifecycle: 'MODIFIED' } },
        'ARCHIVED',
      );
      expect(updated.status.aiLifecycle).toBe('ARCHIVED');
    });

    it('ADOPTED → CREATED is invalid (backward transition)', () => {
      expect(() =>
        transitionAILifecycle(
          { ...origin, status: { ...origin.status, aiLifecycle: 'ADOPTED' } },
          'CREATED',
        ),
      ).toThrow(/invalid/i);
    });

    it('same-state transition is allowed', () => {
      const updated = transitionAILifecycle(origin, 'CREATED');
      expect(updated.status.aiLifecycle).toBe('CREATED');
    });

    it('does not mutate original origin', () => {
      const updated = transitionAILifecycle(origin, 'GENERATED');
      expect(updated.status.aiLifecycle).toBe('GENERATED');
      expect(origin.status.aiLifecycle).toBe('CREATED');
    });
  });

  describe('Git Lifecycle', () => {
    let origin: Origin;
    beforeEach(() => {
      origin = createOrigin('claude-code');
    });

    it('NONE → COMMITTED is valid', () => {
      const updated = transitionGitLifecycle(origin, 'COMMITTED');
      expect(updated.status.gitLifecycle).toBe('COMMITTED');
    });

    it('COMMITTED → PR_CREATED is valid', () => {
      const updated = transitionGitLifecycle(
        { ...origin, status: { ...origin.status, gitLifecycle: 'COMMITTED' } },
        'PR_CREATED',
      );
      expect(updated.status.gitLifecycle).toBe('PR_CREATED');
    });

    it('PR_CREATED → MERGED is valid', () => {
      const updated = transitionGitLifecycle(
        { ...origin, status: { ...origin.status, gitLifecycle: 'PR_CREATED' } },
        'MERGED',
      );
      expect(updated.status.gitLifecycle).toBe('MERGED');
    });

    it('NONE → MERGED is invalid (skip states)', () => {
      expect(() => transitionGitLifecycle(origin, 'MERGED')).toThrow(/invalid/i);
    });

    it('independent from AI lifecycle', () => {
      const withAI = transitionAILifecycle(origin, 'GENERATED');
      const withGit = transitionGitLifecycle(withAI, 'COMMITTED');
      expect(withGit.status.aiLifecycle).toBe('GENERATED');
      expect(withGit.status.gitLifecycle).toBe('COMMITTED');
    });
  });

  describe('Runtime Lifecycle', () => {
    let origin: Origin;
    beforeEach(() => {
      origin = createOrigin('claude-code');
    });

    it('NONE → DEPLOYED is valid', () => {
      const updated = transitionRuntimeLifecycle(origin, 'DEPLOYED');
      expect(updated.status.runtimeLifecycle).toBe('DEPLOYED');
    });

    it('DEPLOYED → STABLE is valid', () => {
      const updated = transitionRuntimeLifecycle(
        { ...origin, status: { ...origin.status, runtimeLifecycle: 'DEPLOYED' } },
        'STABLE',
      );
      expect(updated.status.runtimeLifecycle).toBe('STABLE');
    });

    it('DEPLOYED → FAILED is valid', () => {
      const updated = transitionRuntimeLifecycle(
        { ...origin, status: { ...origin.status, runtimeLifecycle: 'DEPLOYED' } },
        'FAILED',
      );
      expect(updated.status.runtimeLifecycle).toBe('FAILED');
    });

    it('STABLE → FAILED is valid', () => {
      const updated = transitionRuntimeLifecycle(
        { ...origin, status: { ...origin.status, runtimeLifecycle: 'STABLE' } },
        'FAILED',
      );
      expect(updated.status.runtimeLifecycle).toBe('FAILED');
    });

    it('FAILED → ROLLED_BACK is valid', () => {
      const updated = transitionRuntimeLifecycle(
        { ...origin, status: { ...origin.status, runtimeLifecycle: 'FAILED' } },
        'ROLLED_BACK',
      );
      expect(updated.status.runtimeLifecycle).toBe('ROLLED_BACK');
    });

    it('NONE → STABLE is invalid (skip states)', () => {
      expect(() => transitionRuntimeLifecycle(origin, 'STABLE')).toThrow(/invalid/i);
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/provenance/lifecycle.test.ts`
Expected: FAIL (module not found)

- [x] **Step 3: Write lifecycle transitions**

Create `src/core/provenance/lifecycle.ts`:

```typescript
import type { Origin, AILifecycleState, GitLifecycleState, RuntimeLifecycleState } from './types.js';

const AI_TRANSITIONS: Record<AILifecycleState, AILifecycleState[]> = {
  CREATED: ['CREATED', 'GENERATED'],
  GENERATED: ['GENERATED', 'ADOPTED'],
  ADOPTED: ['ADOPTED', 'MODIFIED'],
  MODIFIED: ['MODIFIED', 'ARCHIVED'],
  ARCHIVED: ['ARCHIVED'],
};

const GIT_TRANSITIONS: Record<GitLifecycleState, GitLifecycleState[]> = {
  NONE: ['NONE', 'COMMITTED'],
  COMMITTED: ['COMMITTED', 'PR_CREATED'],
  PR_CREATED: ['PR_CREATED', 'MERGED'],
  MERGED: ['MERGED'],
};

const RUNTIME_TRANSITIONS: Record<RuntimeLifecycleState, RuntimeLifecycleState[]> = {
  NONE: ['NONE', 'DEPLOYED'],
  DEPLOYED: ['DEPLOYED', 'STABLE', 'FAILED'],
  STABLE: ['STABLE', 'FAILED'],
  FAILED: ['FAILED', 'ROLLED_BACK'],
  ROLLED_BACK: ['ROLLED_BACK'],
};

export function transitionAILifecycle(origin: Origin, target: AILifecycleState): Origin {
  const current = origin.status.aiLifecycle;
  if (!AI_TRANSITIONS[current].includes(target)) {
    throw new Error(`Invalid AI lifecycle transition: ${current} → ${target}`);
  }
  return {
    ...origin,
    status: { ...origin.status, aiLifecycle: target },
  };
}

export function transitionGitLifecycle(origin: Origin, target: GitLifecycleState): Origin {
  const current = origin.status.gitLifecycle;
  if (!GIT_TRANSITIONS[current].includes(target)) {
    throw new Error(`Invalid Git lifecycle transition: ${current} → ${target}`);
  }
  return {
    ...origin,
    status: { ...origin.status, gitLifecycle: target },
  };
}

export function transitionRuntimeLifecycle(origin: Origin, target: RuntimeLifecycleState): Origin {
  const current = origin.status.runtimeLifecycle;
  if (!RUNTIME_TRANSITIONS[current].includes(target)) {
    throw new Error(`Invalid Runtime lifecycle transition: ${current} → ${target}`);
  }
  return {
    ...origin,
    status: { ...origin.status, runtimeLifecycle: target },
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/provenance/lifecycle.test.ts`
Expected: All tests PASS

- [x] **Step 5: Commit**

```bash
git add src/core/provenance/lifecycle.ts src/core/provenance/lifecycle.test.ts
git commit -m "feat(provenance): add three-dimensional lifecycle with independent state transitions"
```

---

### Task 11: Git Lineage Interface — `src/core/provenance/git-lineage.ts`

**Files:**
- Create: `src/core/provenance/git-lineage.ts`
- Create: `src/core/provenance/git-lineage.test.ts`

**Interfaces:**
- Consumes: `CodeArtifact` from `src/core/provenance/types.ts`
- Produces: `GitLineageResolver` interface, `NoopGitLineageResolver` class (Phase 0: returns undefined git)

- [x] **Step 1: Write the test file**

Create `src/core/provenance/git-lineage.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { NoopGitLineageResolver } from './git-lineage.js';
import type { CodeArtifact } from './types.js';

describe('GitLineageResolver', () => {
  const resolver = new NoopGitLineageResolver();

  it('resolve returns artifact with undefined git', async () => {
    const artifact: CodeArtifact = {
      filePath: 'src/hello.ts',
      fingerprint: 'abc123',
    };
    const result = await resolver.resolve(artifact);
    expect(result.git).toBeUndefined();
  });

  it('resolve preserves filePath and fingerprint', async () => {
    const artifact: CodeArtifact = {
      filePath: 'src/hello.ts',
      fingerprint: 'abc123',
    };
    const result = await resolver.resolve(artifact);
    expect(result.filePath).toBe('src/hello.ts');
    expect(result.fingerprint).toBe('abc123');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/provenance/git-lineage.test.ts`
Expected: FAIL (module not found)

- [x] **Step 3: Write Git Lineage interface + noop resolver**

Create `src/core/provenance/git-lineage.ts`:

```typescript
import type { CodeArtifact } from './types.js';

export interface GitLineageResolver {
  resolve(artifact: CodeArtifact): Promise<CodeArtifact>;
}

export class NoopGitLineageResolver implements GitLineageResolver {
  async resolve(artifact: CodeArtifact): Promise<CodeArtifact> {
    return { ...artifact };
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/provenance/git-lineage.test.ts`
Expected: All tests PASS

- [x] **Step 5: Commit**

```bash
git add src/core/provenance/git-lineage.ts src/core/provenance/git-lineage.test.ts
git commit -m "feat(provenance): add GitLineageResolver interface and NoopGitLineageResolver (Phase 0)"
```

---

### Task 12: Code Fingerprint — `src/core/provenance/fingerprint.ts`

**Files:**
- Create: `src/core/provenance/fingerprint.ts`
- Create: `src/core/provenance/fingerprint.test.ts`

**Interfaces:**
- Consumes: `typescript` (devDependency for Compiler API), Node.js `crypto`
- Produces: `computeL0Fingerprint()`, `computeL1aStructuralFingerprint()`, `computeL1bSemanticLiteFingerprint()`, `computeSemanticFingerprint()`, `computeLineageFingerprint()`, `detectLanguage()`, `computeCodeFingerprint()`, `CodeFingerprint`, `LanguageProfile`

- [x] **Step 1: Write the test file**

Create `src/core/provenance/fingerprint.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  computeL0Fingerprint,
  computeL1aStructuralFingerprint,
  computeL1bSemanticLiteFingerprint,
  computeSemanticFingerprint,
  computeLineageFingerprint,
  detectLanguage,
  computeCodeFingerprint,
} from './fingerprint.js';

describe('Code Fingerprint', () => {
  describe('L0 File Hash', () => {
    it('same content produces same hash', () => {
      const h1 = computeL0Fingerprint('hello world');
      const h2 = computeL0Fingerprint('hello world');
      expect(h1).toBe(h2);
    });

    it('different content produces different hash', () => {
      const h1 = computeL0Fingerprint('hello');
      const h2 = computeL0Fingerprint('world');
      expect(h1).not.toBe(h2);
    });

    it('returns 64-char hex string', () => {
      const hash = computeL0Fingerprint('test');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('L1a Structural Hash', () => {
    it('same logic different variable names produce same hash', () => {
      const code1 = 'function add(a, b) { return a + b; }';
      const code2 = 'function sum(x, y) { return x + y; }';
      const h1 = computeL1aStructuralFingerprint(code1, 'test.ts');
      const h2 = computeL1aStructuralFingerprint(code2, 'test.ts');
      expect(h1).toBe(h2);
    });

    it('different control flow produces different hash', () => {
      const code1 = 'function f() { if (true) { return 1; } return 2; }';
      const code2 = 'function f() { return 1; }';
      const h1 = computeL1aStructuralFingerprint(code1, 'test.ts');
      const h2 = computeL1aStructuralFingerprint(code2, 'test.ts');
      expect(h1).not.toBe(h2);
    });

    it('returns null for non-TS/JS files', () => {
      expect(computeL1aStructuralFingerprint('print("hello")', 'test.py')).toBeNull();
      expect(computeL1aStructuralFingerprint('hello', 'test.txt')).toBeNull();
    });

    it('returns null for invalid TS syntax', () => {
      expect(computeL1aStructuralFingerprint('this is not valid typescript {{{', 'test.ts')).toBeNull();
    });
  });

  describe('L1b Semantic-lite Hash', () => {
    it('different API calls produce different hash', () => {
      const code1 = 'import { fetch } from "node"; fetch("/api");';
      const code2 = 'import axios from "axios"; axios.get("/api");';
      const h1 = computeL1bSemanticLiteFingerprint(code1, 'test.ts');
      const h2 = computeL1bSemanticLiteFingerprint(code2, 'test.ts');
      expect(h1).not.toBe(h2);
    });

    it('same API calls same hash even if variable names differ', () => {
      const code1 = 'import { fetch } from "node"; const data = await fetch("/api");';
      const code2 = 'import { fetch } from "node"; const result = await fetch("/api");';
      const h1 = computeL1bSemanticLiteFingerprint(code1, 'test.ts');
      const h2 = computeL1bSemanticLiteFingerprint(code2, 'test.ts');
      expect(h1).toBe(h2);
    });

    it('returns null for non-TS/JS files', () => {
      expect(computeL1bSemanticLiteFingerprint('print("hello")', 'test.py')).toBeNull();
    });

    it('returns null for invalid TS syntax', () => {
      expect(computeL1bSemanticLiteFingerprint('not valid {{{', 'test.ts')).toBeNull();
    });
  });

  describe('L2 Semantic (reserved)', () => {
    it('returns null', () => {
      expect(computeSemanticFingerprint('code', 'test.ts')).toBeNull();
    });
  });

  describe('L3 Lineage (reserved)', () => {
    it('returns null', () => {
      expect(computeLineageFingerprint('code', 'test.ts')).toBeNull();
    });
  });

  describe('LanguageProfile', () => {
    it('detects TypeScript', () => {
      expect(detectLanguage('file.ts')).toEqual({ language: 'typescript' });
      expect(detectLanguage('file.tsx')).toEqual({ language: 'typescript' });
    });

    it('detects JavaScript', () => {
      expect(detectLanguage('file.js')).toEqual({ language: 'javascript' });
      expect(detectLanguage('file.jsx')).toEqual({ language: 'javascript' });
    });

    it('detects Python', () => {
      expect(detectLanguage('file.py')).toEqual({ language: 'python' });
    });

    it('returns unknown for unsupported extensions', () => {
      expect(detectLanguage('file.txt')).toEqual({ language: 'unknown' });
      expect(detectLanguage('Makefile')).toEqual({ language: 'unknown' });
    });
  });

  describe('computeCodeFingerprint', () => {
    it('returns full fingerprint for TS file', () => {
      const result = computeCodeFingerprint('src/test.ts', 'const x = 1;');
      expect(result.l0).toMatch(/^[0-9a-f]{64}$/);
      expect(result.l1a).toMatch(/^[0-9a-f]{64}$/);
      expect(result.l1b).toMatch(/^[0-9a-f]{64}$/);
      expect(result.l2).toBeNull();
      expect(result.l3).toBeNull();
      expect(result.language.language).toBe('typescript');
    });

    it('returns minimal fingerprint for unknown file type', () => {
      const result = computeCodeFingerprint('README.md', '# Hello');
      expect(result.l0).toMatch(/^[0-9a-f]{64}$/);
      expect(result.l1a).toBeNull();
      expect(result.l1b).toBeNull();
      expect(result.l2).toBeNull();
      expect(result.l3).toBeNull();
      expect(result.language.language).toBe('unknown');
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/provenance/fingerprint.test.ts`
Expected: FAIL (module not found)

- [x] **Step 3: Write fingerprint module**

Create `src/core/provenance/fingerprint.ts`:

```typescript
import { createHash } from 'crypto';
import ts from 'typescript';

export interface LanguageProfile {
  language: string;
}

export interface CodeFingerprint {
  l0: string;
  l1a: string | null;
  l1b: string | null;
  l2: string | null;
  l3: string | null;
  language: LanguageProfile;
}

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);
const JS_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs']);

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.pyi': 'python',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.rb': 'ruby',
};

function isTSorJS(ext: string): boolean {
  return TS_EXTENSIONS.has(ext) || JS_EXTENSIONS.has(ext);
}

function getExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filePath.slice(lastDot);
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function normalizeIdentifiers(sourceFile: ts.SourceFile): string {
  const replacements: { start: number; end: number; replacement: string }[] = [];
  let idCounter = 0;
  const idMap = new Map<string, string>();

  function visitor(node: ts.Node): void {
    if (ts.isIdentifier(node)) {
      if (node.text === 'undefined') {
        ts.forEachChild(node, visitor);
        return;
      }
      const parent = node.parent;
      if (parent && (ts.isPropertyAccessExpression(parent) || ts.isMethodSignature(parent) || ts.isPropertySignature(parent))) {
        if (parent.name === node) {
          ts.forEachChild(node, visitor);
          return;
        }
      }
      if (!idMap.has(node.text)) {
        idMap.set(node.text, `id_${idCounter++}`);
      }
      replacements.push({ start: node.getStart(sourceFile), end: node.getEnd(), replacement: idMap.get(node.text)! });
    }
    ts.forEachChild(node, visitor);
  }

  visitor(sourceFile);

  replacements.sort((a, b) => b.start - a.start);

  let text = sourceFile.getFullText();
  for (const { start, end, replacement } of replacements) {
    text = text.slice(0, start) + replacement + text.slice(end);
  }
  return text;
}

function extractSemanticTokens(sourceFile: ts.SourceFile): string {
  const parts: string[] = [];

  function visitor(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      parts.push(node.getText(sourceFile));
      ts.forEachChild(node, visitor);
      return;
    }
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isIdentifier(expr)) {
        parts.push(expr.text);
      } else if (ts.isPropertyAccessExpression(expr)) {
        parts.push(expr.name.text);
      }
    }
    if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
      parts.push(node.text);
    }
    ts.forEachChild(node, visitor);
  }

  visitor(sourceFile);
  return parts.join('\n');
}

function parseSourceFile(code: string, filePath: string): ts.SourceFile | null {
  try {
    return ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);
  } catch {
    return null;
  }
}

export function computeL0Fingerprint(content: string): string {
  return sha256(content);
}

export function computeL1aStructuralFingerprint(content: string, filePath: string): string | null {
  const ext = getExtension(filePath);
  if (!isTSorJS(ext)) return null;

  const sourceFile = parseSourceFile(content, filePath);
  if (!sourceFile) return null;

  const normalized = normalizeIdentifiers(sourceFile);
  return sha256(normalized);
}

export function computeL1bSemanticLiteFingerprint(content: string, filePath: string): string | null {
  const ext = getExtension(filePath);
  if (!isTSorJS(ext)) return null;

  const sourceFile = parseSourceFile(content, filePath);
  if (!sourceFile) return null;

  const tokens = extractSemanticTokens(sourceFile);
  return sha256(tokens);
}

export function computeSemanticFingerprint(_content: string, _filePath: string): null {
  return null;
}

export function computeLineageFingerprint(_content: string, _filePath: string): null {
  return null;
}

export function detectLanguage(filePath: string): LanguageProfile {
  const ext = getExtension(filePath);
  const language = EXTENSION_LANGUAGE_MAP[ext] ?? 'unknown';
  return { language };
}

export function computeCodeFingerprint(filePath: string, content: string): CodeFingerprint {
  return {
    l0: computeL0Fingerprint(content),
    l1a: computeL1aStructuralFingerprint(content, filePath),
    l1b: computeL1bSemanticLiteFingerprint(content, filePath),
    l2: computeSemanticFingerprint(content, filePath),
    l3: computeLineageFingerprint(content, filePath),
    language: detectLanguage(filePath),
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/provenance/fingerprint.test.ts`
Expected: All tests PASS

- [x] **Step 5: Commit**

```bash
git add src/core/provenance/fingerprint.ts src/core/provenance/fingerprint.test.ts
git commit -m "feat(provenance): add code fingerprint (L0, L1a structural, L1b semantic-lite, LanguageProfile)"
```

---

### Task 13: Integration Verification

**Files:**
- Modify: none (verification only)

**Interfaces:**
- Consumes: all modules created in Tasks 1-12

- [x] **Step 1: Run all provenance tests**

```bash
npx vitest run src/core/provenance/
```

Expected: All tests PASS

- [x] **Step 2: Run all provider tests**

```bash
npx vitest run src/providers/
```

Expected: All tests PASS

- [x] **Step 3: Run full test suite to verify downward compatibility**

```bash
npx vitest run
```

Expected: All existing tests still PASS, no regressions

- [x] **Step 4: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: No type errors

- [x] **Step 5: Run lint**

```bash
npx eslint src/core/provenance/ src/providers/
```

Expected: No lint errors

- [x] **Step 6: Commit**

```bash
git add .
git commit -m "chore: integration verification — all tests pass, no regressions"
```

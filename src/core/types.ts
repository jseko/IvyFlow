export type InstallScope = 'global' | 'project';

// ─── v0.9: Archive + Knowledge ───

export type ArchiveAction = 'archive-local' | 'push-pr' | 'keep-state' | 'discard';

export interface ArchiveOptions {
  cwd?: string;
  changeName?: string;
  action?: ArchiveAction;
  extractKnowledge?: boolean;
  message?: string;
  force?: boolean;
}

export interface ArchiveResult {
  changeName: string;
  oldPhase: string;
  newPhase: string;
  knowledgePath?: string;
  memoryPath?: string;
  reportPath?: string;
  summary: string;
}

// ─── v0.9: Knowledge Extraction ───

export type ExtractableType = 'decision' | 'constraint' | 'risk' | 'fact';

export interface DecisionRecord {
  id: string;
  title: string;
  description: string;
  date: string;
  source: string;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
}

export interface ConstraintRecord {
  id: string;
  description: string;
  source: string;
  severity: 'must' | 'should' | 'may';
}

export interface RiskRecord {
  id: string;
  description: string;
  source: string;
  impact: 'high' | 'medium' | 'low';
  mitigation?: string;
}

export interface FactRecord {
  id: string;
  description: string;
  source: string;
  category: 'techStack' | 'dependency' | 'convention' | 'environment' | 'other';
}

export interface ProjectKnowledge {
  decisions: DecisionRecord[];
  constraints: ConstraintRecord[];
  risks: RiskRecord[];
  facts: FactRecord[];
}

// ─── v0.9: L0 Memory ───

export interface MemoryL0Entry {
  type: ExtractableType;
  key: string;
  value: string;
  source: string;
  confidence: number;
  timestamp: string;
}

export interface MemorySummary {
  changeName: string;
  archiveDate: string;
  counts: Record<ExtractableType, number>;
  memoryDir: string;
}

// ─── v0.9: Quality Gates / Evidence ───

export interface QualityGateConfig {
  compile?: boolean;
  test?: boolean;
  taskCheck?: boolean;
  coverage?: {
    enabled: boolean;
    minPercentage?: number;
  };
}

export interface EvidenceRecord {
  gate: string;
  passed: boolean;
  skipped: boolean;
  output?: string;
  durationMs: number;
  error?: string;
}

export interface EvidenceReport {
  changeName: string;
  results: EvidenceRecord[];
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  overall: 'passed' | 'failed' | 'skipped';
  timestamp: string;
  writtenTo: string;
}

// ─── v0.9: Project Fingerprint ───

export interface StackDetection<T> {
  value: T;
  confidence: number;
  matchedFiles: string[];
}

export type ProjectType = 'frontend' | 'backend' | 'fullstack' | 'library' | 'cli' | 'unknown';

export interface ProjectFingerprint {
  projectType: StackDetection<ProjectType>;
  backend?: StackDetection<string[]>;
  frontend?: StackDetection<string[]>;
  buildTool: StackDetection<string[]>;
  testFramework: StackDetection<string[]>;
  language: StackDetection<string[]>;
  packageManager: StackDetection<string>;
  detectedAt: string;
}

// ─── v0.10: PreToolUse TS Guard ───

export interface PreToolUseContext {
  toolName: string;
  filePath: string;
  content?: string;
  currentPhase: string;
  changeName?: string;
}

export type HookDecision =
  | { decision: 'allow' }
  | { decision: 'block'; reason: string }
  | { decision: 'warn'; message: string };

export interface PreToolUseGuardConfig {
  rules: Array<{
    matcher: string;
    allowedPhases: string[];
    blockMessage?: string;
  }>;
  globalBlock?: string[];
  /** v0.33: MCP tool permission levels L0 (auto-allow) to L3 (always block) */
  toolPermissions?: Record<string, 'L0' | 'L1' | 'L2' | 'L3'>;
}

// ─── v0.10: Memory Architecture ───

export type MemoryRecordType = 'decision' | 'constraint' | 'risk' | 'fact' | 'evidence' | 'capability' | 'verify-profile';

export interface MemoryRecord {
  id: string;
  type: MemoryRecordType;
  title: string;
  timestamp: string;
  changeName: string;
  source: string;
  content: string;
  tags: string[];
}

export interface AdrIndexEntry {
  id: string;
  title: string;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  date: string;
  changeName: string;
  supersededBy?: string;
}

export interface AdrView {
  records: MemoryRecord[];
  index: AdrIndexEntry[];
}

export interface MemoryOverview {
  totalRecords: number;
  byType: Record<MemoryRecordType, number>;
  knowledgeEntryCount: number;
}

// ─── v0.10: Export API ───

export interface ExportChange {
  name: string;
  phases: Array<{
    name: string;
    enteredAt: string;
    duration_days: number;
  }>;
  commitCount: number;
  completed: boolean;
}

export interface ExportMetric {
  metric: string;
  change: string;
  phase: string;
  value: number;
  label: string;
}

export interface ExportPayload {
  version: string;
  exportedAt: string;
  project: {
    name: string;
    path: string;
    platforms: Array<{ id: string; name: string }>;
    analyticsEnabled: boolean;
  };
  changes: ExportChange[];
  metrics: ExportMetric[];
  knowledge: MemoryRecord[];
  workflowEvidence?: Array<{
    changeName: string;
    transition: string;
    rationale: string;
    refs: string[];
    timestamp: string;
  }>;
  errors?: Array<{ message: string }>;
}

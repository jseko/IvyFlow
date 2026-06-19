/**
 * Capability Model — v0.15 core types for capability infrastructure.
 */

export type CapabilityCategory = 'rule' | 'skill' | 'verification';
export type CapabilitySource = 'builtin' | 'local';
export type CapabilityStatus = 'active' | 'missing' | 'disabled';

export type ProjectIntent =
  | 'api-only'
  | 'fullstack-app'
  | 'static-site'
  | 'library'
  | 'cli-tool'
  | 'enterprise-service'
  | 'mobile-backend'
  | 'prototype';

export interface Capability {
  id: string;
  name: string;
  category: CapabilityCategory;
  source: CapabilitySource;
  status: CapabilityStatus;
  version?: string;
  description?: string;
  techStackMatch?: string[];
}

export interface TechStack {
  frontend?: string[];
  backend?: string[];
  database?: string[];
  buildTool?: string[];
  testFramework?: string[];
  language?: string[];
  packageManager?: string;
  e2eFramework?: string;
}

export interface RawTechSignal {
  source: string;
  key: string;
  value: string;
  confidence: number;
}

export interface InferredCapability {
  id: string;
  name: string;
  confidence: number;
  source: string;
}

export type ReconcilePolicy =
  | 'techstack-dominant'
  | 'intent-dominant'
  | 'confidence-weighted'
  | 'manual-first';

export interface ReconcileStrategy {
  policy: ReconcilePolicy;
  overrides?: Array<{ stack: string; value: 'include' | 'exclude' | 'unresolved'; rationale: string }>;
  uncertaintyHandling: 'best-guess' | 'unresolved';
}

export interface UnresolvedItem {
  itemId: string;
  reason: string;
  confidence: number;
}

export interface DetectionResult {
  techStack: TechStack;
  projectIntent: ProjectIntent;
  sources: string[];
  confidence: number;
  timestamp: string;
  rawSignals: RawTechSignal[];
  candidates: InferredCapability[];
  unresolved: UnresolvedItem[];
}

// ─── Rule Types (for rule-generator) ───

export type RuleSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RuleTier = 'core' | 'context' | 'optional';
export type RuleType = 'constraint' | 'behavior' | 'architecture';

export interface RuleDefinition {
  id: string;
  name?: string;
  type?: RuleType;
  scope?: 'file' | 'module' | 'project';
  severity: RuleSeverity;
  tier: RuleTier;
  techStackTrigger: string[];
  content?: string;
  contextTriggers?: Array<{ context: string; mode: 'include' | 'exclude' }>;
  source?: string[];
}

export interface RuleProfile {
  rules: RuleDefinition[];
  source: 'generated' | 'manual' | 'mixed';
  generatedAt: string;
  unresolved?: Array<{ ruleId: string; reason: string; confidence: number }>;
}

// ─── Capability Dependency Index ───

export type CapabilityDependencyIndex = Record<string, string[]>;

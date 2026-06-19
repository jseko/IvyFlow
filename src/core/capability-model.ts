/**
 * Capability Model — v0.14 core types for Capability Infrastructure.
 *
 * Defines the domain model for tech-stack detection, capability derivation,
 * project intent, rule tiering, and dependency indexing.
 *
 * This module is the single source of truth consumed by:
 * - capability-detector.ts (Sprint 14.1)
 * - rule-generator.ts (Sprint 14.2)
 * - skill-registry.ts / verify-profile.ts (Sprint 14.3)
 * - capability-health.ts (Sprint 14.5)
 */

// ─── Capability Categories ───

export type CapabilityCategory = 'rule' | 'skill' | 'verification';
export type CapabilitySource = 'builtin' | 'local';
export type CapabilityStatus = 'active' | 'missing' | 'disabled';

// ─── Tech Stack ───

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

// ─── Project Intent ───
// Modifier layer with weight ≤ 0.3. Cannot override tech stack.

export type ProjectIntent =
  | 'api-only'
  | 'fullstack-app'
  | 'static-site'
  | 'library'
  | 'cli-tool'
  | 'enterprise-service'
  | 'mobile-backend'
  | 'prototype';

// ─── Capability ───

export interface Capability {
  id: string;
  name: string;
  category: CapabilityCategory;
  source: CapabilitySource;
  status: CapabilityStatus;
  version?: string;
  description?: string;
  dependsOn?: string[];
  techStackMatch?: string[];
}

// ─── Capability Dependency Index ───
// Flat adjacency list — NOT a graph. No DAG / topological / path-search semantics.
export type CapabilityDependencyIndex = Record<string, string[]>;

// ─── Detection Result ───

export interface DetectionResult {
  techStack: TechStack;
  projectIntent: ProjectIntent;
  sources: string[];
  confidence: number;
  timestamp: string;
}

// ─── Rule Tiering ───

export type RuleSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RuleScope = 'file' | 'module' | 'project';
export type RuleType = 'constraint' | 'behavior' | 'architecture';
export type RuleTier = 'core' | 'context' | 'optional';

export interface RuleDefinition {
  id: string;
  name: string;
  type: RuleType;
  scope: RuleScope;
  severity: RuleSeverity;
  tier: RuleTier;
  source: string[];
  content: string;
  techStackTrigger: string[];
}

export interface RuleProfile {
  rules: RuleDefinition[];
  source: 'generated' | 'manual' | 'mixed';
  generatedAt: string;
}

// ─── Skill Registry ───

export type SkillDeterminism = 'deterministic' | 'heuristic';
export type SkillInstallMode = 'auto' | 'recommend' | 'manual';

export interface SkillEntry {
  id: string;
  name: string;
  category: 'design' | 'review' | 'testing' | 'security' | 'performance' | 'documentation';
  determinism: SkillDeterminism;
  source: 'builtin' | 'local';
  installMode: SkillInstallMode;
  techStackTrigger: string[];
  path?: string;
}

// ─── Maturity & Verify Profile ───

export type MaturityLevel = 'prototype' | 'development' | 'production';
export type GateRequirement = 'required' | 'optional' | 'none';

export interface VerifyProfile {
  maturity: MaturityLevel;
  compile: GateRequirement;
  unitTest: GateRequirement;
  integrationTest: GateRequirement;
  e2e: GateRequirement;
  lint: GateRequirement;
  coverage: GateRequirement;
}

// ─── Capability Health ───

export type CapabilityHealthStatus = 'healthy' | 'warning' | 'error';

export interface CapabilityGap {
  type: 'rule' | 'skill' | 'verification';
  description: string;
  recommendedAction: string;
  severity: 'high' | 'medium' | 'low';
}

export interface RiskFlag {
  type: 'missing' | 'conflict' | 'stale' | 'misaligned';
  description: string;
}

export interface CapabilityDiagnosticReport {
  status: CapabilityHealthStatus;
  gaps: CapabilityGap[];
  riskFlags: RiskFlag[];
  suggestions: string[];
}

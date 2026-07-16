/**
 * Memory Convergence — data model types (v0.15).
 *
 * Defines MemoryConfig, ExtendedFeature, and helper types for
 * project.yaml memory section and feature gating.
 */

// ─── Extended Memory Features (Task 5.2/5.3) ───

export const EXTENDED_FEATURES = [
  'vector-search',
  'memory-linking',
  'knowledge-graph',
  'procedural-memory',
] as const;

export type ExtendedFeature = (typeof EXTENDED_FEATURES)[number];

export const CORE_FEATURES: ExtendedFeature[] = [];

export function isCoreFeature(feature: string): boolean {
  return CORE_FEATURES.includes(feature as ExtendedFeature);
}

export function isExtendedFeature(feature: string): boolean {
  return EXTENDED_FEATURES.includes(feature as ExtendedFeature);
}

// ─── MemoryConfig (for .ivy/project.yaml memory section) ───

export interface MemoryConfig {
  /** Enable specific extended features (default: only Core). */
  enabled_features?: ExtendedFeature[];
  retention?: {
    episodic_max_days?: number;
    semantic_max_records?: number;
    auto_compress_threshold?: number;
  };
  gc?: {
    schedule?: 'weekly' | 'daily' | 'manual';
    dry_run_first?: boolean;
  };
  /** Org Intelligence gate thresholds (Task 5.8). */
  org_gates?: {
    min_projects?: number;
    min_memories?: number;
    min_active_months?: number;
    recommended_projects?: number;
    recommended_memories?: number;
    recommended_months?: number;
  };
}

// ─── GcConfig (from MemoryConfig.retention + .gc) ───

export interface GcConfig {
  retention: {
    episodic_max_days: number;
    semantic_max_records: number;
    auto_compress_threshold: number;
  };
  gc: {
    schedule: 'weekly' | 'daily' | 'manual';
    dry_run_first: boolean;
  };
}

export const DEFAULT_GC_CONFIG: GcConfig = {
  retention: {
    episodic_max_days: 365,
    semantic_max_records: 2000,
    auto_compress_threshold: 1000,
  },
  gc: {
    schedule: 'weekly',
    dry_run_first: true,
  },
};

// ─── Org Intelligence Gate Thresholds (Task 5.8) ───

export interface OrgGateThresholds {
  min_projects: number;
  min_memories: number;
  min_active_months: number;
  recommended_projects: number;
  recommended_memories: number;
  recommended_months: number;
}

export const DEFAULT_ORG_GATES: OrgGateThresholds = {
  min_projects: 3,
  min_memories: 500,
  min_active_months: 1,
  recommended_projects: 10,
  recommended_memories: 3000,
  recommended_months: 3,
};

// ─── ProjectYaml with memory section ───

export interface ProjectYaml {
  name?: string;
  version?: string;
  platforms?: Array<{ id: string; name: string }>;
  analytics_enabled?: boolean;
  memory?: MemoryConfig;
  [key: string]: unknown;
}

// ─── Helpers ───

/**
 * Read enabled features from project.yaml, defaulting to empty (Core only).
 */
export function getEnabledFeatures(config?: MemoryConfig): ExtendedFeature[] {
  return config?.enabled_features ?? [];
}

/**
 * Check if a specific feature is enabled in the given config.
 */
export function isFeatureEnabled(
  feature: ExtendedFeature,
  config?: MemoryConfig,
): boolean {
  if (isCoreFeature(feature)) return true;
  return (config?.enabled_features ?? []).includes(feature);
}

/**
 * Read org gate thresholds from memory config or use defaults.
 */
export function getOrgGateThresholds(
  config?: MemoryConfig,
): OrgGateThresholds {
  const g = config?.org_gates;
  return {
    min_projects: g?.min_projects ?? DEFAULT_ORG_GATES.min_projects,
    min_memories: g?.min_memories ?? DEFAULT_ORG_GATES.min_memories,
    min_active_months: g?.min_active_months ?? DEFAULT_ORG_GATES.min_active_months,
    recommended_projects: g?.recommended_projects ?? DEFAULT_ORG_GATES.recommended_projects,
    recommended_memories: g?.recommended_memories ?? DEFAULT_ORG_GATES.recommended_memories,
    recommended_months: g?.recommended_months ?? DEFAULT_ORG_GATES.recommended_months,
  };
}

/**
 * Read GC config from memory config or use defaults.
 */
export function getGcConfig(config?: MemoryConfig): GcConfig {
  const r = config?.retention;
  const g = config?.gc;
  return {
    retention: {
      episodic_max_days: r?.episodic_max_days ?? DEFAULT_GC_CONFIG.retention.episodic_max_days,
      semantic_max_records: r?.semantic_max_records ?? DEFAULT_GC_CONFIG.retention.semantic_max_records,
      auto_compress_threshold: r?.auto_compress_threshold ?? DEFAULT_GC_CONFIG.retention.auto_compress_threshold,
    },
    gc: {
      schedule: g?.schedule ?? DEFAULT_GC_CONFIG.gc.schedule,
      dry_run_first: g?.dry_run_first ?? DEFAULT_GC_CONFIG.gc.dry_run_first,
    },
  };
}

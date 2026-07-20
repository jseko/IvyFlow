import type { AdoptionProfile } from '../../adoption-engine.js';

export interface DashboardMeta {
  repository: string;
  period: { start: string; end: string };
  model: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface DashboardMetrics {
  funnel?: AdoptionProfile['funnel'];
  lifecycle?: LifecycleDistribution;
  abandonment?: AdoptionProfile['abandonment'];
  failure?: AdoptionProfile['failureIntelligence'];
  lineage?: AdoptionProfile['lineage'];
  value?: AdoptionProfile['valueIndex'];
  csi?: AdoptionProfile['csi'];
  feedback?: AdoptionProfile['feedback'];
}

export interface LifecycleDistribution {
  aiLifecycle: Record<string, number>;
  gitLifecycle: Record<string, number>;
  runtimeLifecycle: Record<string, number>;
}

export type RenderFormat = 'terminal' | 'html' | 'json' | 'markdown';

export interface RenderOptions {
  panels: string[];
  format: RenderFormat;
  width?: number;
  outputPath?: string;
}

export interface RenderContext {
  data: DashboardData;
  options: RenderOptions;
}

export interface DashboardData {
  meta: DashboardMeta;
  metrics: DashboardMetrics;
}

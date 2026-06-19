/**
 * Capability Detector — v0.15 4-stage pipeline: detect → infer → reconcile → emit.
 */

import path from 'path';

import { fileExists, readFile } from '../utils/fs.js';
import { readYaml } from '../utils/yaml.js';
import type {
  TechStack,
  ProjectIntent,
  DetectionResult,
  RawTechSignal,
  InferredCapability,
  ReconcilePolicy,
  ReconcileStrategy,
  UnresolvedItem,
} from './capability-model.js';

// ─── Stage 1: Detect ───

export interface DetectionSources {
  packageJson: Record<string, string> | null;
  goMod: string | null;
  cargoToml: Record<string, string> | null;
  pomXml: string | null;
  requirementsTxt: string[] | null;
  tsconfigJson: boolean;
}

const PACKAGE_MAP: Record<string, string> = {
  next: 'nextjs',
  react: 'react',
  vue: 'vue3',
  '@nestjs/core': 'nestjs',
  express: 'express',
  playwright: 'playwright',
  cypress: 'cypress',
  vitest: 'vitest',
  jest: 'jest',
  tailwindcss: 'tailwind',
};

export async function scanSources(cwd: string): Promise<DetectionSources> {
  const sources: DetectionSources = {
    packageJson: null,
    goMod: null,
    cargoToml: null,
    pomXml: null,
    requirementsTxt: null,
    tsconfigJson: false,
  };

  const pkgPath = path.join(cwd, 'package.json');
  if (await fileExists(pkgPath)) {
    const pkg = await readYaml<Record<string, unknown>>(pkgPath).catch(() => null);
    if (pkg) {
      const deps = { ...(pkg.dependencies as Record<string, string> || {}), ...(pkg.devDependencies as Record<string, string> || {}) };
      sources.packageJson = deps;
    }
  }

  const goModPath = path.join(cwd, 'go.mod');
  if (await fileExists(goModPath)) {
    sources.goMod = 'go';
  }

  const cargoPath = path.join(cwd, 'Cargo.toml');
  if (await fileExists(cargoPath)) {
    const cargo = await readYaml<Record<string, unknown>>(cargoPath).catch(() => null);
    if (cargo?.dependencies) {
      sources.cargoToml = cargo.dependencies as Record<string, string>;
    } else {
      sources.cargoToml = {};
    }
  }

  const pomPath = path.join(cwd, 'pom.xml');
  if (await fileExists(pomPath)) {
    sources.pomXml = await readFile(pomPath);
  }

  const reqPath = path.join(cwd, 'requirements.txt');
  if (await fileExists(reqPath)) {
    const content = await readFile(reqPath);
    sources.requirementsTxt = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  }

  const tsconfigPath = path.join(cwd, 'tsconfig.json');
  sources.tsconfigJson = await fileExists(tsconfigPath);

  return sources;
}

export function extractRawSignals(sources: DetectionSources): RawTechSignal[] {
  const signals: RawTechSignal[] = [];

  if (sources.packageJson) {
    for (const [dep, ver] of Object.entries(sources.packageJson)) {
      const mapped = PACKAGE_MAP[dep];
      if (mapped) {
        signals.push({ source: 'package.json', key: dep, value: mapped, confidence: 0.9 });
      }
    }
  }

  if (sources.goMod) {
    signals.push({ source: 'go.mod', key: 'module', value: sources.goMod, confidence: 0.95 });
  }

  if (sources.cargoToml !== null) {
    signals.push({ source: 'Cargo.toml', key: 'dependencies', value: 'rust', confidence: 0.9 });
  }

  if (sources.pomXml) {
    if (sources.pomXml.includes('spring-boot-starter-parent')) {
      signals.push({ source: 'pom.xml', key: 'spring-boot-starter-parent', value: 'springboot', confidence: 0.85 });
    }
  }

  if (sources.requirementsTxt) {
    for (const line of sources.requirementsTxt) {
      const lower = line.toLowerCase();
      if (lower.startsWith('django')) signals.push({ source: 'requirements.txt', key: line, value: 'django', confidence: 0.8 });
      else if (lower.startsWith('flask')) signals.push({ source: 'requirements.txt', key: line, value: 'flask', confidence: 0.8 });
    }
  }

  return signals;
}

// ─── Stage 2: Infer ───

export function inferCapabilities(signals: RawTechSignal[]): InferredCapability[] {
  const seen = new Map<string, { name: string; confidences: number[]; source: string }>();

  for (const s of signals) {
    if (!seen.has(s.value)) {
      seen.set(s.value, { name: s.value, confidences: [], source: s.source });
    }
    seen.get(s.value)!.confidences.push(s.confidence);
  }

  return Array.from(seen.entries()).map(([id, info]) => ({
    id,
    name: info.name,
    confidence: Math.max(...info.confidences),
    source: info.source,
  }));
}

export function inferProjectIntent(techStack: TechStack, cwd: string): ProjectIntent {
  const hasBackend = (techStack.backend?.length ?? 0) > 0;
  const hasFrontend = (techStack.frontend?.length ?? 0) > 0;

  if (hasFrontend && hasBackend) return 'fullstack-app';
  if (hasBackend && !hasFrontend) return 'api-only';
  if (hasFrontend && !hasBackend) return 'static-site';

  return 'library';
}

// ─── Stage 3: Reconcile ───

export function reconcileCapabilities(
  candidates: InferredCapability[],
  strategy: ReconcileStrategy,
): { resolved: InferredCapability[]; unresolved: UnresolvedItem[] } {
  const resolved: InferredCapability[] = [];
  const unresolved: UnresolvedItem[] = [];

  for (const candidate of candidates) {
    const override = strategy.overrides?.find(o => o.stack === candidate.id);
    if (override?.value === 'exclude') continue;
    if (override?.value === 'unresolved') {
      unresolved.push({ itemId: candidate.id, reason: override.rationale, confidence: candidate.confidence });
      if (strategy.uncertaintyHandling === 'best-guess') {
        resolved.push(candidate);
      }
      continue;
    }

    if (candidate.confidence < 0.4 && strategy.uncertaintyHandling === 'unresolved') {
      unresolved.push({ itemId: candidate.id, reason: 'Low confidence', confidence: candidate.confidence });
      continue;
    }

    if (candidate.confidence < 0.4) {
      unresolved.push({ itemId: candidate.id, reason: 'Low confidence', confidence: candidate.confidence });
    }

    resolved.push(candidate);
  }

  return { resolved, unresolved };
}

// ─── Stage 4: Emit ───

export function buildTechStack(candidates: InferredCapability[]): TechStack {
  const ts: TechStack = {};

  for (const c of candidates) {
    if (['react', 'vue3', 'nextjs', 'tailwind'].includes(c.id)) {
      (ts.frontend ??= []).push(c.id);
    } else if (['nestjs', 'express', 'springboot', 'django', 'flask'].includes(c.id)) {
      (ts.backend ??= []).push(c.id);
    } else if (['vitest', 'jest', 'playwright', 'cypress'].includes(c.id)) {
      (ts.testFramework ??= []).push(c.id);
    } else if (['go', 'rust'].includes(c.id)) {
      (ts.language ??= []).push(c.id);
    }
  }

  return ts;
}

// ─── Pipeline ───

export async function detectCapabilities(
  cwd: string,
  strategy: ReconcileStrategy = { policy: 'techstack-dominant', uncertaintyHandling: 'best-guess' },
  projectIntentOverride?: ProjectIntent,
): Promise<DetectionResult> {
  const sources = await scanSources(cwd);
  const rawSignals = extractRawSignals(sources);
  const candidates = inferCapabilities(rawSignals);
  const { resolved, unresolved } = reconcileCapabilities(candidates, strategy);
  const techStack = buildTechStack(resolved);
  const intent = projectIntentOverride ?? inferProjectIntent(techStack, cwd);
  const totalConf = resolved.reduce((sum, c) => sum + c.confidence, 0);
  const confidence = resolved.length > 0 ? totalConf / resolved.length : 0;

  return {
    techStack,
    projectIntent: intent,
    sources: Object.entries(sources).filter(([, v]) => v !== null && v !== false).map(([k]) => k),
    confidence: Math.round(confidence * 100) / 100,
    timestamp: new Date().toISOString(),
    rawSignals,
    candidates: resolved,
    unresolved,
  };
}

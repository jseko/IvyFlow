/**
 * Capability Detector — v0.14 Capability Detection engine.
 *
 * Scans project configuration files and directory structure to detect
 * the project's tech stack, infer project intent, and produce a
 * structured DetectionResult written to `.ivy/capability.yaml`.
 *
 * @module capability-detector
 */

import path from 'path';

import { readFile, fileExists, readDir } from '../utils/fs.js';
import { readYaml, writeYaml } from '../utils/yaml.js';
import { logger } from '../utils/logger.js';
import type {
  TechStack,
  DetectionResult,
  ProjectIntent,
  Capability,
  CapabilityDependencyIndex,
} from './capability-model.js';

// ─── Confidence Tiers ───

const TIERS = {
  DEFINITIVE: 1.0,
  NEAR_DEFINITIVE: 0.9,
  STRONG: 0.8,
  MODERATE: 0.7,
  WEAK: 0.6,
} as const;

// ─── Public API ───

/**
 * Detect the project's tech stack by scanning configuration files.
 *
 * Scans `package.json`, `pom.xml`, `go.mod`, `Cargo.toml`,
 * `requirements.txt`, and directory structure. Returns a structured
 * DetectionResult with accumulated confidence.
 */
export async function detectTechStack(projectPath: string): Promise<DetectionResult> {
  const files = await readDir(projectPath);
  const lp = files.map((f) => f.toLowerCase());

  const techStack: TechStack = {};
  const sources: string[] = [];
  let confidenceSum = 0;
  let confidenceCount = 0;

  // Track whether meaningful detection happened
  let meaningfulDetection = false;

  // ── package.json (Node.js / TypeScript) ──
  if (lp.includes('package.json')) {
    sources.push('package.json');
    techStack.language = addToSet(techStack.language, 'typescript');
    confidenceSum += TIERS.DEFINITIVE;
    confidenceCount++;

    const pkg = await readFile(path.join(projectPath, 'package.json'))
      .then((c) => JSON.parse(c))
      .catch(() => ({})) as Record<string, unknown>;
    const deps = {
      ...((pkg.dependencies as Record<string, string>) ?? {}),
      ...((pkg.devDependencies as Record<string, string>) ?? {}),
    };

    // Frontend
    if (deps['next']) {
      techStack.frontend = addToSet(techStack.frontend, 'nextjs');
      techStack.frontend = addToSet(techStack.frontend, 'react');
      meaningfulDetection = true;
    } else if (deps['react']) {
      techStack.frontend = addToSet(techStack.frontend, 'react');
      meaningfulDetection = true;
    }
    if (deps['vue']) {
      techStack.frontend = addToSet(techStack.frontend, 'vue');
      meaningfulDetection = true;
    }
    if (deps['@angular/core']) {
      techStack.frontend = addToSet(techStack.frontend, 'angular');
      meaningfulDetection = true;
    }
    if (deps['svelte']) {
      techStack.frontend = addToSet(techStack.frontend, 'svelte');
      meaningfulDetection = true;
    }
    if (deps['nuxt']) {
      techStack.frontend = addToSet(techStack.frontend, 'nuxt');
      techStack.frontend = addToSet(techStack.frontend, 'vue');
      meaningfulDetection = true;
    }

    // Backend
    if (deps['@nestjs/core']) {
      techStack.backend = addToSet(techStack.backend, 'nestjs');
      meaningfulDetection = true;
    }
    if (deps['express']) {
      techStack.backend = addToSet(techStack.backend, 'express');
      meaningfulDetection = true;
    }
    if (deps['fastify']) {
      techStack.backend = addToSet(techStack.backend, 'fastify');
      meaningfulDetection = true;
    }

    // Test frameworks
    if (deps['vitest']) {
      techStack.testFramework = addToSet(techStack.testFramework, 'vitest');
    }
    if (deps['jest']) {
      techStack.testFramework = addToSet(techStack.testFramework, 'jest');
    }
    if (deps['playwright']) {
      techStack.testFramework = addToSet(techStack.testFramework, 'playwright');
      techStack.e2eFramework = 'playwright';
    }
    if (deps['cypress']) {
      techStack.testFramework = addToSet(techStack.testFramework, 'cypress');
      techStack.e2eFramework = techStack.e2eFramework ?? 'cypress';
    }

    // Build tool
    techStack.buildTool = addToSet(techStack.buildTool, deps['next'] || deps['nuxt'] ? 'next' : 'webpack');

    // Package manager
    if (lp.includes('pnpm-lock.yaml')) {
      techStack.packageManager = 'pnpm';
    } else if (lp.includes('yarn.lock')) {
      techStack.packageManager = 'yarn';
    } else if (lp.includes('package-lock.json')) {
      techStack.packageManager = 'npm';
    }
  }

  // ── pom.xml (Java / Spring Boot) ──
  if (lp.includes('pom.xml')) {
    sources.push('pom.xml');
    techStack.language = addToSet(techStack.language, 'java');
    techStack.buildTool = addToSet(techStack.buildTool, 'maven');
    confidenceSum += TIERS.DEFINITIVE;
    confidenceCount++;

    const pomContent = await readFile(path.join(projectPath, 'pom.xml')).catch(() => '');
    if (pomContent.includes('spring-boot-starter-parent') || pomContent.includes('spring-boot-starter')) {
      techStack.backend = addToSet(techStack.backend, 'springboot');
      meaningfulDetection = true;
    }
  }

  // ── go.mod (Go) ──
  if (lp.includes('go.mod')) {
    sources.push('go.mod');
    techStack.language = addToSet(techStack.language, 'go');
    techStack.buildTool = addToSet(techStack.buildTool, 'go');
    confidenceSum += TIERS.DEFINITIVE;
    confidenceCount++;

    const goModContent = await readFile(path.join(projectPath, 'go.mod')).catch(() => '');
    if (goModContent.includes('module ')) {
      techStack.backend = addToSet(techStack.backend, 'go');
      meaningfulDetection = true;
    }
  }

  // ── Cargo.toml (Rust) ──
  if (lp.includes('cargo.toml')) {
    sources.push('Cargo.toml');
    techStack.language = addToSet(techStack.language, 'rust');
    techStack.buildTool = addToSet(techStack.buildTool, 'cargo');
    confidenceSum += TIERS.DEFINITIVE;
    confidenceCount++;

    const cargoContent = await readFile(path.join(projectPath, 'Cargo.toml')).catch(() => '');
    if (cargoContent.includes('[dependencies]')) {
      meaningfulDetection = true;
    }
  }

  // ── requirements.txt (Python) ──
  if (lp.includes('requirements.txt')) {
    sources.push('requirements.txt');
    techStack.language = addToSet(techStack.language, 'python');
    confidenceSum += TIERS.STRONG;
    confidenceCount++;

    const reqContent = await readFile(path.join(projectPath, 'requirements.txt')).catch(() => '');
    const lower = reqContent.toLowerCase();
    if (lower.includes('django')) {
      techStack.backend = addToSet(techStack.backend, 'django');
      meaningfulDetection = true;
    }
    if (lower.includes('flask')) {
      techStack.backend = addToSet(techStack.backend, 'flask');
      meaningfulDetection = true;
    }
  }

  // ── pyproject.toml (Python) ──
  if (lp.includes('pyproject.toml')) {
    sources.push('pyproject.toml');
    if (!techStack.language?.includes('python')) {
      techStack.language = addToSet(techStack.language, 'python');
      confidenceSum += TIERS.STRONG;
      confidenceCount++;
    }

    const pyContent = await readFile(path.join(projectPath, 'pyproject.toml')).catch(() => '');
    if (pyContent.includes('django')) {
      techStack.backend = addToSet(techStack.backend, 'django');
      meaningfulDetection = true;
    }
  }

  // ── Database hints from config files ──
  // Look for common database dependencies in package.json
  if (lp.includes('package.json')) {
    const pkg = await readFile(path.join(projectPath, 'package.json'))
      .then((c) => JSON.parse(c))
      .catch(() => ({})) as Record<string, unknown>;
    const deps = {
      ...((pkg.dependencies as Record<string, string>) ?? {}),
      ...((pkg.devDependencies as Record<string, string>) ?? {}),
    };
    if (deps['prisma']) techStack.database = addToSet(techStack.database, 'prisma');
    if (deps['typeorm']) techStack.database = addToSet(techStack.database, 'typeorm');
    if (deps['pg'] || deps['@neondatabase/serverless']) techStack.database = addToSet(techStack.database, 'postgresql');
    if (deps['redis']) techStack.database = addToSet(techStack.database, 'redis');
  }

  // ── Confidence calculation ──
  let confidence: number;
  if (confidenceCount === 0) {
    confidence = 0;
  } else {
    confidence = Math.round((confidenceSum / confidenceCount) * 100) / 100;
  }

  // If we have meaningful tech detection, confidence should be higher
  if (meaningfulDetection && confidence < TIERS.STRONG) {
    confidence = TIERS.STRONG;
  }
  // Cap at 1.0
  confidence = Math.min(confidence, 1.0);

  // ── Intent inference ──
  const projectIntent = await inferProjectIntent(projectPath, techStack);

  return {
    techStack,
    projectIntent,
    sources: [...new Set(sources)],
    confidence,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Infer project intent from directory structure and configuration.
 *
 * Intent is a modifier with weight ≤ 0.3. It cannot override tech stack.
 * Manual override in `.ivy/project.yaml` takes precedence.
 */
export async function inferProjectIntent(
  projectPath: string,
  techStack: TechStack,
): Promise<ProjectIntent> {
  // Check for manual override first
  const projectYaml = await readYaml<{
    capability?: { project_intent?: string };
  }>(path.join(projectPath, '.ivy', 'project.yaml'));
  const manualIntent = projectYaml?.capability?.project_intent;
  if (manualIntent && isValidIntent(manualIntent)) {
    return manualIntent as ProjectIntent;
  }

  const dirs = await readDir(projectPath).catch(() => []);
  const lowerDirs = dirs.map((d) => d.toLowerCase());

  // src/api/ directory presence → api-only
  const hasApiDir = lowerDirs.some(
    (d) => d === 'api' || d === 'src/api' || d.startsWith('api/'),
  );

  // Check subdirs for src/api
  let hasSrcApi = false;
  if (lowerDirs.includes('src')) {
    try {
      const srcEntries = await readDir(path.join(projectPath, 'src'));
      hasSrcApi = srcEntries.some((e) => e.toLowerCase() === 'api');
    } catch {
      // ignore
    }
  }

  // app/ or pages/ — SSR framework
  const hasAppDir = lowerDirs.includes('app');
  const hasPagesDir = lowerDirs.includes('pages');

  // bin/ or cli/ — CLI tool
  const hasBinDir = lowerDirs.includes('bin');
  const hasCliDir = lowerDirs.includes('cli');

  // Dockerfile + k8s/ — enterprise service
  const hasDockerfile = lowerDirs.includes('dockerfile');
  const hasK8sDir = lowerDirs.includes('k8s') || lowerDirs.includes('kubernetes');

  // Has web framework
  const hasWebFramework =
    (techStack.frontend && techStack.frontend.length > 0) ||
    (techStack.backend && techStack.backend.some((b) => b !== 'go'));

  // Intent inference logic
  if (hasDockerfile && hasK8sDir) {
    return 'enterprise-service';
  }

  if (hasSrcApi || hasApiDir) {
    const hasFrontend = techStack.frontend && techStack.frontend.length > 0;
    if (!hasFrontend && !hasAppDir && !hasPagesDir) {
      return 'api-only';
    }
  }

  if (hasAppDir || hasPagesDir) {
    return 'fullstack-app';
  }

  if ((hasBinDir || hasCliDir) && !hasWebFramework) {
    return 'cli-tool';
  }

  if (hasWebFramework) {
    return 'fullstack-app';
  }

  return 'prototype';
}

/**
 * Write detection results to `.ivy/capability.yaml`.
 */
export async function restackDetection(projectPath: string): Promise<void> {
  const result = await detectTechStack(projectPath);

  const capabilityYamlPath = path.join(projectPath, '.ivy', 'capability.yaml');

  await writeYaml(capabilityYamlPath, {
    detected_at: result.timestamp,
    confidence: result.confidence,
    project_intent: result.projectIntent,
    sources: result.sources,
    tech_stack: serializeTechStack(result.techStack),
  } as Record<string, unknown>);

  logger.success(`Detection results written to .ivy/capability.yaml (confidence: ${result.confidence.toFixed(2)})`);
}

/**
 * Create a flat CapabilityDependencyIndex from a list of capabilities.
 *
 * Returns a Record<capabilityId, string[]> — a flat adjacency list.
 * No topological sort or graph traversal is performed.
 */
export function createDependencyIndex(capabilities: Capability[]): CapabilityDependencyIndex {
  const index: CapabilityDependencyIndex = {};

  for (const cap of capabilities) {
    index[cap.id] = cap.dependsOn ?? [];
  }

  return index;
}

// ─── Helpers ───

function addToSet(arr: string[] | undefined, item: string): string[] {
  if (!arr) return [item];
  if (arr.includes(item)) return arr;
  return [...arr, item];
}

function isValidIntent(value: string): value is ProjectIntent {
  const valid: ProjectIntent[] = [
    'api-only',
    'fullstack-app',
    'static-site',
    'library',
    'cli-tool',
    'enterprise-service',
    'mobile-backend',
    'prototype',
  ];
  return valid.includes(value as ProjectIntent);
}

function serializeTechStack(ts: TechStack): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (ts.frontend) result.frontend = ts.frontend;
  if (ts.backend) result.backend = ts.backend;
  if (ts.database) result.database = ts.database;
  if (ts.buildTool) result.buildTool = ts.buildTool;
  if (ts.testFramework) result.testFramework = ts.testFramework;
  if (ts.language) result.language = ts.language;
  if (ts.packageManager) result.packageManager = ts.packageManager;
  if (ts.e2eFramework) result.e2eFramework = ts.e2eFramework;
  return result;
}

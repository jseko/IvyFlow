/**
 * `ivy fingerprint` — confidence-scored tech stack detection.
 *
 * Scans project config files (pom.xml, package.json, go.mod, etc.) and
 * produces a ProjectFingerprint with StackDetection values containing
 * confidence scores (1.0/0.9/0.8/0.7/0.6) and matched file paths.
 *
 * Cached to .ivy/fingerprint.yaml. Refreshed with --refresh.
 */

import path from 'path';

import { readFile, fileExists, readDir } from '../utils/fs.js';
import { readYaml, writeYaml } from '../utils/yaml.js';
import { logger } from '../utils/logger.js';
import type { StackDetection, ProjectFingerprint, ProjectType } from '../core/types.js';

// ─── Types ───

export interface FingerprintOptions {
  cwd?: string;
  json?: boolean;
  refresh?: boolean;
}

// ─── Confidence Tiers ───
// Matching platform detect.ts pattern: 1.0/0.9/0.8/0.7/0.6

const TIERS = {
  DEFINITIVE: 1.0,
  NEAR_DEFINITIVE: 0.9,
  STRONG: 0.8,
  MODERATE: 0.7,
  WEAK: 0.6,
} as const;

// ─── Command Entry Point ───

export async function runFingerprint(opts: FingerprintOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const cachePath = path.join(cwd, '.ivy', 'fingerprint.yaml');

  // Return cached if not refreshing
  if (!opts.refresh) {
    const cached = await readYaml<ProjectFingerprint>(cachePath);
    if (cached) {
      outputFingerprint(cached, opts.json);
      logger.dim('(cached — use --refresh to re-scan)');
      return 0;
    }
  }

  // Detect
  const fingerprint = await detectFingerprint(cwd);

  // Cache
  await writeYaml(cachePath, fingerprint as unknown as Record<string, unknown>);

  // Output
  outputFingerprint(fingerprint, opts.json);
  return 0;
}

// ─── Detection Engine ───

export async function detectFingerprint(projectPath: string): Promise<ProjectFingerprint> {
  const files = await readDir(projectPath);
  const lp = files.map((f) => f.toLowerCase());

  const stack: ProjectFingerprint = {
    projectType: { value: 'unknown', confidence: 1.0, matchedFiles: [] },
    language: { value: [], confidence: 1.0, matchedFiles: [] },
    buildTool: { value: [], confidence: 0, matchedFiles: [] },
    testFramework: { value: [], confidence: 0, matchedFiles: [] },
    packageManager: { value: 'npm', confidence: 0, matchedFiles: [] },
    detectedAt: new Date().toISOString(),
  };

  // ── Java / Maven / Gradle ──
  if (lp.includes('pom.xml')) {
    stack.language.value.push('java');
    stack.language.matchedFiles.push('pom.xml');
    stack.buildTool.value.push('maven');
    stack.buildTool.matchedFiles.push('pom.xml');
    stack.buildTool.confidence = TIERS.DEFINITIVE;

    const pomContent = await readFile(path.join(projectPath, 'pom.xml')).catch(() => '');
    if (pomContent.includes('spring-boot-starter')) {
      stack.backend = { value: ['spring-boot'], confidence: TIERS.NEAR_DEFINITIVE, matchedFiles: ['pom.xml'] };
    }
  } else if (lp.includes('build.gradle') || lp.includes('build.gradle.kts')) {
    stack.language.value.push('java');
    stack.buildTool.value.push('gradle');
    stack.buildTool.matchedFiles.push(lp.includes('build.gradle') ? 'build.gradle' : 'build.gradle.kts');
    stack.buildTool.confidence = TIERS.DEFINITIVE;
  }

  // ── Go ──
  if (lp.includes('go.mod')) {
    stack.language.value.push('go');
    stack.language.matchedFiles.push('go.mod');
    stack.buildTool.value.push('go');
    stack.buildTool.matchedFiles.push('go.mod');
    stack.buildTool.confidence = TIERS.DEFINITIVE;
    stack.backend = { value: ['go'], confidence: TIERS.STRONG, matchedFiles: ['go.mod'] };
  }

  // ── Rust ──
  if (lp.includes('cargo.toml')) {
    stack.language.value.push('rust');
    stack.language.matchedFiles.push('Cargo.toml');
    stack.buildTool.value.push('cargo');
    stack.buildTool.matchedFiles.push('Cargo.toml');
    stack.buildTool.confidence = TIERS.DEFINITIVE;
  }

  // ── Python ──
  if (lp.includes('requirements.txt')) {
    stack.language.value.push('python');
    stack.language.matchedFiles.push('requirements.txt');
    if (!stack.buildTool.confidence) {
      stack.buildTool.value.push('pip');
      stack.buildTool.matchedFiles.push('requirements.txt');
      stack.buildTool.confidence = TIERS.STRONG;
    }
  }
  if (lp.includes('pyproject.toml')) {
    stack.language.value.push('python');
    stack.language.matchedFiles.push('pyproject.toml');
    if (!stack.buildTool.confidence) {
      stack.buildTool.value.push('pip');
      stack.buildTool.matchedFiles.push('pyproject.toml');
      stack.buildTool.confidence = TIERS.NEAR_DEFINITIVE;
    }
  }

  // ── Node.js (package.json deep scan) ──
  if (lp.includes('package.json')) {
    stack.language.value.push('typescript');
    stack.language.matchedFiles.push('package.json');
    stack.packageManager.matchedFiles.push('package.json');

    // Lockfile → definitive package manager
    if (lp.includes('pnpm-lock.yaml')) {
      stack.packageManager = { value: 'pnpm', confidence: TIERS.NEAR_DEFINITIVE, matchedFiles: ['pnpm-lock.yaml'] };
    } else if (lp.includes('yarn.lock')) {
      stack.packageManager = { value: 'yarn', confidence: TIERS.NEAR_DEFINITIVE, matchedFiles: ['yarn.lock'] };
    } else if (lp.includes('package-lock.json')) {
      stack.packageManager = { value: 'npm', confidence: TIERS.NEAR_DEFINITIVE, matchedFiles: ['package-lock.json'] };
    }

    // Read package.json
    const pkg = await readFile(path.join(projectPath, 'package.json'))
      .then((c) => JSON.parse(c))
      .catch(() => ({})) as Record<string, unknown>;
    const deps = { ...(pkg.dependencies as Record<string, string> ?? {}), ...(pkg.devDependencies as Record<string, string> ?? {})};

    // Frontend detection
    if (deps['vue'] || deps['nuxt']) {
      stack.frontend = { value: deps['nuxt'] ? ['vue', 'nuxt'] : ['vue'], confidence: TIERS.STRONG, matchedFiles: ['package.json'] };
    } else if (deps['react'] || deps['next']) {
      stack.frontend = { value: deps['next'] ? ['react', 'next'] : ['react'], confidence: TIERS.STRONG, matchedFiles: ['package.json'] };
    } else if (deps['@angular/core']) {
      stack.frontend = { value: ['angular'], confidence: TIERS.STRONG, matchedFiles: ['package.json'] };
    } else if (deps['svelte']) {
      stack.frontend = { value: ['svelte'], confidence: TIERS.STRONG, matchedFiles: ['package.json'] };
    }

    // Backend detection
    if (!stack.backend && (deps['express'] || deps['fastify'])) {
      stack.backend = { value: ['express'], confidence: TIERS.MODERATE, matchedFiles: ['package.json'] };
    }

    // Test framework
    if (deps['vitest']) {
      stack.testFramework.value.push('vitest');
      stack.testFramework.matchedFiles.push('package.json');
      stack.testFramework.confidence = TIERS.MODERATE;
    } else if (deps['jest']) {
      stack.testFramework.value.push('jest');
      stack.testFramework.matchedFiles.push('package.json');
      stack.testFramework.confidence = TIERS.MODERATE;
    }

    // CLI detection via bin field
    if (pkg['bin']) {
      stack.projectType = detectByComposition(stack, 'cli');
    }
  }

  // ── Compose projectType ──
  const hasFrontend = stack.frontend !== undefined;
  const hasBackend = stack.backend !== undefined;

  if (hasFrontend && hasBackend) {
    stack.projectType = detectByComposition(stack, 'fullstack');
  } else if (hasFrontend) {
    stack.projectType = detectByComposition(stack, 'frontend');
  } else if (hasBackend) {
    stack.projectType = detectByComposition(stack, 'backend');
  }

  // ── Confidence fallback ──
  if (!stack.buildTool.confidence) stack.buildTool.confidence = 0;
  if (!stack.testFramework.confidence) stack.testFramework.confidence = 0;
  if (!stack.packageManager.confidence) stack.packageManager.confidence = 0;

  return stack;
}

function detectByComposition(stack: ProjectFingerprint, projectType: ProjectType): StackDetection<ProjectType> {
  const confidences: number[] = [TIERS.DEFINITIVE];
  if (stack.projectType.matchedFiles.length > 0) confidences.push(stack.projectType.confidence);
  return {
    value: projectType,
    confidence: Math.max(...confidences),
    matchedFiles: stack.projectType.matchedFiles,
  };
}

// ─── Output ───

function outputFingerprint(fp: ProjectFingerprint, asJson?: boolean): void {
  if (asJson) {
    console.log(JSON.stringify(fp, null, 2));
    return;
  }

  logger.info('');
  logger.info('Project Fingerprint');
  logger.info('─────────────────────────────────────');
  logger.info(`Type:      ${fp.projectType.value.padEnd(14)} (${fp.projectType.confidence.toFixed(2)})`);

  if (fp.language && fp.language.value.length > 0) {
    const langs = fp.language.value.join(', ');
    logger.info(`Language:  ${langs.padEnd(14)} (${fp.language.confidence.toFixed(2)})  [${fp.language.matchedFiles.join(', ')}]`);
  }
  if (fp.backend) {
    logger.info(`Backend:   ${fp.backend.value.join(', ').padEnd(14)} (${fp.backend.confidence.toFixed(2)})  [${fp.backend.matchedFiles.join(', ')}]`);
  }
  if (fp.frontend) {
    logger.info(`Frontend:  ${fp.frontend.value.join(', ').padEnd(14)} (${fp.frontend.confidence.toFixed(2)})  [${fp.frontend.matchedFiles.join(', ')}]`);
  }
  if (fp.buildTool && fp.buildTool.value.length > 0) {
    logger.info(`Build:     ${fp.buildTool.value.join(', ').padEnd(14)} (${fp.buildTool.confidence.toFixed(2)})  [${fp.buildTool.matchedFiles.join(', ')}]`);
  }
  if (fp.testFramework && fp.testFramework.value.length > 0) {
    logger.info(`Test:      ${fp.testFramework.value.join(', ').padEnd(14)} (${fp.testFramework.confidence.toFixed(2)})  [${fp.testFramework.matchedFiles.join(', ')}]`);
  }
  logger.info(`Package:   ${fp.packageManager?.value ?? 'npm'.padEnd(14)} (${(fp.packageManager?.confidence ?? 0).toFixed(2)})  [${fp.packageManager?.matchedFiles.join(', ') ?? ''}]`);
  logger.info('');
}

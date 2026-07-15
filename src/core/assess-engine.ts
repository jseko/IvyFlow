/**
 * Assess Engine — five-dimension legacy project scoring.
 *
 * v0.33: Scores documentation, test coverage, comment quality,
 * architecture clarity, and dependency health on 0-100 scale.
 */

import path from 'path';
import { fileExists, readFile, readDir } from '../utils/fs.js';

export interface AssessResult {
  documentation: number;
  testCoverage: number;
  commentQuality: number;
  architecture: number;
  dependencyHealth: number;
  overall: number;
  details: string[];
}

export async function runAssess(cwd: string): Promise<AssessResult> {
  const details: string[] = [];

  // 1. Documentation (0-100)
  let documentation = 0;
  const docFiles = ['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'docs/'];
  for (const f of docFiles) {
    if (await fileExists(path.join(cwd, f))) documentation += 25;
  }
  details.push(`Documentation: ${documentation}/100 (${docFiles.filter(async (f) => await fileExists(path.join(cwd, f))).length}/${docFiles.length} files found)`);

  // 2. Test Coverage (0-100) — heuristic based on test file presence
  let testCoverage = 0;
  try {
    const srcFiles = await countFiles(path.join(cwd, 'src'), '.ts');
    const testFiles = await countFiles(cwd, '.test.ts');
    if (srcFiles > 0) {
      const ratio = Math.min(testFiles / srcFiles, 1);
      testCoverage = Math.round(ratio * 100);
    }
  } catch { testCoverage = 0; }
  details.push(`Test Coverage: ${testCoverage}/100 (heuristic based on test file ratio)`);

  // 3. Comment Quality (0-100) — heuristic
  let commentQuality = 0;
  const hasTsConfig = await fileExists(path.join(cwd, 'tsconfig.json'));
  const hasEslint = await fileExists(path.join(cwd, 'eslint.config.js')) || await fileExists(path.join(cwd, '.eslintrc.js'));
  const hasJsDoc = await fileExists(path.join(cwd, '.eslintrc.js'));
  if (hasTsConfig) commentQuality += 40;
  if (hasEslint) commentQuality += 30;
  if (hasJsDoc) commentQuality += 30;
  details.push(`Comment Quality: ${commentQuality}/100 (tsconfig: ${hasTsConfig}, eslint: ${hasEslint})`);

  // 4. Architecture (0-100)
  let architecture = 0;
  const archIndicators = ['ARCHITECTURE.md', 'docs/architecture.md', '.ivy/project.yaml'];
  for (const f of archIndicators) {
    if (await fileExists(path.join(cwd, f))) architecture += 33;
  }
  architecture = Math.min(architecture, 100);
  details.push(`Architecture: ${architecture}/100`);

  // 5. Dependency Health (0-100)
  let dependencyHealth = 50; // default
  const pkgPath = path.join(cwd, 'package.json');
  if (await fileExists(pkgPath)) {
    try {
      const pkg = JSON.parse(await readFile(pkgPath));
      const deps = Object.keys(pkg.dependencies ?? {}).length;
      const devDeps = Object.keys(pkg.devDependencies ?? {}).length;
      if (deps + devDeps <= 20) dependencyHealth = 90;
      else if (deps + devDeps <= 50) dependencyHealth = 70;
      else dependencyHealth = 50;
    } catch { /* ignore */ }
  }
  details.push(`Dependency Health: ${dependencyHealth}/100`);

  const overall = Math.round((documentation + testCoverage + commentQuality + architecture + dependencyHealth) / 5);
  return { documentation, testCoverage, commentQuality, architecture, dependencyHealth, overall, details };
}

async function countFiles(dir: string, ext: string): Promise<number> {
  if (!(await fileExists(dir))) return 0;
  const entries = await readDir(dir);
  let count = 0;
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    try {
      const stat = await import('fs').then((m) => m.promises.stat(fullPath));
      if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
        count += await countFiles(fullPath, ext);
      } else if (entry.endsWith(ext)) {
        count++;
      }
    } catch { /* skip */ }
  }
  return count;
}

/**
 * `ivy verify` — Quality gates with evidence output.
 *
 * Runs compile, test, task check, and optional coverage gates on a change.
 * Produces structured evidence report at `.ivy/evidence/<change-name>.yaml`.
 * Report-only: no auto-fix. Exit code 0 if all pass, 1 if any fail.
 */

import path from 'path';
import { readdirSync } from 'fs';
import { execSync } from 'child_process';

import { fileExists, readFile, ensureDir } from '../utils/fs.js';
import { readYaml, writeYaml } from '../utils/yaml.js';
import { logger } from '../utils/logger.js';
import type { EvidenceRecord, EvidenceReport } from '../core/types.js';
import { MemoryStore } from '../core/memory-arch.js';
import { createAutoLink } from '../core/knowledge-linking.js';
import { auditEvidence } from '../core/evidence-audit.js';

// ─── Types ───

export interface VerifyOptions {
  cwd?: string;
  change?: string;
  gate?: string;
  skip?: string;
  minEvidence?: number;
}

interface ProjectYaml {
  quality_gates?: {
    compile?: boolean;
    test?: boolean;
    task_check?: boolean;
    coverage?: {
      enabled?: boolean;
      min_percentage?: number;
    };
  };
  [key: string]: unknown;
}

// ─── Command Entry Point ───

export async function runVerify(opts: VerifyOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const ivyDir = path.join(cwd, '.ivy');
  const changeName = opts.change;

  if (!changeName) {
    logger.error('--change <name> is required');
    return 1;
  }

  // Read project.yaml for gate config
  const projectYamlPath = path.join(ivyDir, 'project.yaml');
  const projectYaml = await readYaml<ProjectYaml>(projectYamlPath);
  const gatesConfig = projectYaml?.quality_gates ?? {};

  const evidenceDir = path.join(ivyDir, 'evidence');
  await ensureDir(evidenceDir);

  logger.step(`Verifying change: ${changeName}`);
  logger.info('');

  const results: EvidenceRecord[] = [];
  const skipGate = opts.skip ? opts.skip.split(',') : [];

  // ── Compile Gate ──
  if (shouldRun('compile', opts.gate, gatesConfig.compile, skipGate)) {
    logger.info('  Gate: compile...');
    const result = await runGate('compile', cwd, getBuildCommand(cwd));
    results.push(result);
    logGateResult(result);
  }

  // ── Test Gate ──
  if (shouldRun('test', opts.gate, gatesConfig.test, skipGate)) {
    logger.info('  Gate: test...');
    const result = await runGate('test', cwd, getTestCommand(cwd));
    results.push(result);
    logGateResult(result);
  }

  // ── Task Check Gate ──
  if (shouldRun('tasks', opts.gate, gatesConfig.task_check ?? true, skipGate)) {
    logger.info('  Gate: task check...');
    const result = await runTaskCheck(cwd, changeName);
    results.push(result);
    logGateResult(result);
  }

  // ── Coverage Gate ──
  const coverageEnabled = gatesConfig.coverage?.enabled ?? false;
  if (shouldRun('coverage', opts.gate, coverageEnabled, skipGate)) {
    logger.info('  Gate: coverage...');
    const minPct = gatesConfig.coverage?.min_percentage ?? 80;
    const result = await runGate('coverage', cwd, getCoverageCommand(cwd));
    const covered = checkCoverage(result.output, minPct);
    results.push({
      gate: 'coverage',
      passed: covered,
      skipped: false,
      output: result.output,
      durationMs: result.durationMs,
    });
    logGateResult(results[results.length - 1]);
  }

  // ── Evidence Gate (v0.12) — only runs when explicitly enabled via --gate evidence
  if (opts.gate === 'evidence' && shouldRun('evidence', opts.gate, true, skipGate)) {
    logger.info('  Gate: evidence...');
    const minEvidence = opts.minEvidence ?? 50;
    const result = await runEvidenceGate(cwd, changeName, minEvidence);
    results.push(result);
    logGateResult(result);
  }

  // ── Summary ──
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const overall = failed > 0 ? 'failed' : passed > 0 ? 'passed' : 'skipped';

  const report: EvidenceReport = {
    changeName,
    results,
    passedCount: passed,
    failedCount: failed,
    skippedCount: skipped,
    overall,
    timestamp: new Date().toISOString(),
    writtenTo: path.join(evidenceDir, `${changeName}.yaml`),
  };

  // Write evidence report
  await writeYaml(report.writtenTo, report as unknown as Record<string, unknown>);

  // ── Auto-link passing gates to decision memory ──
  const passingGates = results.filter((r) => r.passed);
  if (passingGates.length > 0 && changeName) {
    await autoLinkEvidence(cwd, changeName, passingGates);
  }

  logger.info('');
  if (overall === 'passed') {
    logger.success(`All gates passed (${passed}/${results.length})`);
  } else if (overall === 'failed') {
    logger.error(`Gates failed: ${failed} failed, ${passed} passed, ${skipped} skipped`);
  } else {
    logger.info(`All gates skipped (${skipped})`);
  }
  logger.dim(`Evidence: ${report.writtenTo}`);

  return overall === 'failed' ? 1 : 0;
}

// ─── Gate Helpers ───

function shouldRun(gate: string, filter?: string, enabled?: boolean, skip?: string[]): boolean {
  if (skip?.includes(gate)) return false;
  if (filter && filter !== gate) return false;
  return enabled !== false;
}

async function runGate(gate: string, cwd: string, command: string | null): Promise<EvidenceRecord> {
  const start = Date.now();

  if (!command) {
    return { gate, passed: false, skipped: true, output: 'no command configured', durationMs: 0 };
  }

  try {
    // §10.2: shell=false default on POSIX, timeout=120s prevents runaway processes
    const output = execSync(command, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120_000,
      stdio: 'pipe',
    }).trim();
    return { gate, passed: true, skipped: false, output: output.substring(0, 500), durationMs: Date.now() - start };
  } catch (err) {
    const stderr = (err as { stderr?: Buffer })?.stderr?.toString('utf-8') ?? '';
    return {
      gate,
      passed: false,
      skipped: false,
      output: stderr.substring(0, 500) || 'command failed',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    };
  }
}

async function runTaskCheck(cwd: string, changeName: string): Promise<EvidenceRecord> {
  const start = Date.now();
  const tasksPath = path.join(cwd, 'openspec', 'changes', changeName, 'tasks.md');

  if (!(await fileExists(tasksPath))) {
    return { gate: 'taskCheck', passed: false, skipped: true, output: 'tasks.md not found', durationMs: Date.now() - start };
  }

  const content = await readFile(tasksPath);
  const total = (content.match(/- \[ \]/g) || []).length + (content.match(/- \[x\]/g) || []).length;
  const completed = (content.match(/- \[x\]/g) || []).length;

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const allDone = total > 0 && completed === total;
  const output = `${completed}/${total} tasks complete (${pct}%)`;

  return {
    gate: 'taskCheck',
    passed: allDone,
    skipped: total === 0,
    output,
    durationMs: Date.now() - start,
  };
}

function logGateResult(r: EvidenceRecord): void {
  if (r.skipped) logger.dim(`  ⏭  ${r.gate} (skipped)`);
  else if (r.passed) logger.success(`  ✓ ${r.gate} (${r.durationMs}ms)`);
  else logger.error(`  ✗ ${r.gate} (${r.durationMs}ms)`);
}

// ─── Command Detection ───

function getBuildCommand(cwd: string): string | null {
  try {
    const files = readdirSync(cwd);
    if (files.includes('pom.xml')) return 'mvn compile -q 2>&1';
    if (files.includes('build.gradle') || files.includes('build.gradle.kts')) return './gradlew compileJava -q 2>&1';
    if (files.includes('go.mod')) return 'go build ./... 2>&1';
    if (files.includes('Cargo.toml')) return 'cargo check 2>&1';
    if (files.includes('package.json')) return 'npm run build 2>&1';
    return null;
  } catch {
    return null;
  }
}

function getTestCommand(cwd: string): string | null {
  try {
    const files = readdirSync(cwd);
    if (files.includes('pom.xml')) return 'mvn test -q 2>&1';
    if (files.includes('go.mod')) return 'go test ./... 2>&1';
    if (files.includes('Cargo.toml')) return 'cargo test 2>&1';
    if (files.includes('package.json')) return 'npm test 2>&1';
    return null;
  } catch {
    return null;
  }
}

function getCoverageCommand(cwd: string): string | null {
  try {
    const files = readdirSync(cwd);
    if (files.includes('package.json')) return 'npm test -- --coverage 2>&1';
    return null;
  } catch {
    return null;
  }
}

function checkCoverage(output: string | undefined, minPct: number): boolean {
  if (!output) return false;
  const match = output.match(/(\d+(?:\.\d+)?)%/);
  if (!match) return false;
  return parseFloat(match[1]) >= minPct;
}

// ─── v0.12: Evidence Gate ───

async function runEvidenceGate(cwd: string, changeName: string, minEvidence: number): Promise<EvidenceRecord> {
  const start = Date.now();
  const ivyDir = path.join(cwd, '.ivy');
  const memoryDir = path.join(ivyDir, 'memory');

  // Skip if no memory directory
  if (!(await fileExists(memoryDir))) {
    return { gate: 'evidence', passed: false, skipped: true, output: 'no memory directory', durationMs: Date.now() - start };
  }

  try {
    const audit = await auditEvidence(ivyDir, changeName);

    // Skip if no decisions
    if (audit.totalDecisions === 0) {
      return { gate: 'evidence', passed: false, skipped: true, output: 'no decisions to check', durationMs: Date.now() - start };
    }

    const passed = audit.coverage >= minEvidence;
    const output = `evidence coverage: ${audit.coverage}% (${audit.decisionsWithEvidence}/${audit.totalDecisions} decisions with evidence)`;

    return {
      gate: 'evidence',
      passed,
      skipped: false,
      output,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      gate: 'evidence',
      passed: false,
      skipped: false,
      output: 'evidence check failed',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    };
  }
}

/**
 * Auto-link passing quality gates to decision memory records.
 * When a gate passes, creates an evidence memory record and links
 * `evidence → decision` using createAutoLink().
 * Fully optional: silently skips if no memory store or decision records exist.
 */
async function autoLinkEvidence(cwd: string, changeName: string, gates: EvidenceRecord[]): Promise<void> {
  const ivyDir = path.join(cwd, '.ivy');
  const memoryDir = path.join(ivyDir, 'memory');

  // Skip if memory dir doesn't exist (no records to link to)
  if (!(await fileExists(memoryDir))) return;

  try {
    const store = new MemoryStore(cwd);

    // Find decision records for this change
    const decisions = await store.query({ types: ['decision'], changeName });
    if (decisions.length === 0) return;

    const targetDecisionId = decisions[0].id;

    for (const gate of gates) {
      // Create evidence memory record
      const evidenceId = await store.write({
        type: 'evidence',
        title: `Gate: ${gate.gate}`,
        timestamp: new Date().toISOString(),
        changeName,
        source: 'verify',
        content: gate.output?.substring(0, 500) ?? 'passed',
        tags: ['auto-linked', `gate:${gate.gate}`],
      });

      // Auto-link evidence → first decision record
      await createAutoLink(
        path.join(ivyDir, 'memory'),
        evidenceId,
        targetDecisionId,
        'evidences',
        `Gate "${gate.gate}" passed (${gate.durationMs}ms)`,
      );
    }
  } catch {
    // Fully optional: never break verify for linking failures
  }
}

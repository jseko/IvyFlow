/**
 * Guard Engine — hard-blocking phase guard checks.
 *
 * Unlike the advisory-only guards in lifecycle-projection.ts, these checks
 * are hard-blocking: failures return exit code 1 and prevent phase transitions.
 * Each guard validates the exit conditions for its phase before allowing
 * advancement to the next phase.
 */

import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileExists, readFile } from '../utils/fs.js';
import { readYaml } from '../utils/yaml.js';
import { type StateYaml } from './lifecycle-projection.js';
import { type IvyPhase } from './phase-machine.js';

export interface HardGuardResult {
  phase: string;
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; message: string }>;
  nextPhase?: string;
  nextSkill?: string;
}

const PHASE_NEXT: Record<string, { phase: string; skill: string }> = {
  open: { phase: 'design', skill: 'ivy-design' },
  design: { phase: 'build', skill: 'ivy-build' },
  build: { phase: 'verify', skill: 'ivy-verify' },
  verify: { phase: 'archive', skill: 'ivy-archive' },
  archive: { phase: 'done', skill: '' },
};

function fail(name: string, msg: string): { name: string; passed: false; message: string } {
  return { name, passed: false, message: msg };
}

function pass(name: string, msg?: string): { name: string; passed: true; message: string } {
  return { name, passed: true, message: msg ?? 'OK' };
}

function computeSha256(filePaths: string[]): string {
  const hash = crypto.createHash('sha256');
  for (const fp of filePaths.sort()) {
    try {
      const content = readFileSync(fp, 'utf-8');
      hash.update(content);
    } catch {
      // skip missing files
    }
  }
  return hash.digest('hex');
}

// ─── Phase-specific guard checks ───

async function guardOpen(cwd: string, changeName: string): Promise<HardGuardResult> {
  const changeDir = path.join(cwd, 'openspec', 'changes', changeName);
  const checks: HardGuardResult['checks'] = [];

  const proposalPath = path.join(changeDir, 'proposal.md');
  const designPath = path.join(changeDir, 'design.md');
  const tasksPath = path.join(changeDir, 'tasks.md');

  if (!(await fileExists(proposalPath))) {
    checks.push(fail('proposal.md', 'proposal.md is missing'));
  } else {
    const content = await readFile(proposalPath);
    if (content.trim().length === 0) {
      checks.push(fail('proposal.md', 'proposal.md is empty'));
    } else {
      checks.push(pass('proposal.md', 'proposal.md exists and is non-empty'));
    }
  }

  if (!(await fileExists(designPath))) {
    checks.push(fail('design.md', 'design.md is missing'));
  } else {
    const content = await readFile(designPath);
    if (content.trim().length === 0) {
      checks.push(fail('design.md', 'design.md is empty'));
    } else {
      checks.push(pass('design.md', 'design.md exists and is non-empty'));
    }
  }

  if (!(await fileExists(tasksPath))) {
    checks.push(fail('tasks.md', 'tasks.md is missing'));
  } else {
    const content = await readFile(tasksPath);
    if (content.trim().length === 0) {
      checks.push(fail('tasks.md', 'tasks.md is empty'));
    } else {
      const taskLines = content.split('\n').filter((l) => /^\s*-\s*\[[ x]\]/.test(l));
      if (taskLines.length === 0) {
        checks.push(fail('tasks.md', 'tasks.md has no task lines'));
      } else {
        checks.push(pass('tasks.md', `tasks.md has ${taskLines.length} task(s)`));
      }
    }
  }

  const passed = checks.every((c) => c.passed);
  return { phase: 'open', passed, checks, nextPhase: passed ? 'design' : undefined, nextSkill: passed ? 'ivy-design' : undefined };
}

async function guardDesign(cwd: string, changeName: string, state: StateYaml): Promise<HardGuardResult> {
  const checks: HardGuardResult['checks'] = [];

  const handoffContext = (state as Record<string, unknown>).handoff_context as string | undefined;
  const handoffHash = (state as Record<string, unknown>).handoff_hash as string | undefined;

  if (!handoffContext) {
    checks.push(fail('handoff_context', 'handoff_context is not set — run ivy handoff first'));
  } else {
    const exists = await fileExists(path.resolve(cwd, handoffContext));
    if (!exists) {
      checks.push(fail('handoff_context', `handoff_context file not found: ${handoffContext}`));
    } else {
      checks.push(pass('handoff_context', 'handoff_context exists'));
    }
  }

  if (!handoffHash || handoffHash.length !== 64) {
    checks.push(fail('handoff_hash', 'handoff_hash is missing or invalid'));
  } else {
    const changeDir = path.join(cwd, 'openspec', 'changes', changeName);
    const sourceFiles = [
      path.join(changeDir, 'proposal.md'),
      path.join(changeDir, 'design.md'),
      path.join(changeDir, 'tasks.md'),
    ];
    try {
      const specsDir = path.join(changeDir, 'specs');
      if (await fileExists(specsDir)) {
        const { readDir } = await import('../utils/fs.js');
        const entries = await readDir(specsDir);
        for (const entry of entries) {
          if (entry.endsWith('.md')) {
            sourceFiles.push(path.join(specsDir, entry));
          }
        }
      }
    } catch { /* specs dir not found */ }

    const currentHash = computeSha256(sourceFiles);
    if (currentHash !== handoffHash) {
      checks.push(fail('handoff_hash', 'handoff_hash mismatch — artifacts may have changed since handoff'));
    } else {
      checks.push(pass('handoff_hash', 'handoff_hash matches current artifacts'));
    }
  }

  // v0.33: delta-spec-checklist check (full workflow only)
  const workflow = (state as Record<string, unknown>).workflow as string | undefined;
  if (!workflow || workflow === 'full') {
    const checklistPath = path.join(cwd, 'openspec', 'changes', changeName, '.ivy', 'handoff', 'delta-spec-checklist.md');
    if (!(await fileExists(checklistPath))) {
      checks.push(fail('delta-spec-checklist', 'delta-spec-checklist not found — 5 类场景检查清单未完成'));
    } else {
      checks.push(pass('delta-spec-checklist', 'delta-spec-checklist exists'));
    }
  }

  const passed = checks.every((c) => c.passed);
  return { phase: 'design', passed, checks, nextPhase: passed ? 'build' : undefined, nextSkill: passed ? 'ivy-build' : undefined };
}

async function guardBuild(cwd: string, changeName: string, state: StateYaml): Promise<HardGuardResult> {
  const checks: HardGuardResult['checks'] = [];
  const ext = state as Record<string, unknown>;

  const isolation = ext.isolation as string | undefined;
  if (!isolation || !['branch', 'worktree'].includes(isolation)) {
    checks.push(fail('isolation', 'isolation must be branch or worktree'));
  } else {
    checks.push(pass('isolation', `isolation: ${isolation}`));
  }

  const buildMode = ext.build_mode as string | undefined;
  if (!buildMode) {
    checks.push(fail('build_mode', 'build_mode is not selected'));
  } else {
    checks.push(pass('build_mode', `build_mode: ${buildMode}`));
  }

  const tasksPath = path.join(cwd, 'openspec', 'changes', changeName, 'tasks.md');
  if (!(await fileExists(tasksPath))) {
    checks.push(fail('tasks.md', 'tasks.md not found'));
  } else {
    const content = await readFile(tasksPath);
    const unchecked = content.split('\n').filter((l) => /^\s*-\s*\[ \]/.test(l));
    if (unchecked.length > 0) {
      checks.push(fail('tasks', `${unchecked.length} unchecked task(s) remain`));
    } else {
      checks.push(pass('tasks', 'all tasks checked'));
    }
  }

  const buildCommand = ext.build_command as string | undefined;
  if (buildCommand) {
    try {
      execSync(buildCommand, { cwd, stdio: 'pipe', timeout: 300_000 });
      checks.push(pass('build', 'build passed'));
    } catch (err) {
      checks.push(fail('build', `build failed: ${(err as Error).message}`));
    }
  }

  // v0.33: review evidence check (skip for direct mode)
  if (buildMode !== 'direct') {
    const reviewDir = path.join(cwd, 'openspec', 'changes', changeName, '.ivy', 'review');
    const tasksPath2 = path.join(cwd, 'openspec', 'changes', changeName, 'tasks.md');
    if (await fileExists(tasksPath2)) {
      const content = await readFile(tasksPath2);
      const taskIds = content.split('\n')
        .filter((l) => /^\s*-\s*\[[ x]\]/.test(l))
        .map((l) => { const m = l.match(/^\s*-\s*\[[ x]\]\s+(\S+)/); return m ? m[1] : ''; })
        .filter(Boolean);

      const missing: string[] = [];
      for (const taskId of taskIds) {
        const specReview = path.join(reviewDir, `${taskId}-spec-review.md`);
        const qualityReview = path.join(reviewDir, `${taskId}-quality-review.md`);
        if (!(await fileExists(specReview))) missing.push(`${taskId}-spec-review.md`);
        if (!(await fileExists(qualityReview))) missing.push(`${taskId}-quality-review.md`);
      }

      if (missing.length > 0) {
        checks.push(fail('review_evidence', `missing review reports: ${missing.join(', ')}`));
      } else if (taskIds.length > 0) {
        checks.push(pass('review_evidence', `all ${taskIds.length} tasks have review reports`));
      }
    }
  }

  const passed = checks.every((c) => c.passed);
  return { phase: 'build', passed, checks, nextPhase: passed ? 'verify' : undefined, nextSkill: passed ? 'ivy-verify' : undefined };
}

async function guardVerify(cwd: string, state: StateYaml): Promise<HardGuardResult> {
  const checks: HardGuardResult['checks'] = [];
  const ext = state as Record<string, unknown>;

  const reportPath = ext.verification_report as string | undefined;
  if (!reportPath) {
    checks.push(fail('verification_report', 'verification_report is not set'));
  } else {
    const exists = await fileExists(path.resolve(cwd, reportPath));
    if (!exists) {
      checks.push(fail('verification_report', `verification_report not found: ${reportPath}`));
    } else {
      checks.push(pass('verification_report', 'verification_report exists'));
    }
  }

  const branchStatus = ext.branch_status as string | undefined;
  if (branchStatus !== 'handled') {
    checks.push(fail('branch_status', 'branch_status must be handled'));
  } else {
    checks.push(pass('branch_status', 'branch_status: handled'));
  }

  const verifyCommand = ext.verify_command as string | undefined;
  if (verifyCommand) {
    try {
      execSync(verifyCommand, { cwd, stdio: 'pipe', timeout: 300_000 });
      checks.push(pass('verify', 'verify passed'));
    } catch (err) {
      checks.push(fail('verify', `verify failed: ${(err as Error).message}`));
    }
  }

  // v0.33: spec compliance check in verification report
  if (reportPath) {
    const reportFullPath = path.resolve(cwd, reportPath);
    if (await fileExists(reportFullPath)) {
      try {
        const reportContent = await readFile(reportFullPath);
        if (!reportContent.includes('spec compliance') && !reportContent.includes('Spec Compliance')) {
          checks.push(fail('spec_compliance', 'verification_report missing spec compliance section'));
        } else {
          checks.push(pass('spec_compliance', 'spec compliance section found in verification report'));
        }
      } catch {
        // skip if report can't be read
      }
    }
  }

  const passed = checks.every((c) => c.passed);
  return { phase: 'verify', passed, checks, nextPhase: passed ? 'archive' : undefined, nextSkill: passed ? 'ivy-archive' : undefined };
}

async function guardArchive(cwd: string, changeName: string, state: StateYaml): Promise<HardGuardResult> {
  const checks: HardGuardResult['checks'] = [];
  const ext = state as Record<string, unknown>;

  if (ext.archived !== true && ext.archived !== 'true') {
    checks.push(fail('archived', 'archived flag is not set'));
  } else {
    checks.push(pass('archived', 'archived flag set'));
  }

  const changeDir = path.join(cwd, 'openspec', 'changes', changeName);
  const proposalPath = path.join(changeDir, 'proposal.md');
  const designPath = path.join(changeDir, 'design.md');

  if (!(await fileExists(proposalPath))) {
    checks.push(fail('proposal.md', 'proposal.md not found'));
  } else {
    checks.push(pass('proposal.md', 'exists'));
  }

  if (!(await fileExists(designPath))) {
    checks.push(fail('design.md', 'design.md not found'));
  } else {
    checks.push(pass('design.md', 'exists'));
  }

  const tasksPath = path.join(changeDir, 'tasks.md');
  if (await fileExists(tasksPath)) {
    const content = await readFile(tasksPath);
    const unchecked = content.split('\n').filter((l) => /^\s*-\s*\[ \]/.test(l));
    if (unchecked.length > 0) {
      checks.push(fail('tasks', `${unchecked.length} unchecked task(s) remain`));
    } else {
      checks.push(pass('tasks', 'all tasks checked'));
    }
  }

  const passed = checks.every((c) => c.passed);
  return { phase: 'archive', passed, checks, nextPhase: passed ? 'done' : undefined };
}

// ─── Main guard dispatcher ───

export async function runHardGuard(
  cwd: string,
  phase: IvyPhase,
  changeName: string,
  state: StateYaml,
): Promise<HardGuardResult> {
  switch (phase) {
    case 'open':
      return guardOpen(cwd, changeName);
    case 'design':
      return guardDesign(cwd, changeName, state);
    case 'build':
      return guardBuild(cwd, changeName, state);
    case 'verify':
      return guardVerify(cwd, state);
    case 'archive':
      return guardArchive(cwd, changeName, state);
    default:
      return { phase, passed: false, checks: [fail('phase', `Unknown phase: ${phase}`)] };
  }
}

export function formatGuardResult(result: HardGuardResult): string {
  const lines: string[] = [];
  const icon = result.passed ? 'PASS' : 'FAIL';
  lines.push(`Guard ${result.phase}: ${icon}`);
  lines.push('─'.repeat(40));
  for (const c of result.checks) {
    lines.push(`  [${c.passed ? '✓' : '✗'}] ${c.name}: ${c.message}`);
  }
  if (result.passed && result.nextSkill) {
    lines.push('');
    lines.push(`NEXT: auto, SKILL: ${result.nextSkill}`);
  }
  return lines.join('\n');
}

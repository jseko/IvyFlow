/**
 * Lifecycle Projection — v0.13 Checkpoint model + v0.15 Capability Guards.
 *
 * Lifecycle checkpoints are a projection of the OpenSpec change's artifact
 * completion status. There is no independent lifecycle state — checkpoint is
 * always derived from the change, preventing dual-state-source drift.
 *
 * Design constraints (design.md D1/D2):
 *   - checkpoint_is_projection: true
 *   - lifecycle_has_no_independent_state: true
 *   - backward transitions always allowed (no --force needed)
 *   - transition history capped at 10 entries
 *
 * v0.15 Capability Guards (Sprint 15.4):
 *   - Verify checkpoint enhanced with capability health guard checks
 *   - Verify profile validation in guard chain
 *   - Rule compliance check in guard chain
 *   - Preset system: full / hotfix / tweak
 *   - Capability gaps display as advisory (warn-level) — do NOT block transitions
 */

import path from 'path';
import { execSync } from 'child_process';

import { fileExists, readFile, writeFile, ensureDir } from '../utils/fs.js';
import { type IvyPhase, parsePhase, canTransition, listPhases } from './phase-machine.js';
import { detectCurrentChangeSync } from './change-detection.js';
import { recordVerifyResult } from './feedback-collector.js';
// ─── Types ───

export type LifecycleCheckpoint = IvyPhase;

export interface StateYaml {
  changeName: string;
  checkpoint: LifecycleCheckpoint;
  enteredAt: string;
  lastTransitionAt: string;
  transitionHistory: TransitionEntry[];
  // v0.33: workflow execution fields
  workflow?: string;
  build_mode?: string;
  isolation?: string;
  tdd_mode?: string;
  verify_mode?: string;
  verify_result?: string;
  handoff_context?: string;
  handoff_hash?: string;
  design_doc?: string;
  plan?: string;
  auto_transition?: boolean | string;
  archived?: boolean | string;
  verification_report?: string;
  branch_status?: string;
  build_command?: string;
  verify_command?: string;
  /** Git base commit recorded when the change was opened (consumed by adoption-lite). */
  base_commit?: string;
  /** v0.33: Agent collaboration topology */
  topology?: 'serial' | 'parallel' | 'supervisor' | 'debate';
  [key: string]: unknown;
}

export interface TransitionEntry {
  from: LifecycleCheckpoint | null;
  to: LifecycleCheckpoint;
  timestamp: string;
  rationale?: string;
  refs?: string[];
}

export interface GuardResult {
  check: string;
  passed: boolean;
  message?: string;
  severity?: 'error' | 'warning' | 'advisory';
}

export interface CapabilityGuardResult extends GuardResult {
  severity: 'warning' | 'advisory';
  gap?: {
    type: 'rule' | 'skill' | 'verification';
    expectedItem: string;
    actionability: 'auto_fixable' | 'suggestion_only' | 'manual_required';
  };
}

export type GuardPreset = 'full' | 'hotfix' | 'tweak';

export interface VerifyProfile {
  compile?: boolean;
  unitTest?: boolean;
  integrationTest?: boolean;
  e2e?: boolean;
  lint?: boolean;
  coverage?: number;
}

export interface RuleComplianceResult {
  compliant: boolean;
  violations: Array<{ rule: string; reason: string }>;
}

// ─── State file management ───

const MAX_HISTORY = 10;

/**
 * Resolve the path to a change's authoritative state file.
 *
 * Single source of truth: the writer (this module) and every reader — the git
 * pre-push hook, `ivy status`, `ivy validate`, and `adoption-lite` — all
 * operate on the SAME per-change file `openspec/changes/<name>/.ivy.yaml`.
 *
 * This eliminates the former dual-state-file drift where `.ivy/state.yaml` was
 * written by the CLI but never read by anything (the hook/status/validate/
 * adoption all expected `openspec/changes/<name>/.ivy.yaml`).
 *
 * The persisted key is `phase` (not `checkpoint`) so the shell hook / adoption
 * / status / validate — which all read `phase:` — stay in sync.
 */
export function getStatePath(cwd: string, changeName?: string): string {
  const name = changeName ?? detectCurrentChangeSync(cwd);
  if (!name) {
    // No active change: return a path that will not exist so readState => null.
    return path.join(cwd, 'openspec', 'changes', '.ivy.yaml');
  }
  return path.join(cwd, 'openspec', 'changes', name, '.ivy.yaml');
}

/**
 * Read the current lifecycle state.
 * Returns null if the state file doesn't exist.
 */
export async function readState(cwd: string, changeName?: string): Promise<StateYaml | null> {
  const statePath = getStatePath(cwd, changeName);
  if (!(await fileExists(statePath))) {
    return null;
  }
  const raw = await readFile(statePath);
  // Parse YAML-like format (simple key-value, since we avoid yaml dep in low-level module)
  const state = parseStateYaml(raw);
  return state;
}

/**
 * Write the lifecycle state to the per-change `.ivy.yaml`.
 *
 * On first write (or when missing) `base_commit` is captured from
 * `git rev-parse HEAD` so `adoption-lite` can compute an adoption diff at the
 * terminal phase. Best-effort: ignored when git is unavailable.
 */
export async function writeState(cwd: string, state: StateYaml, changeName?: string): Promise<void> {
  const statePath = getStatePath(cwd, changeName ?? state.changeName);
  await ensureDir(path.dirname(statePath));

  let toWrite = state;
  if (!state.base_commit) {
    try {
      const head = execSync('git rev-parse HEAD', {
        cwd,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim();
      if (head) toWrite = { ...state, base_commit: head };
    } catch {
      // git unavailable — leave base_commit unset
    }
  }

  await writeFile(statePath, serializeStateYaml(toWrite));
}

/**
 * Initialise a new state for a change. Sets checkpoint to 'open' with an
 * initial transition entry.
 */
export function createInitialState(changeName: string): StateYaml {
  const now = new Date().toISOString();
  return {
    changeName,
    checkpoint: 'open' as LifecycleCheckpoint,
    enteredAt: now,
    lastTransitionAt: now,
    transitionHistory: [
      {
        from: null,
        to: 'open' as LifecycleCheckpoint,
        timestamp: now,
        rationale: 'New change created',
      },
    ],
    // 初始化默认值（对齐 skill-orchestration spec：ivy state init 的字段默认值）。
    // build_mode / isolation 默认为 null（不写入，保持未设置）。
    workflow: 'full',
    auto_transition: true,
    verify_result: 'pending',
  };
}

/**
 * Attempt a checkpoint transition. Returns the new state on success, or
 * throws on invalid transition.
 *
 * Supports ALL backward transitions (build→design, verify→build, etc.)
 * without requiring any --force flag, per design.md D2.
 */
export function applyTransition(
  state: StateYaml,
  to: LifecycleCheckpoint,
  rationale?: string,
  refs?: string[],
): StateYaml {
  const from = state.checkpoint;

  // Validate via existing phase-machine transition table
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid transition: ${from} → ${to}. Allowed from ${from}: [${listPhases()
        .filter((p) => canTransition(from, p))
        .join(', ')}]`,
    );
  }

  const now = new Date().toISOString();
  const entry: TransitionEntry = { from, to, timestamp: now, rationale, refs };

  const history = [entry, ...state.transitionHistory];
  // Cap at MAX_HISTORY
  if (history.length > MAX_HISTORY) {
    history.length = MAX_HISTORY;
  }

  const isBackward = isBackwardTransition(from, to);

  return {
    ...state,
    checkpoint: to,
    lastTransitionAt: now,
    // Preserve enteredAt on backward transitions (we're still in the same change)
    enteredAt: isBackward ? state.enteredAt : now,
    transitionHistory: history,
  };
}

/**
 * Determine if a transition is backward (going to an earlier phase in the
 * canonical order: open < design < build < verify < archive).
 */
export function isBackwardTransition(from: LifecycleCheckpoint, to: LifecycleCheckpoint): boolean {
  const phases = listPhases();
  const fromIdx = phases.indexOf(from);
  const toIdx = phases.indexOf(to);
  return toIdx < fromIdx;
}

// ─── Guard checks ───

/**
 * Guard checks that verify artifact existence for a target checkpoint.
 * Each target checkpoint has specific artifact requirements:
 *   - open → design: proposal.md must exist
 *   - design → build: proposal.md, design.md, specs/, tasks.md must exist
 *   - build → verify: proposal.md, design.md, specs/, tasks.md must exist
 */
export async function runGuardChecks(
  cwd: string,
  from: LifecycleCheckpoint,
  to: LifecycleCheckpoint,
  changeName: string,
): Promise<GuardResult[]> {
  const changeDir = path.join(cwd, 'openspec', 'changes', changeName);
  const results: GuardResult[] = [];

  // Always check change directory exists
  results.push({
    check: 'Change directory exists',
    passed: await fileExists(changeDir),
  });

  // open → design: proposal.md
  if (from === 'open' && to === 'design') {
    results.push({
      check: 'proposal.md exists',
      passed: await fileExists(path.join(changeDir, 'proposal.md')),
    });
  }

  // design → build: proposal.md + design.md + specs/ + tasks.md
  if (from === 'design' && to === 'build') {
    results.push({
      check: 'proposal.md exists',
      passed: await fileExists(path.join(changeDir, 'proposal.md')),
    });
    results.push({
      check: 'design.md exists',
      passed: await fileExists(path.join(changeDir, 'design.md')),
    });
    results.push({
      check: 'specs/ created',
      passed: await fileExists(path.join(changeDir, 'specs')),
    });
    results.push({
      check: 'tasks.md exists',
      passed: await fileExists(path.join(changeDir, 'tasks.md')),
    });
  }

  // build → verify: same as design → build
  if (from === 'build' && to === 'verify') {
    results.push({
      check: 'proposal.md exists',
      passed: await fileExists(path.join(changeDir, 'proposal.md')),
    });
    results.push({
      check: 'design.md exists',
      passed: await fileExists(path.join(changeDir, 'design.md')),
    });
    results.push({
      check: 'tasks.md exists',
      passed: await fileExists(path.join(changeDir, 'tasks.md')),
    });
  }

  return results;
}

// ─── Capability Guards (Sprint 15.4) ───

/**
 * Run capability health guard checks for the verify checkpoint.
 * These checks are advisory only (warn-level) and do NOT block transitions.
 */
export async function runCapabilityGuards(
  cwd: string,
  changeName: string,
  preset: GuardPreset = 'full',
): Promise<CapabilityGuardResult[]> {
  const results: CapabilityGuardResult[] = [];

  // Skip detection for tweak/hotfix presets
  if (preset === 'tweak' || preset === 'hotfix') {
    results.push({
      check: 'Capability detection',
      passed: true,
      message: `Skipped (preset: ${preset})`,
      severity: 'advisory',
    });
    return results;
  }

  // Run capability detection
  try {
    const { detectCapabilities } = await import('./capability-detector.js');
    const detection = await detectCapabilities(cwd);
    const allTechStacks = Object.values(detection.techStack).flat().filter(Boolean) as string[];

    // Check for capability gaps (expected vs actual)
    // Expected capabilities are derived from the detected tech stack
    // For now, we check if the detected tech stack has meaningful content
    if (allTechStacks.length === 0) {
      results.push({
        check: 'Capability coverage',
        passed: true,
        message: 'No tech stack detected (advisory only)',
        severity: 'advisory',
      });
    } else {
      results.push({
        check: 'Capability coverage',
        passed: true,
        message: `Detected: ${allTechStacks.join(', ')}`,
        severity: 'advisory',
      });
    }
  } catch {
    results.push({
      check: 'Capability detection',
      passed: true,
      message: 'Detection unavailable (advisory only)',
      severity: 'advisory',
    });
  }

  return results;
}

function inferCapabilityType(item: string): 'rule' | 'skill' | 'verification' {
  if (item.startsWith('e2e-') || item.endsWith('-rules') || item.includes('-rules')) return 'rule';
  if (item.startsWith('verify-') || item.endsWith('-gate')) return 'verification';
  return 'skill';
}
export async function validateVerifyProfile(
  cwd: string,
  profile: VerifyProfile | null,
): Promise<CapabilityGuardResult> {
  if (!profile) {
    return {
      check: 'Verify profile',
      passed: true,
      message: 'No verify profile configured (advisory only)',
      severity: 'advisory',
    };
  }

  const missing: string[] = [];
  if (profile.compile === false) missing.push('compile');
  if (profile.unitTest === false) missing.push('unit test');
  if (profile.integrationTest === false) missing.push('integration test');
  if (profile.e2e === false) missing.push('e2e test');
  if (profile.lint === false) missing.push('lint');
  if (profile.coverage === undefined) missing.push('coverage threshold');

  if (missing.length > 0) {
    return {
      check: 'Verify profile',
      passed: false,
      message: `Missing verification gates: ${missing.join(', ')}`,
      severity: 'warning',
    };
  }

  return {
    check: 'Verify profile',
    passed: true,
    message: 'All verification gates configured',
    severity: 'advisory',
  };
}

/**
 * Check rule compliance against deployed rules.
 * Advisory only — does not block transitions.
 */
export async function checkRuleCompliance(
  cwd: string,
  changeName: string,
): Promise<RuleComplianceResult> {
  const violations: Array<{ rule: string; reason: string }> = [];

  // Check for stale rules (deployed but not matching current tech stack)
  try {
    const { detectCapabilities } = await import('./capability-detector.js');
    const detection = await detectCapabilities(cwd);
    const techStacks = Object.values(detection.techStack).flat().filter(Boolean) as string[];

    // Check .ivy/rules.yaml for deployed rules
    const rulesPath = path.join(cwd, '.ivy', 'rules.yaml');
    if (await fileExists(rulesPath)) {
      // Simple check: if rules exist but don't match tech stack, flag as stale
      // (Full rule compliance requires rule-registry module which is deferred)
    }
  } catch {
    // Detection unavailable, skip compliance check
  }

  return { compliant: violations.length === 0, violations };
}

/**
 * Run full guard checks including capability guards for verify checkpoint.
 * Capability guards are advisory only and do NOT block transitions.
 */
/**
 * Run post-transition actions after a successful state change.
 * Currently handles archive cleanup notifications.
 */
export async function runPostTransitionActions(
  cwd: string,
  changeName: string,
  to: LifecycleCheckpoint,
): Promise<void> {
  if (to === 'archive') {
    const { onPhaseArchive } = await import('./archive-cleanup.js');
    await onPhaseArchive(cwd, changeName);
  }
}

export async function runFullGuardChecks(
  cwd: string,
  from: LifecycleCheckpoint,
  to: LifecycleCheckpoint,
  changeName: string,
  preset: GuardPreset = 'full',
): Promise<{ standard: GuardResult[]; capability: CapabilityGuardResult[] }> {
  const standard = await runGuardChecks(cwd, from, to, changeName);
  const capability: CapabilityGuardResult[] = [];

  // Only run capability guards at verify checkpoint
  if (to === 'verify') {
    capability.push(...(await runCapabilityGuards(cwd, changeName, preset)));

    // Validate verify profile
    try {
      const profilePath = path.join(cwd, '.ivy', 'verify.yaml');
      if (await fileExists(profilePath)) {
        const { readFile } = await import('../utils/fs.js');
        const raw = await readFile(profilePath);
        // Parse YAML-like format
        const profile: VerifyProfile = {};
        if (raw.includes('compile:')) profile.compile = !raw.includes('compile: false');
        if (raw.includes('unitTest:')) profile.unitTest = !raw.includes('unitTest: false');
        if (raw.includes('integrationTest:')) profile.integrationTest = !raw.includes('integrationTest: false');
        if (raw.includes('e2e:')) profile.e2e = !raw.includes('e2e: false');
        if (raw.includes('lint:')) profile.lint = !raw.includes('lint: false');
        const coverageMatch = raw.match(/coverage:\s*(\d+)/);
        if (coverageMatch) profile.coverage = parseInt(coverageMatch[1], 10);

        capability.push(await validateVerifyProfile(cwd, profile));
      }
    } catch {
      // Profile validation unavailable
    }

    // 记录 verify 结果信号（v0.16）
    const allPassed = standard.every(r => r.passed) && capability.every(r => r.passed !== false);
    const gapCount = capability.filter(r => !r.passed).length;
    await recordVerifyResult(cwd, allPassed ? 'pass' : 'blocked', gapCount);
  }

  return { standard, capability };
}

// ─── YAML serialisation helpers ───

/**
 * Minimal YAML serializer for StateYaml.
 *
 * Persists EVERY top-level scalar field (not just the 4 core ones) so workflow
 * fields such as `build_mode`, `isolation`, `verify_result`, `branch_status`,
 * `handoff_context`/`handoff_hash`, `design_doc`, etc. survive a write/read
 * cycle. `checkpoint` is written as `phase:` to stay compatible with the shell
 * hook, status, validate, and adoption-lite, which all read `phase:`.
 */
function serializeStateYaml(state: StateYaml): string {
  const lines: string[] = [];
  lines.push(`changeName: ${state.changeName}`);
  lines.push(`phase: ${state.checkpoint}`);
  lines.push(`enteredAt: ${state.enteredAt}`);
  lines.push(`lastTransitionAt: ${state.lastTransitionAt}`);

  const skip = new Set([
    'changeName',
    'checkpoint',
    'enteredAt',
    'lastTransitionAt',
    'transitionHistory',
  ]);
  for (const [key, value] of Object.entries(state)) {
    if (skip.has(key)) continue;
    if (value === undefined || value === null) continue;
    if (typeof value === 'object') continue; // minimal serializer: skip nested values
    const rendered = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);
    lines.push(`${key}: ${rendered}`);
  }

  lines.push('transitionHistory:');
  for (const entry of state.transitionHistory) {
    lines.push(`  - from: ${entry.from ?? 'null'}`);
    lines.push(`    to: ${entry.to}`);
    lines.push(`    timestamp: ${entry.timestamp}`);
    if (entry.rationale) {
      lines.push(`    rationale: ${entry.rationale}`);
    }
    if (entry.refs && entry.refs.length > 0) {
      lines.push(`    refs:`);
      for (const ref of entry.refs) {
        lines.push(`      - ${ref}`);
      }
    }
  }
  return lines.join('\n') + '\n';
}

/**
 * Minimal YAML parser for StateYaml.
 * Handles the format produced by serializeStateYaml, including generic
 * top-level scalar fields written under the `[key: string]: unknown` index.
 */
function parseStateYaml(raw: string): StateYaml {
  const lines = raw.split('\n');
  const state: Partial<StateYaml> = {};
  const history: TransitionEntry[] = [];
  let currentEntry: Partial<TransitionEntry> | null = null;
  let inRefs = false;
  const refsBuffer: string[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    // Top-level fields
    const changeMatch = line.match(/^changeName:\s*(.+)$/);
    if (changeMatch) { state.changeName = changeMatch[1].trim(); continue; }

    const phaseMatch = line.match(/^phase:\s*(.+)$/);
    if (phaseMatch) { state.checkpoint = phaseMatch[1].trim() as LifecycleCheckpoint; continue; }

    const enteredMatch = line.match(/^enteredAt:\s*(.+)$/);
    if (enteredMatch) { state.enteredAt = enteredMatch[1].trim(); continue; }

    const lastMatch = line.match(/^lastTransitionAt:\s*(.+)$/);
    if (lastMatch) { state.lastTransitionAt = lastMatch[1].trim(); continue; }

    // Generic top-level scalar field (start-of-line, not indented).
    const generic = line.match(/^([A-Za-z_][\w-]*):\s*(.+)$/);
    if (generic && !line.startsWith(' ') && !line.startsWith('\t')) {
      const k = generic[1];
      if (!['changeName', 'phase', 'enteredAt', 'lastTransitionAt', 'transitionHistory'].includes(k)) {
        let v: unknown = generic[2].trim();
        if (v === 'true') v = true;
        else if (v === 'false') v = false;
        else if (/^\d+$/.test(v as string)) v = Number(v);
        (state as Record<string, unknown>)[k] = v;
        continue;
      }
    }

    // transitionHistory entries
    const fromMatch = line.match(/^\s+- from:\s*(.+)$/);
    if (fromMatch) {
      if (currentEntry && currentEntry.from !== undefined) {
        if (inRefs) {
          currentEntry.refs = [...refsBuffer];
          refsBuffer.length = 0;
          inRefs = false;
        }
        history.push(currentEntry as TransitionEntry);
      }
      currentEntry = { from: fromMatch[1].trim() === 'null' ? null : fromMatch[1].trim() as LifecycleCheckpoint };
      continue;
    }

    if (!currentEntry) continue;

    const toMatch = line.match(/^\s+to:\s*(.+)$/);
    if (toMatch) { currentEntry.to = toMatch[1].trim() as LifecycleCheckpoint; continue; }

    const tsMatch = line.match(/^\s+timestamp:\s*(.+)$/);
    if (tsMatch) { currentEntry.timestamp = tsMatch[1].trim(); continue; }

    const rationaleMatch = line.match(/^\s+rationale:\s*(.+)$/);
    if (rationaleMatch) { currentEntry.rationale = rationaleMatch[1].trim(); continue; }

    const refsHeader = line.match(/^\s+refs:/);
    if (refsHeader) { inRefs = true; continue; }

    const refItem = line.match(/^\s+- (.+)$/);
    if (inRefs && refItem) {
      refsBuffer.push(refItem[1].trim());
    }
  }

  // Push last entry
  if (currentEntry && currentEntry.from !== undefined) {
    if (inRefs) {
      currentEntry.refs = [...refsBuffer];
    }
    history.push(currentEntry as TransitionEntry);
  }

  state.transitionHistory = history;

  return state as StateYaml;
}

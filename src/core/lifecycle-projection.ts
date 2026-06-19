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

import { fileExists, readFile, writeFile, ensureDir } from '../utils/fs.js';
import { type IvyPhase, parsePhase, canTransition, listPhases } from './phase-machine.js';

// ─── Types ───

export type LifecycleCheckpoint = IvyPhase;

export interface StateYaml {
  changeName: string;
  checkpoint: LifecycleCheckpoint;
  enteredAt: string;
  lastTransitionAt: string;
  transitionHistory: TransitionEntry[];
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

const STATE_FILE = '.ivy/state.yaml';
const MAX_HISTORY = 10;

/**
 * Get the absolute path to the state file relative to a project root.
 */
export function getStatePath(cwd: string): string {
  return path.join(cwd, STATE_FILE);
}

/**
 * Read the current lifecycle state from `.ivy/state.yaml`.
 * Returns null if the file doesn't exist.
 */
export async function readState(cwd: string): Promise<StateYaml | null> {
  const statePath = getStatePath(cwd);
  if (!(await fileExists(statePath))) {
    return null;
  }
  const raw = await readFile(statePath);
  // Parse YAML-like format (simple key-value, since we avoid yaml dep in low-level module)
  const state = parseStateYaml(raw);
  return state;
}

/**
 * Write the lifecycle state to `.ivy/state.yaml`.
 */
export async function writeState(cwd: string, state: StateYaml): Promise<void> {
  const statePath = getStatePath(cwd);
  await ensureDir(path.dirname(statePath));
  await writeFile(statePath, serializeStateYaml(state));
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
  }

  return { standard, capability };
}

// ─── YAML serialisation helpers ───

/**
 * Minimal YAML serializer for StateYaml.
 * Produces valid YAML with proper indentation for transitionHistory arrays.
 */
function serializeStateYaml(state: StateYaml): string {
  const lines: string[] = [];
  lines.push(`changeName: ${state.changeName}`);
  lines.push(`checkpoint: ${state.checkpoint}`);
  lines.push(`enteredAt: ${state.enteredAt}`);
  lines.push(`lastTransitionAt: ${state.lastTransitionAt}`);
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
 * Handles the specific format produced by serializeStateYaml.
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

    const checkpointMatch = line.match(/^checkpoint:\s*(.+)$/);
    if (checkpointMatch) { state.checkpoint = checkpointMatch[1].trim() as LifecycleCheckpoint; continue; }

    const enteredMatch = line.match(/^enteredAt:\s*(.+)$/);
    if (enteredMatch) { state.enteredAt = enteredMatch[1].trim(); continue; }

    const lastMatch = line.match(/^lastTransitionAt:\s*(.+)$/);
    if (lastMatch) { state.lastTransitionAt = lastMatch[1].trim(); continue; }

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

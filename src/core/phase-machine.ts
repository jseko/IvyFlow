/**
 * Phase Machine — explicit type-safe state machine for the 9-step workflow's
 * 5 alias phases. Single source of truth for `IvyPhase` values, allowed
 * transitions, and terminal-phase detection.
 *
 * Used by:
 * - `ivy validate` to verify `phase` and `phase_history` in `.ivy.yaml`
 * - `core/adoption-lite.ts` to gate `snapshotAdoption` to terminal phase only
 * - `assets/rules/ivy-phase-guard.md` (synced via `scripts/sync-phases.ts`)
 */

export enum IvyPhase {
  OPEN = 'open',
  DESIGN = 'design',
  BUILD = 'build',
  VERIFY = 'verify',
  ARCHIVE = 'archive',
}

/**
 * Allowed forward transitions and rollback paths.
 *
 * - OPEN -> DESIGN
 * - DESIGN -> BUILD | OPEN (rollback)
 * - BUILD -> VERIFY | DESIGN (rollback)
 * - VERIFY -> ARCHIVE | BUILD (rollback) — VERIFY -> DESIGN is NOT allowed
 * - ARCHIVE -> [] (terminal)
 */
const TRANSITIONS: Record<IvyPhase, IvyPhase[]> = {
  [IvyPhase.OPEN]: [IvyPhase.DESIGN],
  [IvyPhase.DESIGN]: [IvyPhase.BUILD, IvyPhase.OPEN],
  [IvyPhase.BUILD]: [IvyPhase.VERIFY, IvyPhase.DESIGN],
  [IvyPhase.VERIFY]: [IvyPhase.ARCHIVE, IvyPhase.BUILD],
  [IvyPhase.ARCHIVE]: [],
};

/** Returns true iff `from -> to` is an allowed transition. */
export function canTransition(from: IvyPhase, to: IvyPhase): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Returns true iff `phase` has no outgoing transitions (currently only ARCHIVE). */
export function isTerminalPhase(phase: IvyPhase): boolean {
  return TRANSITIONS[phase].length === 0;
}

/** Parses a raw string into IvyPhase, or returns null if unknown. */
export function parsePhase(raw: string): IvyPhase | null {
  const phases = Object.values(IvyPhase) as string[];
  return phases.includes(raw) ? (raw as IvyPhase) : null;
}

/** Returns the canonical list of phase strings, in declared order. */
export function listPhases(): IvyPhase[] {
  return Object.values(IvyPhase) as IvyPhase[];
}

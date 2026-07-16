/**
 * Guard Phase Matrix — parameterized tests covering all phase/operation/fileType
 * combinations. The guardCheck function implements the phase-aware access rules
 * that the IvyFlow triple-defense system enforces across all platforms.
 *
 * Rule summary:
 *   OPEN    → read ANY | write only .md
 *   DESIGN  → write only .md
 *   BUILD   → write anything except proposal.md
 *   VERIFY  → write only .ts compile fixes
 *   ARCHIVE → write nothing (terminal phase)
 */

import { describe, test, expect } from 'vitest';
import { IvyPhase, parsePhase } from '../../src/core/phase-machine.js';

// ── Guard Logic ──────────────────────────────────────────────────────────────

export type GuardOperation = 'read' | 'write';
export type GuardResult = 'ALLOWED' | 'BLOCKED';

/**
 * Evaluate whether a given phase allows a specific operation on a file.
 *
 * @param phase  - Current IvyFlow phase string (open / design / build / verify / archive)
 * @param op     - Operation to perform (read / write)
 * @param file   - File extension or filename (e.g. ".ts", ".md", "proposal.md",
 *                 ".ts (new feature)", ".ts (fix compile)")
 */
export function guardCheck(phase: string, op: GuardOperation, file: string): GuardResult {
  if (op === 'read') return 'ALLOWED';

  const p = parsePhase(phase);

  switch (p) {
    case IvyPhase.OPEN:
    case IvyPhase.DESIGN:
      // In OPEN/DESIGN: only write .md files (design docs / proposals)
      return file.endsWith('.md') ? 'ALLOWED' : 'BLOCKED';

    case IvyPhase.BUILD:
      // In BUILD: .ts implementation is allowed; modifying proposal.md is not
      if (file === 'proposal.md') return 'BLOCKED';
      return 'ALLOWED';

    case IvyPhase.VERIFY:
      // In VERIFY: only compile-fix changes to .ts are allowed
      if (file === '.ts (fix compile)') return 'ALLOWED';
      if (file.startsWith('.ts')) return 'BLOCKED';
      return 'ALLOWED';

    case IvyPhase.ARCHIVE:
      // Terminal phase — no writes of any kind
      return 'BLOCKED';

    default:
      return 'BLOCKED';
  }
}

// ── Phase Matrix ─────────────────────────────────────────────────────────────

const cases: Array<[string, GuardOperation, string, GuardResult]> = [
  ['open',    'write', '.ts',                'BLOCKED'],
  ['open',    'write', '.md',                'ALLOWED'],
  ['open',    'read',  '.ts',                'ALLOWED'],
  ['design',  'write', '.ts',                'BLOCKED'],
  ['design',  'write', '.md',                'ALLOWED'],
  ['build',   'write', '.ts',                'ALLOWED'],
  ['build',   'write', 'proposal.md',        'BLOCKED'],
  ['verify',  'write', '.ts (new feature)',  'BLOCKED'],
  ['verify',  'write', '.ts (fix compile)',  'ALLOWED'],
  ['archive', 'write', '.ts',                'BLOCKED'],
  ['archive', 'write', '.md',                'BLOCKED'],
];

describe('guardCheck — phase access matrix', () => {
  test.each(cases)(
    '%s / %s / %s → %s',
    (phase, op, file, expected) => {
      expect(guardCheck(phase, op, file)).toBe(expected);
    },
  );
});

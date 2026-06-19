/**
 * Workflow Evidence — v0.13 transition rationale + refs.
 *
 * Records why a checkpoint transition happened and what v0.12 EvidenceRecords
 * support it. Stored in transitionHistory — not a separate evidence system.
 *
 * Design constraints (design.md D4):
 *   - No new Evidence types: only { transition, rationale, refs[] }
 *   - refs[] points to v0.12 EvidenceRecord IDs
 *   - No custom types like compile_pass / test_pass
 */

// ─── Types ───

export interface WorkflowEvidenceEntry {
  transition: string;           // e.g., 'open→design'
  rationale: string;            // natural language reason
  refs: string[];               // v0.12 EvidenceRecord IDs
  timestamp: string;
}

export interface WorkflowEvidenceReport {
  changeName: string;
  entries: WorkflowEvidenceEntry[];
  totalTransitions: number;
  documentedTransitions: number;  // transitions with non-empty rationale
}

// ─── Build report from transition entries ───

export function buildWorkflowEvidenceReport(
  changeName: string,
  entries: WorkflowEvidenceEntry[],
): WorkflowEvidenceReport {
  const documented = entries.filter((e) => e.rationale && e.rationale.trim().length > 0);
  return {
    changeName,
    entries,
    totalTransitions: entries.length,
    documentedTransitions: documented.length,
  };
}

/**
 * Check if the workflow evidence is complete for archive.
 * All transitions must have non-empty rationale and refs.
 */
export function checkArchiveReadiness(report: WorkflowEvidenceReport): {
  ready: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  for (const entry of report.entries) {
    if (!entry.rationale || entry.rationale.trim().length === 0) {
      issues.push(`Transition "${entry.transition}" has no rationale`);
    }
    if (!entry.refs || entry.refs.length === 0) {
      issues.push(`Transition "${entry.transition}" has no evidence refs`);
    }
  }

  return {
    ready: issues.length === 0,
    issues,
  };
}

---
name: ivy-design
description: IvyFlow Phase 2: Deep Design — brainstorm through Superpowers, run delta spec checklist, generate handoff context, and guard transition to build phase.
---

# IvyFlow Phase 2: Deep Design

## Steps

### 0. Entry State Verification

```bash
ivy state show --change "<name>"
```

Verify current phase is `design`. Verify open-phase artifacts exist:

```bash
ls openspec/changes/<name>/proposal.md openspec/changes/<name>/design.md openspec/changes/<name>/tasks.md
```

If missing, stop and prompt to run `/ivyflow-open` first.

### 0.5. Check Project Memory

```bash
ivy memory status
```

Review only decisions, constraints, and risks relevant to the change's domain. Do NOT read all memory records — limit to records matching the module or area being designed. Reference relevant ADRs in the design doc.

### 1. Generate Context Handoff

```bash
ivy handoff "<change-name>" design --write
```

Creates `design-context.json` (machine index) and `design-context.md` (human-readable context).

### 2. Execute Brainstorming

Verify context completeness using `references/context-six-questions.md`. Load Superpowers `brainstorming` skill — **skipping this step is prohibited**. If unavailable, stop and prompt to install Superpowers.

Provide context: Change name, design-context.md, design-context.json.

### 3. User Confirms Design (Blocking Point)

After brainstorming, pause for user confirmation: technical approach, trade-offs, testing strategy, spec patches. Run spec quality check via `references/spec-quality-check.md`.

### 4. Delta Spec Completeness Checklist

Run the 5-category delta spec completeness check (Input Boundaries / External Dependency Exceptions / Partial Failure Degradation / Security Defaults / Multi-Path Guards). Record in `.ivy/handoff/delta-spec-checklist.md`.

For each category marked `missing`: write missing scenarios to `specs/*/spec.md`.

### 5. Create Design Doc

Create at `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`. Reference `@references/deliverable.md` for format requirements.

### 6. Update State

```bash
ivy state set design_doc "docs/superpowers/specs/YYYY-MM-DD-topic-design.md"
```

If delta spec modified, regenerate handoff: `ivy handoff "<change-name>" design --write`

### 7. Guard and Transition

```bash
ivy guard design --apply
```

Guard checks: handoff_context exists, handoff_hash matches, delta-spec-checklist.md exists.

### 8. Resolve Next Skill

```bash
ivy next "<change-name>"
```

If `NEXT: auto, SKILL: ivy-build`, automatically load `ivy-build`.

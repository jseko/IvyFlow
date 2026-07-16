---
name: ivy-build
description: IvyFlow Phase 3: Build — execute implementation tasks through Superpowers executing-plans or subagent-driven-development, with writing-plans, TDD enforcement, and two-stage code review.
---

# IvyFlow Phase 3: Build

## Steps

### 0. Entry State Verification

```bash
ivy state show --change "<name>"
```

Verify current phase is `build`. Check `build_mode`, `isolation`, and `tdd_mode` are configured.

### 1. Select Execution Mode (Blocking Point)

Read `build_mode` from `.ivy/state.yaml`. If not set, ask user to choose:

- **executing-plans** (default): Main session executes inline. Loads Superpowers `executing-plans`.
- **subagent-driven-development**: Main session coordinates only. Loads Superpowers `subagent-driven-development`.
- **direct**: Direct execution. Only for hotfix/tweak workflows.

### 2. Generate Implementation Plan

For executing-plans and subagent-driven-development, load Superpowers `writing-plans` skill. Provide Design Doc and tasks.md. Append plan output as HTML comments below each task:

```markdown
- [ ] 1.1 Implement user service
<!-- file: src/services/user.ts, verify: npm test -- user.service -->
```

If `writing-plans` is unavailable, fall back to tasks.md descriptions.

### 3. Load Execution Skill

- **executing-plans**: Load Superpowers `executing-plans`
- **subagent-driven-development**: Load Superpowers `subagent-driven-development`
- **TDD mode** (`tdd_mode: tdd`): Load Superpowers `test-driven-development`

### 4. Execute Tasks with Two-Stage Review

For each pending task in dependency order:

**Execution:** Mark in-progress, execute per loaded skill.

**Stage 1 — Spec Compliance:** Verify all `#### Scenario:` entries in `specs/` are implemented. Record in `.ivy/review/<task-id>-spec-review.md`.

**Stage 2 — Code Quality:** Check naming, function length, security patterns. Apply `references/crud-quality-gate.md` for CRUD code. Apply `ivy-security.md` for garbage code patterns. Record in `.ivy/review/<task-id>-quality-review.md`.

**Review Retry:** Max 3 review-fix cycles per task. After 3 failures, mark as `review_blocked`.

**Task Completion:** Check off in tasks.md.

**On failure:** Load Superpowers `systematic-debugging`. Follow `references/minimal-fix-rules.md`. Max 3 retries, then BLOCKED.

### 5. Subagent Context Isolation

For subagent-driven-development, each subagent receives max 5 context items: task entry, relevant spec scenarios, relevant design doc section, current code files (max 5), shared utilities. Verify subagent only modified declared files.

### 6. Guard and Transition

```bash
ivy guard build --apply
```

### 7. Resolve Next Skill

```bash
ivy next "<change-name>"
```

If `NEXT: auto, SKILL: ivy-verify`, load `ivy-verify`.

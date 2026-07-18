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

### 1. Select Execution Mode (Blocking Point — Developer Decision Required)

Read `build_mode` from `.ivy/state.yaml`. If not set, ask the user to choose:

- **executing-plans** (default for full workflow): Main session executes tasks inline. Loads Superpowers `executing-plans` skill. Suitable for changes with clear, sequential task dependencies.
- **subagent-driven-development**: Main session coordinates only. Each task dispatched to a fresh background agent with isolated context. Loads Superpowers `subagent-driven-development` skill. Suitable for changes with independent, parallelizable tasks.
- **direct**: Direct execution. Only for hotfix/tweak workflows by default. No Superpowers skills loaded.

### 2. Generate Implementation Plan

**For executing-plans and subagent-driven-development** (skip for `direct` mode):

Use the Skill tool to load the Superpowers `writing-plans` skill.

Provide the Design Doc and tasks.md as input. The writing-plans skill will:
- Break each task into exact file paths to create/modify
- Define verification steps for each task (what test to run, what behavior to check)
- Identify task dependencies not yet captured in tasks.md

Append the plan output as HTML comments below each task in tasks.md:

```markdown
- [ ] 1.1 Implement user service
<!-- file: src/services/user.ts, verify: npm test -- user.service, check: CRUD operations work -->
```

If the Superpowers `writing-plans` skill is unavailable, fall back to using tasks.md task descriptions directly. Do not block the workflow.

### 3. Load Execution Skill

**For executing-plans**: Use the Skill tool to load the Superpowers `executing-plans` skill.

**For subagent-driven-development**: Use the Skill tool to load the Superpowers `subagent-driven-development` skill.

**For TDD mode** (`tdd_mode: tdd`): Use the Skill tool to load the Superpowers `test-driven-development` skill.

### 4. Execute Tasks with Two-Stage Review

Read `tasks.md` and execute each pending task in dependency order. For each task, follow the full cycle:

**Execution:**
1. Mark task as in-progress: `ivy state set task <task-id> in_progress`
2. Execute per the loaded skill's instructions

**Stage 1 — Spec Compliance Review:**
After the task implementation completes, verify it against the specs:
- Check all `#### Scenario:` entries in `specs/` related to this task are implemented
- Verify boundary conditions match Design Doc decisions
- If any scenario is missing, mark as `spec_gap` and block further tasks

Record results in `.ivy/review/<task-id>-spec-review.md`:
```markdown
# Spec Review: <task-id>
- Task: <subject>
- Date: <YYYY-MM-DD>
- Spec scenarios covered: N/N
- Gaps: <list or "None">
- Verdict: PASS / SPEC_GAP
```

**Stage 2 — Code Quality Review:**
After spec review passes, check code quality:
- Naming conventions and code structure
- Function length and cyclomatic complexity
- Security patterns (XSS prevention, SQL injection prevention, input validation)
- For CRUD code: apply the 7-item checklist in `references/crud-quality-gate.md`
- For any code: check for 5 garbage code patterns in rules `ivy-security.md` (hallucinated API, pseudo-refactoring, context contamination, technical debt contagion, silent degradation)
- TDD evidence: test file exists and covers core paths

Grade issues: **CRITICAL** / **HIGH** / **MEDIUM** / **LOW**

Record results in `.ivy/review/<task-id>-quality-review.md`:
```markdown
# Quality Review: <task-id>
- Task: <subject>
- Date: <YYYY-MM-DD>
- Issues found: N
- Critical: <count>
- Verdict: PASS / NEEDS_FIX
```

**Review Retry Limit:**
- If either review stage fails, fix the issues and re-review
- Maximum **3 review-fix cycles** per task
- After 3 failures, mark the task as `review_blocked` and continue to the next task
- Record all findings for manual resolution

**Task Completion:**
- Mark task as complete: `ivy state set task <task-id> completed`
- Check off in tasks.md: `- [x] <task-id>`

**If a task fails (execution error, not review):**
- For **executing-plans**: Use the Skill tool to load the Superpowers `systematic-debugging` skill before attempting fixes
- For **subagent-driven-development**: Dispatch a fix agent
- Follow the five iron laws in `references/minimal-fix-rules.md`: only fix the error, no new deps, verify tests, max 3 rounds, explain changes
- Maximum 3 retries per task, then mark as BLOCKED

### 5. Subagent Context Isolation

When using `subagent-driven-development` mode, each subagent MUST receive only the context relevant to its assigned task:

**Required context (5 items max):**
1. The task's tasks.md entry and writing-plans supplement (`<!-- file: ..., verify: ... -->`)
2. Relevant `#### Scenario:` entries from `specs/` — only those related to this specific task
3. Relevant sections from Design Doc — only the chapter/section related to this task
4. Current code files the task will modify (max 5 files)
5. Any shared utilities or types the task depends on

**Prohibited context:**
- Other tasks' descriptions or implementation details
- The main session's full conversation history
- Spec scenarios unrelated to this task

**Scope verification after subagent returns:**
- Check that the subagent only modified files declared in writing-plans `file_path` range
- If files outside the declared range were modified, mark as `scope_violation`
- Require the subagent to explain why the out-of-scope change was necessary
- Record the violation in the review report

### 6. Guard and Transition

```bash
ivy guard build --apply
```

Guard checks: isolation selected, build_mode selected, all tasks checked, all review reports exist, build passes (if build_command configured).

### 7. Resolve Next Skill

```bash
ivy next "<change-name>"
```

If `NEXT: auto, SKILL: ivy-verify`, automatically load the `ivy-verify` skill.

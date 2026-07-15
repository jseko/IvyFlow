---
name: ivy-verify
description: IvyFlow Phase 4: Verify — run quality gates, generate verification report, handle branch, and guard transition to archive.
---

# IvyFlow Phase 4: Verify

## Steps

### 0. Entry State Verification

```bash
ivy state show --change "<name>"
```

Verify current phase is `verify`.

### 1. Run Verification

Use the Skill tool to load the Superpowers `verification-before-completion` skill.

Follow its guidance to:
- Run all verification gates (compile, test, lint, coverage)
- Apply three-gate check (see `references/three-gate-check.md`): Gate 2 for build→verify, Gate 3 for verify→archive
- Generate verification report
- Record results in `.ivy/verify/`

### 2. Handle Verification Result

**If all gates pass**:
- Set `verify_result: pass`:
  ```bash
  ivy state set verify_result pass
  ```
- Record `verification_report` path:
  ```bash
  ivy state set verification_report ".ivy/verify/report.md"
  ```

**If verification fails** (Blocking Point — Developer Decision Required):
- Pause and ask user: "Fix issues" or "Accept deviation"
- If "Fix issues": transition back to build phase, load `ivy-build`
- If "Accept deviation": record rationale and continue

### 3. Handle Branch

Use the Skill tool to load the Superpowers `finishing-a-development-branch` skill.

Follow its guidance to merge, create PR, or push the branch.

Set `branch_status: handled`:
```bash
ivy state set branch_status handled
```

### 4. Guard and Transition

```bash
ivy guard verify --apply
```

Guard checks: verification_report exists, branch_status handled, verify passes (if verify_command configured).

### 5. Resolve Next Skill

```bash
ivy next "<change-name>"
```

If `NEXT: auto, SKILL: ivy-archive`, automatically load the `ivy-archive` skill.

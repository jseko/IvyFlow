---
name: ivy-archive
description: IvyFlow Phase 5: Archive — run OpenSpec archive, verify spec integrity, and complete the change lifecycle.
---

# IvyFlow Phase 5: Archive

## Steps

### 0. Entry State Verification

```bash
ivy state show --change "<name>"
```

Verify current phase is `archive`.

### 1. Final Confirmation (Blocking Point — Developer Decision Required)

Before archiving, present a summary and ask for final confirmation:
- Change name and description
- Tasks completed
- Verification result
- Files affected

**Options**:
- "Confirm archive" — proceed with archive
- "Cancel" — return to verify phase for adjustments

### 2. Run OpenSpec Archive

```bash
openspec archive "<change-name>" --yes
```

This merges delta specs into main specs and moves the change to the archive directory.

### 3. Verify Archive Integrity

Confirm the change has been moved to `openspec/changes/archive/`:
```bash
ls openspec/changes/archive/ | grep "<change-name>"
```

### 4. Guard and Transition

```bash
ivy guard archive --apply
```

Guard checks: archived flag set, proposal.md and design.md exist, all tasks checked.

### 5. Cleanup

```bash
ivy worktree cleanup "<change-name>"
```

### 6. Complete

```bash
ivy next "<change-name>"
```

Should output: `NEXT: done`. The change lifecycle is complete.

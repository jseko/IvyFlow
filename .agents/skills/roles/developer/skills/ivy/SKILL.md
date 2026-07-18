---
name: ivy
description: IvyFlow workflow enforcer skill — dispatches to per-phase skills based on .ivy/state.yaml checkpoint.
---

# IvyFlow Workflow Skill

IvyFlow drives a complete development loop from requirement input to archival.
This dispatcher detects the current phase and routes to the appropriate per-phase skill.

## Phase Detection

Run to detect current phase:

```bash
ivy state show
```

## Phase Router

| Current Phase | Skill to Load | Description |
|---------------|---------------|-------------|
| `open` | `ivy-open` | Create change structure through OpenSpec |
| `design` | `ivy-design` | Brainstorming through Superpowers, generate handoff |
| `build` | `ivy-build` | Execute tasks via executing-plans or subagent-driven-dev |
| `verify` | `ivy-verify` | Quality gates, verification report, branch handling |
| `archive` | `ivy-archive` | OpenSpec archive, spec merge, cleanup |

## Workflow Chain

```
open → design → build → verify → archive
```

After each phase guard passes, use `ivy next` to determine the next skill:

```bash
ivy next "<change-name>"
```

## Quick Reference

| Command | Purpose |
|---------|---------|
| `ivy state show` | Show current phase and state |
| `ivy guard <phase> --apply` | Validate and advance to next phase |
| `ivy next <change-name>` | Resolve next skill to load |
| `ivy handoff <change-name> <phase> --write` | Generate context package |

## Constraints

1. Phase order: open → design → build → verify → archive. No skipping.
2. Document before code: no code edits in open or design phases.
3. Guard checks are hard-blocking — failures prevent phase advancement.
4. Always run `ivy next` after guard to get the next skill.
5. User decision points (design confirmation, archive confirmation) must be explicitly confirmed.

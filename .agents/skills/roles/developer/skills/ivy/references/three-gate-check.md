# Three-Gate Quality Check

Three mandatory quality gates with risk-based classification. Each gate has items classified as 60% auto-pass / 30% human-confirm / 10% must-human.

## Gate 1 — Proposal Confirmation (Open → Design)

Check before transitioning from open to design phase.

| # | Check | Risk | Auto? |
|---|-------|------|:---:|
| 1 | Requirements are clearly stated | must-human | ❌ |
| 2 | Scope is bounded with explicit non-goals | human-confirm | ❌ |
| 3 | Acceptance criteria are testable | human-confirm | ❌ |
| 4 | Tech constraints identified (language, framework, dependencies) | auto | ✅ |
| 5 | Business constraints identified (regulatory, SLA, data privacy) | must-human | ❌ |
| 6 | No silent assumptions (AI didn't add features not requested) | human-confirm | ❌ |
| 7 | Tasks granularity is 30-90 minutes each | auto | ✅ |

## Gate 2 — Function Confirmation (Build → Verify)

Check before transitioning from build to verify phase. Maximum 3 fix rounds.

| # | Check | Risk | Auto? |
|---|-------|------|:---:|
| 1 | All spec scenarios have corresponding implementation | auto | ✅ |
| 2 | Build passes (compile + test) | auto | ✅ |
| 3 | All task review reports exist (spec + quality) | auto | ✅ |
| 4 | No scope creep (files changed match tasks.md scope) | human-confirm | ❌ |
| 5 | Security patterns verified (no innerHTML, no raw SQL) | auto | ✅ |
| 6 | Fix rounds ≤ 3 per task | auto | ✅ |
| 7 | All tasks checked in tasks.md | auto | ✅ |

## Gate 3 — Archive Confirmation (Verify → Archive)

Check before final archive. Requires human confirmation.

| # | Check | Risk | Auto? |
|---|-------|------|:---:|
| 1 | Verification report complete with all gates passed | auto | ✅ |
| 2 | Branch handled (merged, PR created, or pushed) | auto | ✅ |
| 3 | Delta specs synced to main specs | auto | ✅ |
| 4 | Knowledge extracted (ADR, decisions, constraints) | human-confirm | ❌ |
| 5 | Worktree cleaned up | auto | ✅ |
| 6 | Final archive confirmation | must-human | ❌ |

## Risk Classification Rules

- **60% auto**: Deterministic checks (file exists, build passes, tasks checked). No human input needed.
- **30% human-confirm**: Requires judgment (scope creep, knowledge extraction quality). AI recommends, human confirms.
- **10% must-human**: Cannot be automated (requirements clarity, business constraints, final archive). Human must explicitly approve.

## 3-Round Fix Iteration Limit

For Gate 2, each task has a maximum of 3 review-fix cycles:
1. Round 1: Initial review → fix
2. Round 2: Re-review → fix
3. Round 3: Final review → fix or mark as `review_blocked`

After 3 rounds, mark the task as `review_blocked` and escalate to human. Do not attempt a 4th automated fix.

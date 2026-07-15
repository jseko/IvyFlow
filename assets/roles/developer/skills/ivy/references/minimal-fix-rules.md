# Minimal Fix Rules — Five Iron Laws

When fixing code issues found during review or testing, follow these five iron laws.

## Law 1: Only Fix the Error Code

**Rule**: Modify only the lines directly related to the reported error. Do not refactor adjacent code.

**Why**: Every line changed is a new potential bug. Focused fixes are easier to review and revert.

## Law 2: No New Dependencies

**Rule**: Do not add new libraries, packages, or imports to fix an error. Use existing project dependencies.

**Why**: New dependencies introduce supply chain risk, version conflicts, and licensing issues.

## Law 3: Verify Existing Tests Pass

**Rule**: After the fix, run the full test suite. If any previously-passing test now fails, the fix is wrong.

**Why**: A fix that breaks existing behavior is worse than the original bug.

## Law 4: Maximum 3 Fix Rounds

**Rule**: If a fix fails review or testing 3 times, mark the task as BLOCKED and escalate to human.

**Why**: Beyond 3 rounds, the AI is guessing. Human judgment is needed.

## Law 5: Explain All Changes

**Rule**: Document what was changed, why it was changed, and how it was verified. Record in the review report.

**Why**: Without explanation, future reviewers cannot understand the fix context.

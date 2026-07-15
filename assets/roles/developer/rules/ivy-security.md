# Ivy Security Rules

## Credentials and Secrets (No Hardcoding)

- API Key patterns: `sk-[a-zA-Z0-9]{20,}`, `ghp_[a-zA-Z0-9]{36}`, `AKIA[A-Z0-9]{16}`
- Database connection strings: `jdbc://`, `mongodb://`, `postgresql://` (with password portion)
- Remediation: Use environment variables, e.g. `process.env.OPENAI_API_KEY`

## Personal Identifiable Information (PII)

- China mobile: `1[3-9]\d{9}`
- Email: `[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`
- Remediation: Confirm test data; mask production data

## Sensitive File Blacklist

Agents MUST NOT read or write:

- `.env`, `.env.*`, `.envrc`
- `credentials.json`, `credentials.toml`, `secrets.yaml`
- `*.pem`, `*.key`, `id_rsa`, `id_ed25519`
- `service-account.json`, `firebase-*.json`
- `terraform.tfvars`, `.aws/credentials`

## Important Notice

AI scanning is NOT equivalent to professional SAST tools (SonarQube, Checkmarx, etc.).
Production deployments MUST pass professional security review.

## Garbage Code Patterns — 5 Types to Detect

During code review, check for these five common AI-generated garbage code patterns:

### Pattern 1: Hallucinated API
**Symptom**: Code calls functions, methods, or APIs that don't exist in the project's dependencies.
**Example**: `import { useMagicHook } from 'react'` when React has no such export.
**Check**: Verify every import and API call exists in the project's actual dependencies.

### Pattern 2: Pseudo-Refactoring
**Symptom**: Code is restructured (renamed, moved, reformatted) without changing behavior. Appears to be a fix but isn't.
**Example**: Renaming variables and extracting functions but the bug logic remains unchanged.
**Check**: Diff should show meaningful logic changes, not just renames and reformats.

### Pattern 3: Context Contamination
**Symptom**: Code from one part of the project leaks into an unrelated change. Patterns from other files appear where they don't belong.
**Example**: Adding Redux patterns to a component that uses React Context.
**Check**: Verify the implementation pattern matches the module's existing conventions.

### Pattern 4: Technical Debt Contagion
**Symptom**: New code copies existing anti-patterns from the codebase instead of following best practices.
**Example**: Copying `any` type usage from legacy code into new TypeScript code.
**Check**: New code should follow best practices, not copy existing technical debt.

### Pattern 5: Silent Degradation
**Symptom**: Code compiles and passes tests but silently reduces quality (removes error handling, weakens validation, drops edge cases).
**Example**: Replacing `try/catch` with a bare call that silently swallows errors.
**Check**: Error handling and validation should be at least as thorough as before the change.

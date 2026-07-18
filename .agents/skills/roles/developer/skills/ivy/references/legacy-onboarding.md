# Legacy Project Onboarding

Guide for assessing and onboarding a legacy project into the IvyFlow workflow.

## Steps

### 1. Run Assessment

```bash
ivy assess
```

This scores the project across five dimensions (0-100 each):
- Documentation coverage
- Test coverage
- Comment quality
- Architecture clarity
- Dependency health

### 2. Review Assessment Results

For each dimension scoring below 60, identify specific gaps. The assessment report will list:
- Missing files (e.g., no README, no ARCHITECTURE.md)
- Low test coverage (< 40%)
- Missing or stale comments on public APIs
- Unclear module boundaries
- Outdated or vulnerable dependencies

### 3. Generate Four Core Documents

Based on the assessment, generate these four documents:

1. **PROJECT.md** — What this project does, who uses it, how to run it
2. **ARCHITECTURE.md** — Module structure, data flow, key design decisions
3. **TECH_STACK.md** — Language, framework, database, dependencies with versions
4. **CONVENTIONS.md** — Naming, file organization, error handling, testing patterns

### 4. Prioritize Technical Debt

Use the assessment scores to prioritize:
- Score < 30: Critical — must fix before adding new features
- Score 30-60: Important — fix incrementally with each change
- Score > 60: Healthy — maintain current level

### 5. Initialize IvyFlow

```bash
ivy init
```

After the four documents are created and reviewed, initialize IvyFlow to begin using the workflow.

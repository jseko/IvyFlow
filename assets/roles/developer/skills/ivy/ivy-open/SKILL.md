---
name: ivy-open
description: IvyFlow Phase 1: Open — create change structure through OpenSpec, initialize state, and guard transition to design phase.
---

# IvyFlow Phase 1: Open

## Steps

### 0. Entry State Verification

Verify the state machine is correctly initialized:

```bash
ivy state show --change "<name>"
```

### 0.5. Read Project Memory

```bash
ivy memory status
```

Review only records relevant to this change:
- **Decisions (ADR)**: Check for architecture decisions that constrain this change
- **Constraints**: Check for constraints that apply to the area being modified

Do NOT read all memory records — only those matching the change's domain or module. Use `ivy knowledge links` to find related records if memory-linking is enabled.

### 1. Create Change Structure

**Immediately execute:** Use the Skill tool to load the `openspec-new-change` skill. Skipping this step is prohibited.

After the skill loads, create the change skeleton, then generate artifacts one by one using the standard loop:

**Standard Artifact Loop** (for each: `proposal` → `design` → `tasks`):

1. Refresh status:
   ```bash
   openspec status --change "<name>" --json
   ```

2. Fetch artifact instructions:
   ```bash
   openspec instructions proposal --change "<name>" --json
   openspec instructions design --change "<name>" --json
   openspec instructions tasks --change "<name>" --json
   ```

3. For each instruction payload:
   - Read every completed dependency artifact listed in `dependencies`
   - Use `template` as the artifact structure
   - Follow `instruction` guidance
   - Apply `context` and `rules` as constraints — do NOT copy them into the artifact
   - Write to `resolvedOutputPath`
   - Verify the output file exists and is non-empty

**Failure handling**: If `openspec instructions` fails or returns invalid JSON, stop immediately and report the error. Do not fall back to hard-coded artifact prose.

### 2. Initialize State

```bash
ivy state init "<name>"
```

### 3. Content Completeness Check

Confirm the three documents have complete content:
- **proposal.md**: problem background, goals, scope, non-goals
- **design.md**: high-level architecture decisions, approach selection
- **tasks.md**: task list, each task has a clear description
- Run the 10-item spec quality check in `references/spec-quality-check.md` before proceeding to guard

### 4. User Review and Confirmation (Blocking Point — Developer Decision Required)

After the three documents are created, present the summary and ask for confirmation:

**Options**:
- "Confirm, proceed to next phase" — artifacts meet expectations
- "Needs adjustment" — modify and re-request confirmation

### 5. Guard and Transition

```bash
ivy guard open --apply
```

After guard passes, the state machine auto-advances to the design phase.

### 6. Resolve Next Skill

```bash
ivy next "<change-name>"
```

If output is `NEXT: auto, SKILL: ivy-design`, automatically load the `ivy-design` skill.
If output is `NEXT: manual`, display the hint and wait for user confirmation.

# Phase Entry — State Verification

All phase skills MUST begin with this step.

## Entry Verification

```bash
ivy state show --change "<name>"
```

Verify the current phase matches the expected phase for this skill.
If the phase does not match, stop and display the current state:

```
⚠️ Expected phase: <expected-phase>, Actual phase: <current-phase>
→ Run `ivy next "<change-name>"` to find the correct skill to load.
```

## Precondition Check

Verify that required artifacts from the previous phase exist:

```bash
ls openspec/changes/<name>/<required-file>
```

If any required file is missing, stop and prompt the user to return to the previous phase.

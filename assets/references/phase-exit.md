# Phase Exit — Guard and Transition

All phase skills MUST end with this step.

## Guard Check

```bash
ivy guard <phase> --apply
```

If the guard fails, display the failure reason and stop:

```
❌ Guard check failed: <reason>
→ Fix the issues above and re-run `ivy guard <phase> --apply`
```

## Resolve Next Skill

```bash
ivy next "<change-name>"
```

| Output | Action |
|--------|--------|
| `NEXT: auto, SKILL: <next-skill>` | Automatically load the `<next-skill>` skill |
| `NEXT: manual` | Display hint and wait for user confirmation |
| `NEXT: done` | The workflow is complete |

# User Confirmation — Blocking Point

Use this template for any step that requires explicit user approval before proceeding.

## Confirmation Template

Present a summary and ask for confirmation:

```
📋 <Phase> Summary:
- <Key decision or artifact summary 1>
- <Key decision or artifact summary 2>
- <Key decision or artifact summary 3>

Please confirm:
- [Confirm, proceed to next step] — <description>
- [Needs adjustment] — <description>
```

## Rules

1. Never proceed past a confirmation point without explicit user approval
2. Present options as a clear list with descriptions
3. If the user requests adjustments, make them and re-present for confirmation
4. Record confirmation decisions in `.ivy/state.yaml`:
   ```bash
   ivy state set <decision-key> "<value>"
   ```

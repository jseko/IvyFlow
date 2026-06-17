# IvyFlow

> **A Workflow Enforcer for AI Coding Agents.**

[简体中文](./README.zh-CN.md)

IvyFlow (`ivyflow-cli`) is a CLI that distributes Skills, Rules, and Git hooks to AI coding platforms (7 platforms in v0.2) so an AI agent is constrained to follow a structured **9-step development workflow** instead of jumping straight to writing code.

It is **not** an LLM runtime, **not** a SaaS. It is a thin local enforcer that ships alongside any AI coding tool.

---

## Why use it

LLM agents drift. Without external constraints they happily skip requirements analysis, invent designs as they go, and treat "implementation" as the first step. IvyFlow turns the workflow contract into something the agent **cannot ignore**:

- A versioned **Skill** describes the 9-step workflow the agent must follow.
- A **Rule** file pins the agent to a single phase at a time and forbids code edits during `open` / `design` / `archive`.
- A **Git pre-push hook** blocks pushes from any branch whose change is not in the terminal phase (`archive`).
- An explicit **TypeScript phase machine** is the single source of truth — the markdown rule is regenerated from the enum during build, so they cannot drift.

## Install

```bash
npm install -g ivyflow-cli
```

Requires Node.js ≥ 20 and `git` on `PATH`.

## Quickstart

In an existing project repo:

```bash
ivy init                 # quick mode (no prompts), the recommended default
ivy init --standard      # interactive wizard
ivy init --enterprise    # standard + reserved plugin slots (v0.1 is a no-op)
```

`ivy init` performs the following on the project:

1. Detects which of the 7 platforms are present and scores each with a confidence level (`1.0` = config file, `0.8` = rules dir, `0.6` = generic dir).
2. In `--standard` mode lets you multi-select platforms (defaults are pre-checked when confidence ≥ 0.8); in `--quick` mode auto-selects them.
3. Ensures `@fission-ai/openspec` is available when at least one selected platform exposes an OpenSpec tool id.
4. Copies the `ivy` Skill (4-block layout: ROUTER / CONSTRAINTS / VARIABLES / REFERENCES) into each platform's skills directory.
5. Renders the `ivy-phase-guard` + `ivy-security` Rules per platform: `.md` (Claude / CodeBuddy / Trae / Qoder), `.mdc` (Cursor), `.github/copilot-instructions.md` (GitHub Copilot).
6. Installs the Windsurf PreToolUse hook (`.windsurf/hooks/ivy-phase-guard.json`) when Windsurf is selected.
7. Installs `.git/hooks/pre-push` (the secondary defense).
8. Writes `.ivy/project.yaml` with `version: '0.3.0'`, `platforms[]`, `detected_platforms[]`, and `analytics_enabled: false`.

Then per change:

```bash
ivy status                         # show the current phase from .ivy/project.yaml
ivy status --change add-feature-x  # show phase + adoption snapshot for one change
ivy validate                       # verify phase history + security rules + sensitive filenames
ivy validate --security=false      # skip security checks
ivy doctor                         # local invariant health check (no telemetry / network)
ivy doctor --fix                   # re-create missing skill / rule / hook files (never rewrites existing)
ivy uninstall                      # safely remove IvyFlow files (asks for confirmation)
ivy uninstall --dry-run            # preview what would be removed
ivy uninstall --force              # skip confirmation (for CI)
ivy update                         # check npm for newer version, print upgrade command
ivy update --check                 # return exit code 0 (latest) or 1 (update available)
```

## What is in v0.3

- **6 commands**: `init` / `status` / `validate` / `doctor` / **`uninstall`** / **`update`**.
- **5 phases**: `open → design → build → verify → archive`. `verify → design` is deliberately **not** allowed.
- **7 platforms**: `claude`, `codebuddy`, `cursor`, `github-copilot`, `windsurf`, `trae`, `qoder`. Single `PlatformConfig` const array — no abstract `Platform` interface, no registry.
- **Per-platform rule rendering**: a 4-file `src/core/render/` directory with no IR, no Renderer interface, no transformer registry; `index.ts` is pure switch-forwarding (≤ 30 lines).
- **Windsurf PreToolUse hook**: rendered JSON wired into `init`; other platforms skip silently.
- **`ivy doctor`** with strict §9.4 boundary: no telemetry / network / state inference. `--fix` re-creates missing files only.
- **`ivy validate --security`** (default on): checks `ivy-security` rule presence per platform + scans for sensitive filenames (`.env`, `*.pem`, `id_rsa`, etc.). Zero file-content reads.
- **`ivy uninstall`** with `--dry-run`, `--force`, and idempotent removal. Git hook is surgically removed (IvyFlow section only); user custom content is preserved.
- **`ivy update`** check-only, prints upgrade command, never auto-installs. Offline graceful.
- **§9 evolution constraints** (CI-enforced): SKILL.md must stay 4 blocks each ≤ 50 lines; manifest schema is validated at build time; `render/` budget is policy-bound.
- **Backwards compatible**: v0.1/v0.2 `.ivy/project.yaml` is read transparently.

## Known limitations

- Adoption snapshots are computed from `git diff --shortstat <baseCommit>..HEAD` and are **always tagged `confidence: low`**. They do not distinguish AI-authored from human-authored lines.
- A snapshot can only be taken when the change phase is `archive`. There is no `--force-snapshot`.
- `ivy validate` outputs human-readable colored text only. No `--json` flag in v0.3.
- The pre-push hook can be bypassed with `git push --no-verify`. Treat the rule layer as the primary defense, the hook as a safety net.
- PreToolUse hooks are only emitted for **Windsurf** (the only platform with a stable contract today). The other 6 platforms rely on the Rule + Git hook layers.
- Analytics / session events / dashboard are deferred to v0.4 (data-source matrix insufficient: 6/7 platforms lack PreToolUse Hook).

## Phase machine

The canonical source is `src/core/phase-machine.ts`. Allowed transitions:

```
open    → design, build
design  → build, open
build   → verify, design
verify  → archive, build      (verify → design is NOT allowed)
archive → (terminal)
```

The build script regenerates the phase block in `assets/rules/ivy-phase-guard.md` from this enum. CI runs `npm run sync-phases:check` and fails on drift.

## Development

```bash
npm install
npm run build       # tsc + sync-phases + check-manifest + check-skill-blocks
npm test            # vitest
npm run lint        # eslint flat config
npm run sync-phases:check
npm run check-manifest
npm run check-skill-blocks
```

Coverage thresholds: 80% global lines / branches / functions / statements; the phase machine is held to 100%. Current coverage: **92.51%** lines.

## License

MIT.

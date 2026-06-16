# IvyFlow

> **A Workflow Enforcer for AI Coding Agents.**

[简体中文](./README.zh-CN.md)

IvyFlow (`ivyflow-cli`) is a CLI that distributes Skills, Rules, and Git hooks to AI coding platforms (Claude Code in v0.1) so an AI agent is constrained to follow a structured **9-step development workflow** instead of jumping straight to writing code.

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

1. Detects the platform (v0.1: Claude Code).
2. Ensures `@fission-ai/openspec` is available (installs locally if missing).
3. Runs `openspec init --tools claude` to scaffold `openspec/`.
4. Copies the `ivy` Skill and `ivy-phase-guard` Rule into `.claude/`.
5. Installs `.git/hooks/pre-push` (the secondary defense).
6. Writes `.ivy/project.yaml`.

Then per change:

```bash
ivy status                         # show the current phase from .ivy/project.yaml
ivy status --change add-feature-x  # show phase + adoption snapshot for one change
ivy validate                       # verify every openspec/changes/*/.ivy.yaml has a legal phase history
```

## What is in v0.1

- **3 commands** only: `init` / `status` / `validate`.
- **5 phases**: `open → design → build → verify → archive`. The transitions `verify → design` and `force snapshot outside archive` are deliberately **not** allowed.
- **2 defense layers**: Rule (primary) + Git pre-push hook (secondary). The PreToolUse hook is intentionally deferred to v0.2.
- **1 platform**: Claude Code. Cursor / Windsurf / Copilot are Phase 2.
- **1 spec adapter**: `OpenSpecAdapter`. The `SpecAdapter` interface is the extension seam; the `IVY_SPEC_ADAPTER` env var is reserved but currently a no-op.

## Known limitations

- Adoption snapshots are computed from `git diff --shortstat <baseCommit>..HEAD` and are **always tagged `confidence: low`**. They do not distinguish AI-authored from human-authored lines.
- A snapshot can only be taken when the change phase is `archive`. There is no `--force-snapshot`.
- `ivy validate` outputs human-readable colored text only. No `--json` flag in v0.1.
- `ivy doctor` / `ivy uninstall` / `ivy update` are not in v0.1; deinstall by hand for now.
- The pre-push hook can be bypassed with `git push --no-verify`. Treat the rule layer as the primary defense, the hook as a safety net.

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
npm run build       # tsc + sync-phases
npm test            # vitest
npm run lint        # eslint flat config
npm run sync-phases:check
```

Coverage thresholds: 70% global lines / branches / functions / statements; the phase machine is held to 100%.

## License

MIT.

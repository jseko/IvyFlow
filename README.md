# IvyFlow

> **A Workflow Enforcer for AI Coding Agents.**

[简体中文](./README.zh-CN.md)

IvyFlow (`ivyflow-cli`) is a CLI that distributes Skills, Rules, and Git hooks to AI coding platforms (16 platforms in v0.10) so an AI agent is constrained to follow a structured **9-step development workflow** instead of jumping straight to writing code.

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

1. Detects which of the 16 platforms are present and scores each with a confidence level (`1.0` = config file, `0.8` = rules dir, `0.6` = generic dir).
2. In `--standard` mode lets you multi-select platforms (defaults are pre-checked when confidence ≥ 0.8); in `--quick` mode auto-selects them.
3. Ensures `@fission-ai/openspec` is available when at least one selected platform exposes an OpenSpec tool id.
4. Copies the `ivy` Skill (4-block layout: ROUTER / CONSTRAINTS / VARIABLES / REFERENCES) into each platform's skills directory.
5. Renders the `ivy-phase-guard` + `ivy-security` Rules per platform: `.md` (Claude / CodeBuddy / Trae / Qoder), `.mdc` (Cursor), `.github/copilot-instructions.md` (GitHub Copilot).
6. Installs PreToolUse hooks via typed TypeScript guard: Windsurf (`hooks/ivy-phase-guard.json`), Cursor (`.cursor/hooks.json`), Gemini CLI (`beforeTool` command `ivy validate`).
7. Installs `.git/hooks/pre-push` (the secondary defense).
8. Writes `.ivy/project.yaml` with `version: '0.10.0'`, `platforms[]`, `detected_platforms[]`, `analytics_enabled: false`, `project_knowledge`, `quality_gates`, and `fingerprint` sections.

Then per change:

```bash
ivy status                         # show the current phase from .ivy/project.yaml
ivy status --change add-feature-x  # show phase + adoption snapshot for one change
ivy validate                       # verify phase history + security rules + sensitive filenames
ivy validate --security=false      # skip security checks
ivy doctor                         # local invariant health check (no telemetry / network)
ivy doctor --fix                   # re-create missing skill / rule / hook files (never rewrites existing)
ivy doctor --platforms             # platform certification report (v0.8)
ivy doctor --environment           # tool presence check (Node.js, Git, Java, package manager) (v0.9)
ivy analytics                      # adoption metrics with data-source transparency
ivy analytics --bias               # show inference bias log (calibration actions)
ivy dashboard                      # interactive ASCII dashboard with trend charts
ivy dashboard --adr                # show ADR index (decision memory view) (v0.10)
ivy dashboard --memory             # show memory overview with type counts (v0.10)
ivy dashboard --team               # team-level cross-change aggregation (v0.8)
ivy dashboard --html --period 90d  # export as HTML report
ivy suggest                        # workflow suggestions (stuck/rollback/phase-review)
ivy suggest --json                 # JSON output with quality metrics
ivy suggest --mark-resolved <id>   # provide feedback on a suggestion
ivy suggest --calibrate            # run quality calibration (P80 threshold tuning)
ivy suggest --quality              # show suggestion quality dashboard
ivy review                         # interactive suggestion review (accept/dismiss/snooze)
ivy review --auto accept --type stuck  # batch accept all stuck suggestions
ivy check                          # non-blocking workflow health check for CI
ivy check --change add-feature-x --output markdown  # PR-friendly markdown report
ivy check --env                    # environment detection (Node.js, Git, etc.)
ivy explain                        # suggestion traceability (read-only, per §9.15)
ivy explain --id <id>              # trace a specific suggestion
ivy explain --change <name>        # batch trace by change
ivy rules                          # list and manage Advisor rules
ivy rules --info stuck_detection   # detailed rule info with effective config
ivy rules --override stuck_detection.build=25  # override a parameter (Derived Cache only)
ivy rules --remove stuck_detection.build      # remove an override
ivy archive --change <name>                   # archive a change with knowledge extraction (v0.9)
ivy archive --change <name> --adr              # generate detailed ADR entries (v0.10)
ivy archive --change <name> --no-extract       # skip knowledge extraction
ivy archive --change <name> --force            # archive from any phase
ivy archive --change <name> --action discard   # post-archive action (keep-state, discard, push-pr)
ivy verify --change <name>                    # quality gates: compile, test, task check, coverage (v0.9)
ivy verify --change <name> --gate compile      # run specific gate only
ivy verify --change <name> --skip coverage     # skip specific gate
ivy fingerprint                               # confidence-scored tech stack detection (v0.9)
ivy fingerprint --refresh                     # re-scan from scratch
ivy fingerprint --json                        # JSON output
ivy release --change <name>                   # bundle completed change artifacts (v0.9)
ivy release --change <name>                   # bundle completed change artifacts (v0.9)
ivy export metrics                           # export project data to JSON (v0.10)
ivy export metrics --pipe                    # stdout JSON output (pipe-friendly)
ivy export metrics --dimension changes       # export specific dimension only
ivy uninstall                      # safely remove IvyFlow files (asks for confirmation)
ivy uninstall --dry-run            # preview what would be removed
ivy uninstall --force              # skip confirmation (for CI)
ivy update                         # check npm for newer version, print upgrade command
ivy update --check                 # return exit code 0 (latest) or 1 (update available)
```

## What is in v0.10

- **21 commands**: `init` / `status` / `validate` / `doctor` / `analytics` / `dashboard` / `suggest` / `review` / `check` / `explain` / `rules` / `archive` / `verify` / `fingerprint` / `release` / `export` / `uninstall` / `update` (+ `--adr`, `--memory` flag expansions).
- **TypeScript PreToolUse Guard** — `PreToolUseGuard` class with typed evaluation pipeline (global block → phase rules → archive guard). Three decision types: `allow` / `block` / `warn`. `PlatformHookAdapter` interface with 3 implementations: Windsurf (JSON), Cursor (JSON), Gemini (CLI). Legacy v0.7-v0.9 hook config backward-compatible.
- **Memory Schema freeze** — `.ivy/memory/schema.yaml` with 5 record types (decision, constraint, risk, fact, evidence). `MemoryStore` class: write (validated YAML + JSON index), query (multi-condition filter), ADR view, memory overview.
- **ADR View** — `ivy dashboard --adr` renders decision records as ADR index. `ivy dashboard --memory` shows type-count overview. `ivy archive --adr` generates detailed ADR entries during archive.
- **Export API** — `ivy export metrics` with `--pipe` (stdout JSON), `--project` (multi-project), `--dimension` (changes/metrics/knowledge). Read-only: never modifies `.ivy/` state.
- **Community templates** — GitHub Issue templates (bug report, feature request), PR template, RFC template (`docs/rfc/`). CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md.
- **Gemini CLI PreToolUse hook** — Promoted from Experimental. Hook command changed from shell script to `ivy validate`.
- **517 passing tests** across 49 test files.
- **5 phases**: `open → design → build → verify → archive`.
- **16 platforms** (no change from v0.9).

## What is in v0.9

- **20 commands**: `init` / `status` / `validate` / `doctor` / `analytics` / `dashboard` / `suggest` / `review` / `check` / `explain` / `rules` / `archive` / `verify` / `fingerprint` / `release` / `uninstall` / `update` (+ `--platforms`, `--team`, `--environment` flag expansions).
- **Project Knowledge Foundation** — Three new deterministic project assets:
  - **Fingerprint** — Confidence-scored tech stack detection (1.0/0.9/0.8/0.7/0.6).
  - **Evidence** — Quality gates with structured evidence output.
  - **Knowledge** — Regex-only extraction from structured headings.
- **`ivy archive` (v0.9 rewrite)** — Knowledge extraction + L0 Memory integration. Scans proposal.md/design.md/tasks.md for Decisions, Constraints, Risks, and Facts. Writes `.ivy/knowledge/<change>.yaml` and `.ivy/memory/<change>/`.
- **`ivy verify`** — Quality gates: compile, test, task check (tasks.md), and coverage. Report-only (no auto-fix). Evidence written to `.ivy/evidence/<change>.yaml`. Error-tolerant: one gate failure doesn't block others.
- **`ivy fingerprint`** — Confidence-scored tech stack detection. Scans package.json, pom.xml, go.mod, Cargo.toml, pyproject.toml. Outputs project type, language, build tool, test framework, package manager, frontend/backend. Cached to `.ivy/fingerprint.yaml`. JSON output available.
- **`ivy release`** — Bundle completed change artifacts (archive report, knowledge, evidence, L0 memory) into `.ivy/releases/<change>/.` Validates ARCHIVE phase only. Manifest written as `release.yaml`.
- **`ivy doctor --environment`** — Tool presence checks: Node.js, Git, package manager (pnpm/yarn/npm), Java (if pom.xml found).
- **L0 Memory Model** — Raw facts layer: per-type YAML files (decisions.yaml, constraints.yaml, risks.yaml, facts.yaml) with {type, key, value, source, confidence, timestamp} format. Designed for v1.0 L1/L2 expansion.
- **Regex-only Knowledge Extraction** — 4 extractable types (decision, constraint, risk, fact). Forbidden: summary, recommendation, analysis. Deterministic, no AI, no inference.
- **Public Data Contract** — Add-only field policy for all `.ivy/*` YAML outputs. Forward-compatible with future schema versions.
- **project.yaml v0.9 schema** — New sections: `project_knowledge` (enabled, extractable_types), `quality_gates` (compile, test, task_check, coverage), `fingerprint` (auto_refresh). Backward-compatible with v0.8. (v0.8→v0.9 verified by test suite).
- **New Certified platforms**: Gemini CLI, RooCode.
- **New Experimental platforms**: Continue, Kilo Code, Auggie/Augment, Kimi Code, Lingma.
- **`rulesBaseDir`** — optional field for non-standard rule directories (e.g., Cline's `.clinerules/`).
- **Platform-driven detection** — `CONFIDENCE_BY_PATH` fully removed. `detectPlatforms` reads only `Platform.detectionPaths`.
- **3 Experimental Hook renderers** — Gemini (`beforeTool`), Qwen Code (`preToolUse`), Kiro (`hook/type`). Marked Experimental — no stability guarantee.
- **CI/CD templates** — `assets/ci/github-actions.yml` and `assets/ci/gitlab-ci.yml`. Manual copy only.
- **415 passing tests** across 38 test files.
- **5 phases**: `open → design → build → verify → archive`. `verify → design` is deliberately **not** allowed.
- **16 platforms**: `claude`, `cursor`, `github-copilot`, `windsurf`, `codebuddy`, `trae`, `qoder`, `cline`, `amazon-q`, `gemini-cli`, `roocode`, `continue`, `kilocode`, `auggie`, `kimi-code`, `lingma`. Single `PlatformConfig` const array — no abstract `Platform` interface, no registry.
- **Per-platform rule rendering**: a 5-file `src/core/render/` directory (≤ 30 lines `index.ts`).
- **Windsurf PreToolUse hook**: rendered JSON wired into `init`; other platforms skip silently.
- **`ivy suggest`** — workflow suggestion engine with stuck detection (phase thresholds), rollback detection (7d window), and phase review (duration vs historical avg). All suggestions are **advisory-only** (§9.9), carry **unique IDs** (§9.10), and support feedback via `--mark-resolved`.
- **Suggest Feedback Loop** — feedback stored in `.ivy/sessions/cache/suggestion_feedback.json`; quality metrics (acceptance rate by type) queryable via `--json`.
- **Suggest Feedback Loop** — feedback stored in `.ivy/sessions/cache/suggestion_feedback.json`; quality metrics (acceptance rate by type) queryable via `--json`.
- **Session inference calibration** — noise filtering (<1min single-event sessions), weekend detection, adjacent session merging (<5min gap), bias recording.
- **Derived Cache layer** — `.ivy/sessions/cache/` with 1h TTL for trend profiles, phase duration stats, and transition statistics. Not a numbered data layer.
- **Dashboard v2** — trend visualization (commit trend, phase duration bars, suggestion quality), HTML export with embedded metadata, period filtering. Dashboard is **display-only** — zero suggestion/reasoning logic.
- **`ivy analytics --bias`** — query inference bias log for calibration transparency.
- **§9 evolution constraints** (CI-enforced): SKILL.md must stay 4 blocks each ≤ 50 lines; manifest schema is validated at build time; `render/` budget is policy-bound.
- **Backwards compatible**: v0.1/v0.2/v0.3/v0.4/v0.5/v0.6/v0.7 `.ivy/project.yaml` is read transparently.

## Known limitations

- Adoption snapshots are computed from `git diff --shortstat <baseCommit>..HEAD` and are **always tagged `confidence: low`**. They do not distinguish AI-authored from human-authored lines.
- A snapshot can only be taken when the change phase is `archive`. There is no `--force-snapshot`.
- The pre-push hook can be bypassed with `git push --no-verify`. Treat the rule layer as the primary defense, the hook as a safety net.
- PreToolUse hooks are now emitted for **Windsurf, Cursor, and Gemini CLI** (typed TypeScript guards via PlatformHookAdapter). Other platforms rely on the Rule + Git hook layers.
- Session inference is based on a 30-minute heuristic and is calibrated but not validated against ground truth (no dataset ≥ 100 labels).
- Suggestions are rule-based (no ML). Effectiveness depends on threshold tuning and user feedback quality.
- Dashboard coverage estimate (~50%) is approximate — actual coverage depends on platform support.

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

Coverage thresholds: 80% global lines / branches / functions / statements; the phase machine is held to 100%. Current coverage: **88.5%** lines (517 tests across 49 files).

## License

MIT.

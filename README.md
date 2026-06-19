# IvyFlow

> **A Workflow Enforcer for AI Coding Agents.**

[简体中文](./README.zh-CN.md)

IvyFlow (`ivyflow-cli`) is a CLI that distributes Skills, Rules, and Git hooks to AI coding platforms (16 platforms in v0.11) so an AI agent is constrained to follow a structured **9-step development workflow** instead of jumping straight to writing code.

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
8. Writes `.ivy/project.yaml` with `version: '0.11.0'`, `platforms[]`, `detected_platforms[]`, `analytics_enabled: false`, `project_knowledge`, `quality_gates`, `fingerprint`, and `capabilities` sections.

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
ivy doctor --ecosystem             # capability detection: code_intelligence, documentation_lookup, spec_driven (v0.11)
ivy doctor --sync-kb               # sync managed reference to CLAUDE.md/CURSOR.md/WINDSURF.md (v0.11)
ivy analytics                      # adoption metrics with data-source transparency
ivy analytics --bias               # show inference bias log (calibration actions)
ivy dashboard                      # interactive ASCII dashboard with trend charts
ivy dashboard --adr                # show ADR index (decision memory view) (v0.10)
ivy dashboard --memory             # show memory overview with type counts (v0.10)
ivy dashboard --org <paths...>     # organization insights: multi-project aggregation (v0.11)
ivy dashboard --knowledge          # knowledge graph overview (v0.11)
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
ivy archive --change <name> --action discard   # post-archive action (keep-state, discard, push-pr)
ivy verify --change <name>                    # quality gates: compile, test, task check, coverage (v0.9)
ivy verify --change <name> --gate compile      # run specific gate only
ivy verify --change <name> --skip coverage     # skip specific gate
ivy verify --change <name> --gate evidence     # v0.12: evidence coverage gate
ivy verify --change <name> --min-evidence 75   # v0.12: custom evidence threshold
ivy audit evidence --change <name>             # v0.12: evidence coverage audit
ivy audit evidence --change <name> --json      # v0.12: audit as JSON
ivy audit evidence --change <name> --pipe      # v0.12: pipe-friendly JSON output
ivy trace <id>                                 # v0.12: trace knowledge links
ivy trace <id> --direction backward            # v0.12: backward trace
ivy trace <id> --impact                        # v0.12 (Experimental): impact estimation
ivy fingerprint                               # confidence-scored tech stack detection (v0.9)
ivy fingerprint --refresh                     # re-scan from scratch
ivy fingerprint --json                        # JSON output
ivy release --change <name>                   # bundle completed change artifacts (v0.9)
ivy release --change <name>                   # bundle completed change artifacts (v0.9)
ivy export metrics                           # export project data to JSON (v0.11)
ivy export metrics --pipe                    # stdout JSON output (pipe-friendly)
ivy export metrics --dimension changes       # export specific dimension only
ivy knowledge link --source <id> --target <id> --relation <type> --desc <txt>   # create knowledge link (v0.11)
ivy knowledge links <record-id>              # show links for a record (v0.11)
ivy knowledge traverse <record-id> --to <type>  # traverse knowledge graph (v0.11)
ivy knowledge unlink <record-id> --index <n>  # delete a knowledge link (v0.11)
ivy uninstall                      # safely remove IvyFlow files (asks for confirmation)
ivy uninstall --dry-run            # preview what would be removed
ivy uninstall --force              # skip confirmation (for CI)
ivy update                         # check npm for newer version, print upgrade command
ivy update --check                 # return exit code 0 (latest) or 1 (update available)
```

## What is in v0.13

- **Governed Execution** — v0.13 theme "Control" builds on v0.12 "Trust" with 5 new capabilities:
  - **Lifecycle Projection** (`ivy state`, `ivy state set`, `ivy state recover`) — Checkpoint model bound to Change, not independent state. Prevents dual-state-source drift. Backward transitions always allowed.
  - **Decision Protocol** (`ivy state --pending`) — 4 core decision points (DP-1 requirements, DP-3 design, DP-4 implementation, DP-8 archive) plus 3 event hooks. Configurable via `workflow.decision_protocol` in project.yaml.
  - **Preset Workflows** (`ivy workflow preset [--detect]`) — 3 built-in presets (full/hotfix/tweak) with auto-detection and upgrade prompts when file thresholds are exceeded.
  - **Workflow Evidence** (`ivy workflow evidence [--check-archive]`, `ivy workflow archive`) — Transition rationale + refs stored in transitionHistory. Archive readiness check enforces complete evidence chains. JSON export via `ivy export --dimension workflow-evidence`.
  - **Execution Isolation** (`ivy workflow archive --clean`) — Git worktree provider for parallel agent execution. Graceful fallback to `provider: none`. Docker/DevContainer interfaces reserved for v0.14+.
- **Explore Mode** (`ivy explore`) — Read-only mode with allowed/forbidden action banner.
- **2 new commands**: `ivy state`, `ivy workflow`, `ivy explore` (29 total commands).
- **673+ passing tests** across 64 test files.
- **5 phases**: `open → design → build → verify → archive` (unchanged).
- **16 platforms** (unchanged from v0.12).

## What is in v0.12

- **27 commands**: All v0.11 commands plus `ivy audit evidence` and `ivy trace`.
- **Evidence Coverage Audit** (`ivy audit evidence`) — Analyze Memory records for orphaned decisions, missing evidence links, and coverage gaps. Report-only (no auto-fix). Text and JSON output. Pipe-friendly.
- **Traceability** (`ivy trace <id>`) — Follow knowledge links forward (evidence→decision→constraint) and backward. Max depth 5. Supports `--direction backward` and `--impact` (Experimental) flags.
- **Memory Health** (`ivy doctor --memory`) — Score memory quality across 6 equally-weighted dimensions (Coverage, Freshness, Link Density, Orphan Rate, Decision-Evidence Ratio, Completeness). Report-first (no KPI enforcement). JSON output available.
- **Evidence Gate** (`ivy verify --gate evidence`) — New quality gate that checks evidence coverage before archive. Configurable threshold via `--min-evidence <pct>` (default 50%). Skippable via `--skip evidence`. Not auto-enabled.
- **Org Insights GA** — Organization Insights graduates from Beta when ≥5 projects OR ≥50 changes (whichever threshold is met first). Trend arrows (↑/↓/→) for bottleneck phase durations.
- **612+ passing tests** across 59 test files.
- **5 phases**: `open → design → build → verify → archive` (unchanged).
- **16 platforms** (no change from v0.11).

## What is in v0.11

- **25 commands**: `init` / `status` / `validate` / `doctor` / `analytics` / `dashboard` / `suggest` / `review` / `check` / `explain` / `rules` / `archive` / `verify` / `fingerprint` / `release` / `export` / `knowledge` / `uninstall` / `update` (+ `--org`, `--knowledge`, `--ecosystem`, `--sync-kb` flag expansions).
- **Organization Insights (Beta)** (`src/core/organization-insights.ts`) — Multi-project aggregation across `.ivy/` directories. Computes completion rate, phase duration distribution (P50/P80/P95), commit density, bottleneck phases, memory coverage. Always outputs Metrics/Distribution/Outlier only (no recommendations). Beta indicator for <5 projects or <50 changes.
- **Knowledge Linking** (`src/core/knowledge-linking.ts`) — `KnowledgeLink` as `links` field in Memory YAML records (no independent storage). 5 relation types: `influences`, `implements`, `precedes`, `supersedes`, `evidences`. Max 10 outgoing links per record, max traversal depth 3. Manual linking (decision→any) + auto linking (quality gates→evidence).
- **`ivy knowledge` command group** — Subcommands: `link`, `links`, `traverse`, `unlink`. Manage knowledge graph relationships between Memory records.
- **Ecosystem Integration** (`src/core/ecosystem.ts`) — Capability-based detection: `code_intelligence` (gitnexus), `documentation_lookup` (context7), `spec_driven` (openspec). 24h cache in `.ivy/project.yaml`. Max 5 built-in capability limit.
- **`ivy doctor --ecosystem`** — Capability status table (Status / Provider / Version / Recommended).
- **Knowledge Sync (Experimental)** (`src/core/knowledge-sync.ts`) — Managed reference marker `<!-- ivy:managed -->` in CLAUDE.md / CURSOR.md / WINDSURF.md. Idempotent: skip if managed, append if unmanaged, create if missing.
- **`ivy doctor --sync-kb` / `--fix --sync-kb`** — Sync managed reference to all installed platforms.
- **Dashboard `--org`** — Multi-project ASCII bar chart + P50/P80/P95 distribution table.
- **Dashboard `--knowledge`** — Knowledge graph overview: Total Records / Links / Linked Ratio / Avg Links / Unlinked Records.
- **Export API v0.11.0** — Version bumped to `0.11.0`.
- **578+ passing tests** across 56 test files.
- **5 phases**: `open → design → build → verify → archive` (unchanged).
- **16 platforms** (no change from v0.10).

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

Coverage thresholds: 80% global lines / branches / functions / statements; the phase machine is held to 100%. Current coverage: **88.5%** lines (612 tests across 59 files).

## License

MIT.

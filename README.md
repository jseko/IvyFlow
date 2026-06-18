# IvyFlow

> **A Workflow Enforcer for AI Coding Agents.**

[简体中文](./README.zh-CN.md)

IvyFlow (`ivyflow-cli`) is a CLI that distributes Skills, Rules, and Git hooks to AI coding platforms (16 platforms in v0.8) so an AI agent is constrained to follow a structured **9-step development workflow** instead of jumping straight to writing code.

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
ivy doctor --platforms             # platform certification report (v0.8)
ivy analytics                      # adoption metrics with data-source transparency
ivy analytics --bias               # show inference bias log (calibration actions)
ivy dashboard                      # interactive ASCII dashboard with trend charts
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
ivy archive --change <name>                   # archive a change
ivy archive --change <name> --report           # archive with implementation report (v0.8)
ivy uninstall                      # safely remove IvyFlow files (asks for confirmation)
ivy uninstall --dry-run            # preview what would be removed
ivy uninstall --force              # skip confirmation (for CI)
ivy update                         # check npm for newer version, print upgrade command
ivy update --check                 # return exit code 0 (latest) or 1 (update available)
```

## What is in v0.8

- **16 commands**: `init` / `status` / `validate` / `doctor` / `analytics` / `dashboard` / `suggest` / `review` / `check` / `explain` / `rules` / `archive` / `uninstall` / `update` (+ `--platforms`, `--team` flag expansions).
- **Connected Advisor** — Adds implementation reports, team-level insights, and platform certification.
- **`ivy archive --report`** — generates `.ivy/reports/<name>-<date>.md` with Summary, Timeline, Decision Log, Suggestion Impact, and Lessons Learned. Read-only (Derived Cache, never creates events).
- **`ivy doctor --platforms`** — Platform Certification Report: scans all 16 platforms for detection, certification level, and skills/rules/hooks installation.
- **`ivy dashboard --team`** — cross-change team dashboard: project overview (completion rate, cycle time, P80 active change limit), bottleneck identification (phase deviations), suggestion system health. All metrics include "correlation observation" (§9.13).
- **Metric Layer** — `src/core/metrics/` unified query abstraction. Types: `MetricQuery`, `MetricResult`. Scopes: change (phase_durations, commit_frequency) and project (active_changes, completion_rate).
- **Platform Certification** — 11 Certified + 5 Experimental = 16 total platforms. `PlatformCertification` type with `'certified' | 'experimental' | 'planned'`.
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
- PreToolUse hooks are only emitted for **Windsurf** (the only platform with a stable contract today). Other platforms rely on the Rule + Git hook layers.
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

Coverage thresholds: 80% global lines / branches / functions / statements; the phase machine is held to 100%. Current coverage: **88.5%** lines.

## License

MIT.

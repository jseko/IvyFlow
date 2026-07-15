# Changelog

All notable changes to IvyFlow (`ivyflow-cli`) are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [0.15.0] - 2026-07-15

### Added
- **Multi-Role System**: 5 roles with independent workflows and skills
  - 💻 Developer: open → design → build → verify → archive
  - 📋 PM: collect → analyze → prd → review → accept
  - 🧪 QA: testcase → execute → bug → report → regression
  - 🏗️ Architect: research → design → review → guide
  - 🚀 DevOps: env → cicd → deploy → monitor → alert
- **Full Install**: `ivy init` installs all 5 roles at once (no `--role` parameter needed)
- **Role Dispatcher**: `assets/skills/ivy-role/SKILL.md` auto-detects current role from `.ivy/project.yaml`
- **Role CLI**: `ivy role set/show/list` commands for runtime role switching
- **Pipeline System**: `ivy pipeline start/status/complete/block/retry` for multi-role orchestration
  - DAG stage graph derived from `role.yaml` `pipeline_downstream` fields
  - Conditional branches (e.g., QA testing → all_pass / bugs_found)
  - Auto role switching on stage completion
- **Init Redesign**: 4-step interactive wizard (welcome → language/tech-stack → CodeGraph/OpenSpec → install)
  - Auto tech stack detection via `detectFingerprint()`
  - Language preference written to agent instruction files (CLAUDE.md, AGENTS.md, etc.)
  - Default language: Chinese
- **91 asset files**: 5 role.yaml + 5 SKILL.md + 12 prompt/ + 31 phase skills + 20 commands + 5 workflows + 3 templates
- **6 shared references**: acceptance.md, review-checklist.md, deliverable.md, risk-assessment.md, decision-record.md, quality-gate.md
- **Binary packaging**: `npm run package:binary` builds standalone 62MB binary with embedded assets

### Changed
- `ivy init` now installs all roles by default (removed `--role` parameter and role selection step)
- Developer skills moved from `assets/skills/ivy/` to `assets/roles/developer/skills/ivy/`
- Rules moved from `assets/rules/` to `assets/roles/developer/rules/`
- Commands moved from `assets/commands/` to `assets/roles/developer/commands/`
- `ivy-design/SKILL.md` slimmed from 133 to 74 lines (-44%)
- `ivy-build/SKILL.md` slimmed from 151 to 75 lines (-50%)
- Removed capability pack selection step (all packs installed by default)
- Removed security audit display (all modules are IvyFlow's own code)
- Removed project type selection step (replaced by auto-detection)

### Removed
- `--role` parameter from `ivy init` (replaced by `ivy role set`)

### Fixed
- Commands path calculation bug (double prefix)
- Rules embedded mode support in binary
- `require('fs')` replaced with ES module imports for ESM compatibility
- `__dirname` undefined in git-hook.ts

### Infrastructure
- 988 passing tests across 88 test files
- 11 integration tests covering full user flow (init → role → pipeline)
- `src/core/pipeline.ts` (160 lines)
- `src/commands/pipeline.ts` (96 lines)
- `src/commands/role.ts` (69 lines)
- `src/core/role-registry.ts` (150 lines)

---

## [0.14.0] - 2026-06-19

### Added
- **Capability Infrastructure (Theme: Awareness)**: System detects project tech stack and generates context-appropriate rules
- 8 new CLI commands: `ivy capability detect`, `capability list`, `capability health`, `capability profile`, `capability verify`, `rules generate`, `rules analyze`, `rules validate`
- Three-stage compiler model: detect (scan sources) → compile (pure function) → emit (write results)
- Strict isolation between stages: Stage 1 no file writes, Stage 2 no I/O, Stage 3 no computation
- Rule tiering: core (always deployed), context (stack-bound), optional (recommended-only)
- Skill determinism: deterministic (stack-bound) vs heuristic (advisory-only)
- Capability health assessment: diagnostic-only (no scores/percentages/weighted averages)
- Capability guards: advisory-only (warn-level, never block transitions)
- Verify profile generation based on detected tech stack with maturity-based gate filtering
- Asset files: `rule-mapping.yaml`, `skill-mapping.yaml`, `verify-mapping.yaml`
- Backward compatible: v0.1–v0.13 `.ivy/project.yaml` read transparently
- 722 passing tests, 94.2% coverage across 66 test files

## [0.13.0] - 2026-06-17

### Added
- **Governed Execution (Theme: Control)**: 5 new capabilities building on v0.12 "Trust"
- `ivy state`, `ivy state set`, `ivy state recover` — Lifecycle Projection with checkpoint model bound to Change
- Decision Protocol — 4 core decision points (DP-1 requirements, DP-3 design, DP-4 implementation, DP-8 archive) + 3 event hooks
- `ivy workflow preset [--detect]` — 3 built-in presets (full/hotfix/tweak) with auto-detection
- `ivy workflow evidence [--check-archive]`, `ivy workflow archive` — Transition rationale with refs
- Execution Isolation (`ivy workflow archive --clean`) — Git worktree provider, graceful fallback
- `ivy explore` — Read-only mode with allowed/forbidden action banner
- 3 new commands: `ivy state`, `ivy workflow`, `ivy explore` (29 total commands)
- 673+ passing tests across 64 test files

## [0.12.0] - 2026-06-14

### Added
- **Evidence & Traceability (Theme: Trust)**
- `ivy audit evidence` — Evidence Coverage Audit: orphaned decisions, missing evidence links, coverage gaps
- `ivy trace <id>` — Follow knowledge links with `--direction backward` and `--impact` (Experimental) flags
- `ivy doctor --memory` — Memory health scoring across 6 equally-weighted dimensions
- `ivy verify --gate evidence` — New quality gate with configurable threshold via `--min-evidence`
- Org Insights graduates from Beta (≥5 projects OR ≥50 changes)
- 612+ passing tests across 59 test files
- 5 phases: open → design → build → verify → archive (unchanged)
- 16 platforms (unchanged from v0.11)

## [0.11.0] - 2026-06-10

### Added
- **Knowledge & Organization**: 25 total commands
- Organization Insights (Beta) — Multi-project aggregation across `.ivy/` directories
- Knowledge Linking — 5 relation types with max 10 outgoing links per record
- `ivy knowledge` command group — link, links, traverse, unlink
- Ecosystem Integration — Capability-based detection: code_intelligence, documentation_lookup, spec_driven
- `ivy doctor --ecosystem` — Capability status table
- Knowledge Sync (Experimental) — Managed reference in CLAUDE.md / CURSOR.md / WINDSURF.md
- Dashboard `--org`, `--knowledge` — Multi-project aggregation and knowledge graph overview
- Export API v0.11.0 — JSON export with version bump
- 578+ passing tests across 56 test files
- 16 platforms

## [0.10.0] - 2026-06-07

### Added
- **Decision Memory & Release**
- `ivy archive --change <name> --adr` — Detailed ADR generation
- Dashboard `--adr`, `--memory` — ADR index and memory overview
- 520+ passing tests

## [0.9.0] - 2026-06-02

### Added
- **Project Knowledge Foundation**: 20 total commands
- Fingerprint — Confidence-scored tech stack detection (1.0/0.9/0.8/0.7/0.6)
- Evidence — Quality gates with structured evidence output
- Knowledge — Regex-only extraction from structured headings
- `ivy archive` (rewrite) — Knowledge extraction + L0 Memory integration
- `ivy verify` — Quality gates: compile, test, task check, coverage
- `ivy fingerprint` — Confidence-scored tech stack detection
- `ivy release` — Bundle completed change artifacts
- `ivy doctor --environment` — Tool presence checks
- L0 Memory Model — Per-type YAML files (decisions, constraints, risks, facts)
- Platform certification system: 11 Certified + 5 Experimental = 16 platforms
- New Certified: Gemini CLI, RooCode
- New Experimental: Continue, Kilo Code, Auggie/Augment, Kimi Code, Lingma
- CI/CD templates: GitHub Actions + GitLab CI
- 415 passing tests across 38 test files

## [0.8.0] - 2026-05-28

### Added
- **Analytics & Adoption**
- Adoption analytics with data-source transparency
- `ivy dashboard` — Interactive ASCII dashboard with trend charts
- Team-level cross-change aggregation
- HTML export with `--html --period 90d`
- Platform certification report via `ivy doctor --platforms`
- Session inference calibration: noise filtering, weekend detection, adjacent session merging
- Derived Cache layer with 1h TTL
- 300+ passing tests
- 11 Certified platforms

## [0.7.0] - 2026-05-24

### Added
- **Suggestion Engine**
- `ivy suggest` — Workflow suggestions: stuck detection, rollback detection, phase review
- `ivy review` — Interactive suggestion review (accept/dismiss/snooze)
- `ivy check` — Non-blocking workflow health check for CI
- `ivy explain` — Suggestion traceability
- `ivy rules` — List and manage Advisor rules
- Dashboard v2 — Trend visualization, HTML export, period filtering
- 200+ passing tests

## [0.6.0] - 2026-05-20

### Added
- **Dashboard & Feedback**
- Dashboard v1 — ASCII visualization
- Suggestion feedback loop with quality metrics
- Session calibration and bias recording
- `ivy analytics --bias` — Inference bias log query

## [0.5.0] - 2026-05-16

### Added
- **Phase Machine & Validation**
- Phase enum with transition table (`src/core/phase-machine.ts`)
- 5 phases: open, design, build, verify, archive
- `ivy validate` — Phase transition validation + security checks
- Triple defense: Rule file + Git Hook + PreToolUse Hook
- Phase guard rule file generated from TypeScript enum
- Build-time sync via `sync-phases.ts`

## [0.4.0] - 2026-05-12

### Added
- **Platform Expansion**
- 6+ platform support
- Multi-platform rule rendering
- Platform detection with confidence scoring (1.0/0.8/0.6)

## [0.3.0] - 2026-05-08

### Added
- **Phase Guards**
- PreToolUse Hook for Windsurf (`hooks/ivy-phase-guard.json`)
- 6 CLI commands: `init`, `status`, `validate`, `doctor`, `uninstall`, `update`
- Manifest v2 with skills, rules, hooks arrays
- Triple defense framework

## [0.2.0] - 2026-05-04

### Added
- **Multi-Platform Support**
- Platform array in `.ivy/project.yaml`
- Rule rendering per platform format
- Detection paths for multiple AI coding platforms

## [0.1.0] - 2026-05-01

### Added
- **Initial Release**
- Single platform support (Claude Code)
- Basic `ivy init` and `ivy status` commands
- `.ivy/project.yaml` with platform config
- Skill file distribution
- OpenSpec adapter integration
- MIT License

# Changelog

All notable changes to `ivyflow-cli` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.13.0] — 2026-06-19

**Governed Execution — v0.13 "Control" builds lifecycle checkpoint management, decision protocols, preset workflows, workflow evidence, and execution isolation on top of the v0.12 "Trust" foundation.** This release transforms IvyFlow from a workflow enforcer into a governed execution layer with transition guards, evidence chains, and safe parallel worktree isolation.

### Added

- **Lifecycle Projection** (`ivy state`, `ivy state set <checkpoint>`, `ivy state recover`) — Checkpoint model where state is a projection of Change, preventing dual-state-source drift. Backward transitions always allowed without --force. Custom YAML serialization in `.ivy/state.yaml` with 10-entry capped transition history.
- **Decision Protocol** (`ivy state --pending`) — 4 core decision points (DP-1 requirements, DP-3 design, DP-4 implementation, DP-8 archive) + 3 event hooks (brainstorming, spec-change, failure-strategy). Configurable auto-approve via `workflow.decision_protocol` in project.yaml.
- **Preset Workflows** (`ivy workflow preset [--detect]`) — 3 built-in presets: full (5-phase), hotfix (skips brainstorming/design, ≤3 tasks), tweak (skips brainstorming/design, ≤5 tasks). Auto-detection based on file count and change name. Auto-upgrade prompt when file threshold exceeded.
- **Workflow Evidence** (`ivy workflow evidence [--check-archive]`, `ivy workflow archive`) — Rationale + refs recorded at each checkpoint transition. Archive readiness check validates complete evidence chains. JSON export via `ivy export --dimension workflow-evidence`.
- **Execution Isolation** (`execution-isolation.ts`) — Git worktree provider creating `./worktrees/<change>` branches. Excludes node_modules/dist/target via symlinks. Graceful fallback to `provider: none` on git failure. Cleanup via `ivy workflow archive --clean`.
- **Explore Mode** (`ivy explore`) — Read-only exploration mode displaying allowed/forbidden actions.
- **OpenSpec v0-13-design-doc** — Formal proposal/design/specs/tasks documenting 6 capabilities: data-truth-model, session-events, analytics-command, dashboard-command, gitnexus-overlay, platform-expansion.
- **3 new CLI commands**: `ivy state`, `ivy workflow` (with preset/evidence/archive subcommands), `ivy explore` (29 total).
- **Guard scripts**: `assets/scripts/state-guard.sh` (per-checkpoint artifact checks), `assets/scripts/state-recover.sh` (state recovery), `assets/hooks/ivy-create-worktree.sh` (worktree creation hook).

### Changed

- `package.json`: version already at `0.13.0` from prior design-documentation release.
- README.md: v0.13 section rewritten with Governed Execution features.
- README.zh-CN.md: synced with English README updates.
- `src/utils/logger.ts`: Added `header()` and `divider()` methods for CLI formatting.

### Technical

- 8 new source files: `lifecycle-projection.ts`, `decision-protocol.ts`, `preset-workflow.ts`, `workflow-evidence.ts`, `execution-isolation.ts`, `commands/state.ts`, `commands/workflow.ts`, `commands/explore.ts`.
- 4 new test files: `decision-protocol.test.ts`, `preset-workflow.test.ts`, `workflow-evidence.test.ts`, `execution-isolation.test.ts`.
- Enhanced: `export-api.ts` (workflow-evidence dimension), `types.ts` (ExportPayload workflowEvidence field), `cli/index.ts` (state/workflow/explore command registration).
- All existing tests continue to pass with no regressions.

### Coverage

- **673 passing tests** across 64 test files (61 new tests for v0.13 governed execution).
- No new external dependencies added.

## [0.12.0] — 2026-06-19

**Agent Experience — Evidence & Traceability.** v0.12 introduces evidence coverage audits, bidirectional knowledge tracing, memory health scoring, an evidence quality gate, and graduates Organization Insights from Beta.

### Added

- **Evidence Coverage Audit** (`src/core/evidence-audit.ts`) — `auditEvidence()` analyzes `.ivy/memory/<change>/` records for orphaned decisions (no outgoing `evidences` link), orphaned evidence (no incoming links from decisions), and computes coverage percentage. Report-only, no auto-fix. Text and JSON output. Pipe-friendly.
- **`ivy audit evidence`** — `ivy audit evidence --change <name> [--json] [--pipe]` CLI command. Scans Memory YAML records for orphaned decisions, missing evidence links, and coverage gaps.
- **Traceability** (`src/core/trace-report.ts`) — `traceRecords()` follows knowledge links forward (via outgoing links) and backward (by scanning all records for incoming links). Max depth = 5 with `"max depth reached"` annotation. Uses `typeFromId()` to resolve ID prefixes (adr→decision, con→constraint, ris→risk, fac→fact, evi→evidence).
- **`ivy trace <id>`** — `ivy trace <id> [--direction backward] [--impact] [--json]` CLI command. Traces knowledge links through the memory graph with impact estimation (Experimental).
- **Memory Health** (`src/core/memory-health.ts`) — `computeMemoryHealth()` scores memory quality across 6 equally-weighted dimensions (Coverage, Freshness, Link Density, Orphan Rate, Decision-Evidence Ratio, Completeness) at 16.67% each. Composite score = average of all 6.
- **`ivy doctor --memory`** — `ivy doctor --memory [--json]` CLI flag. Runs memory health scoring and outputs formatted report with per-dimension scores and composite.
- **Evidence Gate** (`ivy verify --gate evidence`) — New quality gate that checks evidence coverage before archive. Configurable threshold via `--min-evidence <pct>` (default 50%). Skippable via `--skip evidence`. Not auto-enabled — must be explicitly requested.
- **Org Insights GA** (`src/core/organization-insights.ts`) — Beta indicator removed when ≥5 projects OR ≥50 changes (AND logic on `dataLimited`). Trend arrows (↑/↓/→) for bottleneck phase durations via `computeBottleneckTrend()` with 10% threshold.
- **Dashboard trend arrows** — `ivy dashboard --org` now displays trend arrows (↑/↓/→) in per-project bottleneck phase display. Beta label conditionally shown based on GA threshold.

### Changed

- `src/core/organization-insights.ts`: `dataLimited` changed from `||` (OR) to `&&` (AND) — `dataLimited` = projectPaths.length < 5 && totalChanges < 50. Added `computeBottleneckTrend()` with first-half vs second-half comparison, 10% threshold. Added `trend` field to per-project type.
- `src/commands/dashboard.ts`: Conditional Beta label in header and footer for `--org` view. Trend arrow display (↑/↓/→) per project.
- `src/commands/doctor.ts`: Early return for `--memory` flag before ecosystem check. New `runMemoryHealth()` function.
- `src/commands/verify.ts`: Evidence gate logic added — `runEvidenceGate()` calls `auditEvidence()`, skips if no memory dir or no decisions, fails if coverage < threshold. Only runs when `--gate evidence`.
- `src/cli/index.ts`: New `audit` and `trace` commands registered. `doctor` extended with `--memory`, `--json`. `verify` extended with `--gate evidence`, `--min-evidence`.
- `package.json`: version bumped from `0.11.0` to `0.12.0`.

### Coverage

- 612+ passing tests across 59 test files (3 new test files: evidence-audit.test.ts, trace-report.test.ts, memory-health.test.ts).
- New modules: evidence-audit.ts (110 lines), trace-report.ts (195 lines), memory-health.ts (155 lines).
- All v0.11 tests preserved and updated for v0.12 compatibility.
- No new external dependencies added.

## [0.11.0] — 2026-06-18

**Connection — Org Insights · Knowledge Linking · Ecosystem · Knowledge Sync.** v0.11 connects IvyFlow's isolated data stores: cross-project organization insights, knowledge record linking, ecosystem capability detection, and managed reference synchronization.

### Added

- **Organization Insights (Beta)** (`src/core/organization-insights.ts`) — `computeOrgInsights()` aggregates metrics across multiple `.ivy/` directories: completion rate, phase duration distribution (P50/P80/P95), commit density, bottleneck phases, memory coverage. Always outputs Metrics/Distribution/Outlier only (no recommendations). Beta marker for <5 projects or <50 changes. Progressive error handling: partial project failure gracefully degrades.
- **Knowledge Linking** (`src/core/knowledge-linking.ts`) — `KnowledgeLink` interface embedded as `links` field in Memory YAML records. 5 relation types: `influences`, `implements`, `precedes`, `supersedes`, `evidences`. Max 10 outgoing links per record, max traversal depth 3. Manual linking (decision→any type) via `createLink()`. Auto linking via `createAutoLink()` (quality gates→evidence). `getLinks()` returns outgoing + incoming. `traverse()` DFS with cycle detection. `deleteLink()` removes by index. No central graph index.
- **`ivy knowledge` command group** — `ivy knowledge link --source --target --relation --desc`, `ivy knowledge links <record-id>`, `ivy knowledge traverse <record-id> --to <type>`, `ivy knowledge unlink <record-id> --index <n>`.
- **Ecosystem Integration** (`src/core/ecosystem.ts`) — Capability-based detection (not product-based): `code_intelligence` (gitnexus), `documentation_lookup` (context7), `spec_driven` (openspec). 24h cache in `.ivy/project.yaml`. Max 5 built-in capability limit.
- **`ivy doctor --ecosystem`** — capability status table with Status/Provider/Version/Recommended columns.
- **Knowledge Sync (Experimental)** (`src/core/knowledge-sync.ts`) — Managed reference marker `<!-- ivy:managed -->` with reference line `IvyFlow managed. See .ivy/project.yaml...`. Idempotent: skip if managed marker exists, append if unmanaged, create if missing.
- **`ivy doctor --sync-kb` / `--fix --sync-kb`** — syncs reference line to CLAUDE.md / CURSOR.md / WINDSURF.md for all installed platforms.
- **Dashboard `--org`** — `ivy dashboard --org <paths...> [--metrics <list>] [--format json]` renders multi-project aggregated overview with project bars, distribution table, and beta indicators.
- **Dashboard `--knowledge`** — `ivy dashboard --knowledge` shows Total Records / Total Links / Linked Ratio / Avg Links per Record / Recent Links / Unlinked Records overview.

### Changed

- Export API version bumped to `0.11.0`.
- `src/commands/dashboard.ts`: extended with `--org`, `--knowledge`, `--metrics`, `--format` flags.
- `src/commands/doctor.ts`: extended with `--ecosystem`, `--sync-kb` flags.
- `src/cli/index.ts`: new `knowledge` command group registered; dashboard/doctor flags updated.
- `src/commands/init.ts`: project.yaml version bumped to `0.11.0`.

### Coverage

- 578+ passing tests across 56 test files (4 new files: organization-insights.test.ts, knowledge-linking.test.ts, ecosystem.test.ts, knowledge-sync.test.ts).
- New modules: organization-insights.ts (145 lines), knowledge-linking.ts (316 lines), ecosystem.ts (140 lines), knowledge-sync.ts (90 lines).
- All v0.10 tests preserved and updated for v0.11 compatibility.
- §9 Red Line CI: render/ ≤ 8 files ≤ 50 lines, index.ts ≤ 30 lines. Knowledge Linking Boundary: max 10 outgoing links, max traversal depth 3, no central graph index.

**Operational Governance — TypeScript Guard · Memory ADR · Export API.** v0.10 hardens IvyFlow's operational foundations: productionizes the PreToolUse hook system with typed TypeScript guards, freezes the Memory schema and ADR view for decision memory, and provides a read-only Export API for data portability.

### Added

- **TypeScript PreToolUse Guard** (`src/core/hook-runtime.ts`) — `PreToolUseGuard` class with typed evaluation pipeline: global block rules → phase-specific rules → archive guard. Three decision types: `allow` / `block` / `warn`. `PlatformHookAdapter` interface with 3 implementations: Windsurf (JSON), Cursor (JSON), Gemini (CLI). Legacy v0.7-v0.9 hook config backward-compatible via `detectLegacyHookConfig()`.
- **Memory Schema freeze** — `.ivy/memory/schema.yaml` with 5 record types: `decision`, `constraint`, `risk`, `fact`, `evidence`. `MemoryStore` class with `write()` (validates + assigns ID + persists YAML + updates JSON index), `query()` (multi-condition filtering by type/change/phase tag), `renderAdrView()` (decision memory view), `renderMemoryOverview()` (type counts). Index managed as `index.json`.
- **ADR View** — `ivy dashboard --adr` renders filtered decision records from MemoryStore. `ivy dashboard --memory` shows type-count overview. `ivy archive --adr` generates detailed ADR entries during archive.
- **Export API** — `ivy export metrics` with `--pipe` (stdout JSON), `--project` (multi-project), `--dimension` (changes/metrics/knowledge). Read-only: never creates or modifies `.ivy/` state. JSON format v0.10.0.
- **GitHub Issue/PR templates** — `.github/ISSUE_TEMPLATE/bug_report.md`, `feature_request.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `docs/rfc/template.md`.
- **CONTRIBUTING.md** — code conventions (TypeScript strict, no `any`, ESM only, Vitest), PR workflow, RFC process.
- **CODE_OF_CONDUCT.md** — Contributor Covenant v2.0.
- **SECURITY.md** — vulnerability reporting process (48h acknowledgement).

### Changed

- `src/core/render/hook-windsurf.ts`: rewritten as `WindsurfHookAdapter implements PlatformHookAdapter`. Backward-compat `renderHookForWindsurf()` delegates to new adapter.
- `src/core/render/hook-cursor.ts`: rewritten as `CursorHookAdapter implements PlatformHookAdapter`.
- `src/core/render/hook-gemini.ts`: upgraded from Experimental, GeminiHookAdapter implements PlatformHookAdapter. Hook command changed from `.ivy/hooks/ivy-phase-guard.sh` to `ivy validate`.
- `src/core/platforms.ts`: gemini-cli hook fields added (`supportsHooks: true`, `hookFormat: 'gemini'`).
- `src/core/skills.ts`: hook installation updated to use `PreToolUseGuard` + adapter pipeline instead of `renderHook()`.
- `src/commands/archive.ts`: extended with `--adr` flag for ADR generation after knowledge extraction.
- `src/commands/dashboard.ts`: extended with `--adr` and `--memory` flags.
- `src/cli/index.ts`: new `export` command registered; dashboard/archive flags updated.

### Coverage

- 517+ passing tests across 49 test files (4 new test files: hook-runtime.test.ts, export-api.ts coverage, archive --adr integration).
- New modules: hook-runtime.ts (147 lines, 13 tests), memory-arch.ts (217 lines), export-api.ts (165 lines), export.ts (65 lines).
- All v0.9 tests preserved and updated for v0.10 compatibility.
- §9 Red Line CI: render/ ≤ 8 files ≤ 50 lines, index.ts ≤ 30 lines. No Renderer interface/IR (HookAdapter ≠ Renderer).

## [0.9.0] — 2026-06-18

**Project Knowledge Foundation — Fingerprint · Evidence · Knowledge.** v0.9 upgrades IvyFlow from a connected advisor to a project knowledge platform, adding three deterministic project assets: Fingerprint (what is this project?), Evidence (what did it prove?), Knowledge (what did it learn?).

### Added

- **`ivy fingerprint`** — confidence-scored tech stack detection. Scans package.json (TypeScript/React/Vue/Angular/Svelte, frontend/backend/CLI detection), pom.xml (Java/Spring Boot/Maven), go.mod (Go), Cargo.toml (Rust), pyproject.toml/requirements.txt (Python). Confidence tiers: 1.0 (definitive: build config), 0.9 (near-definitive: lockfile), 0.8 (strong: dependency), 0.7 (moderate). Cached to `.ivy/fingerprint.yaml`. `--refresh` re-scans, `--json` outputs JSON.
- **`ivy verify`** — quality gates with evidence output. Gates: compile (auto-detects build command: mvn/npm/go/cargo), test (detects test command: mvn/npm/go/cargo), taskCheck (parses tasks.md `[ ]`/`[x]` markers), coverage (parses percentage from output). Gate filtering via `--gate`/`--skip`. Evidence report at `.ivy/evidence/<change>.yaml`. Report-only: no auto-fix. Error-tolerant: one gate failure doesn't block others. Exit code 1 if any gate fails.
- **`ivy release`** — bundle completed change artifacts for handoff. Validates ARCHIVE phase only. Copies archive report, knowledge YAML, evidence YAML, and L0 memory dir to `.ivy/releases/<change>/`. Writes `release.yaml` manifest. Missing artifacts skipped gracefully.
- **`ivy doctor --environment`** — tool presence health check. Detects: Node.js (≥ 18), Git (version + repository status), package manager (pnpm/yarn/npm from lockfile), Java (if pom.xml/build.gradle exists). Read-only: never modifies files.
- **Knowledge extraction engine** (`src/core/knowledge-extractor.ts`) — regex-only extraction from `## Decision`, `## Constraints`, `## Risk`, `## Facts`, `## Assumptions` headings. 4 extractable types only: decision, constraint, risk, fact. Forbidden: Summary, Recommendation, Analysis, Trade-off sections. Deterministic — no AI, no inference, same documents → same output. Empty-fail-safe.
- **L0 Memory writer** (`src/core/memory-writer.ts`) — writes per-type YAML files to `.ivy/memory/<change>/` (decisions.yaml, constraints.yaml, risks.yaml, facts.yaml) with {type, key, value, source, confidence, timestamp} format. Writes knowledge-summary.yaml per change. Empty types skip file creation. Designed for v1.0 L1/L2 expansion.
- **`ivy archive` v0.9 rewrite** — integrates knowledge extraction and L0 Memory. Flow: extract knowledge → write L0 Memory → phase transition (VERIFY→ARCHIVE) → file move (changes/ → archive/) → archive report. Accepts `--no-extract`, `--action`, `--message`, `--force`. Knowledge writes to `.ivy/knowledge/<change>.yaml`.
- **project.yaml v0.9 schema** — new sections: `project_knowledge` (enabled, extractable_types), `quality_gates` (compile, test, task_check, coverage), `fingerprint` (auto_refresh). Backward-compatible with v0.8.
- **Public Data Contract** — add-only field policy for all `.ivy/*` YAML outputs. Forward-compatible: extra fields preserved on read.
- **4 new typed interfaces** — `StackDetection<T>` (confidence-scored detection), `ProjectFingerprint`, `QualityGateConfig`, `EvidenceReport`. All in `src/core/types.ts`.

### Changed

- `src/commands/archive.ts`: rewritten from v0.8 flag-based to v0.9 full command with knowledge extraction. `--report` flag removed (report always generated). New options: `--no-extract`, `--action`, `--message`, `--force`.
- `src/commands/doctor.ts`: `--environment` option added. New `runEnvironmentCheck()` function for tool presence detection.
- `src/commands/init.ts`: project.yaml version bumped to 0.9.0. New default sections: `project_knowledge`, `quality_gates`, `fingerprint`.
- `src/core/types.ts`: added all v0.9 types (archive/knowledge/memory/evidence/fingerprint). Previous content replaced.
- `src/cli/index.ts`: added verify, fingerprint, release command registrations. Updated archive command options.
- `README.md` and `README.zh-CN.md`: updated with v0.9 commands, features, and schema.

### Coverage

- 190+ passing tests across 48 test files (10 new test files for v0.9 modules).
- New modules: archive-engine.ts (tested via 9 tests), knowledge-extractor.ts (11 tests), memory-writer.ts (9 tests), fingerprint.ts (9 tests), verify.ts (8 tests), release.ts (8 tests), compat.ts (9 tests).
- New commands: verify, fingerprint, release (100% gate coverage).
- All v0.8 tests preserved and updated for v0.9 compatibility.

**Connected Advisor — Knowledge · Collaboration · Certification.** v0.8 upgrades IvyFlow from a transparent advisor to a connected advisor, adding implementation reports, team-level insights, platform certification, and Metric Layer abstraction.

### Added

- **`ivy archive --report`** — implementation report generation (v0.8 core feature). Generates `.ivy/reports/<change-name>-<date>.md` with Summary (git commits/files/lines), Timeline (phase transitions), Decision Log, Suggestion Impact, and Lessons Learned (manual fill-in). All data read-only from Derived Cache — never creates new events.
- **`ivy doctor --platforms`** — Platform Certification Report. Scans all 16 platforms for detection status, certification level, and installation state of skills/rules/hooks. Read-only per §9.4.
- **`ivy dashboard --team`** — team-level cross-change aggregation: project overview (completion rate, cycle time, active changes vs P80 limit), bottleneck identification (phase deviations), suggestion system health. All outputs include "correlation observation" non-causal annotation per §9.13.
- **Metric Layer** (`src/core/metrics/`) — unified query abstraction decoupling analytics/dashboard/team-insights from direct events.jsonl access. Types: `MetricQuery`, `MetricResult`, `MetricQueryInput`. Scopes: `change` (phase_durations, commit_frequency, completion_rate) and `project` (completion_rate, commit_frequency, active_changes). Read-only, never creates events, empty data returns `[]` gracefully.
- **`PlatformCertification` type** — `'certified' | 'experimental' | 'planned'` tiered maturity grading. All 9 existing v0.7 platforms set to `'certified'`.
- **5 new Experimental platforms** — Continue, Kilo Code, Auggie/Augment, Kimi Code, Lingma — each with `detectionPaths` and `certification: 'experimental'`. 11 Certified + 5 Experimental = 16 total platforms.
- **2 new Certified platforms** — Gemini CLI and RooCode (both promoted from Comet reference). Total Certified: 11.
- **`rulesBaseDir` field** — optional Platform field for non-standard rule directories. `skills.ts` respects `rulesBaseDir` when present, falls back to `skillsDir` (backward-compatible).
- **3 Experimental Hook renderers** — Gemini (`beforeTool`), Qwen Code (`preToolUse`), Kiro (`hook/type`). All marked Experimental — no stability guarantee, not in release checklist.
- **CI/CD integration templates** — `assets/ci/github-actions.yml` (GitHub Actions) and `assets/ci/gitlab-ci.yml` (GitLab CI). Both run `ivy check` on push/PR. Manual copy only — `ivy init` does not auto-install.
- **Team Insights engine** (`src/core/team-insights.ts`) — cross-change aggregation: avgPhaseDurations, bottleneckPhases (severity: info/warning/critical), avgCompletionDays, P80-based `recommendedActiveChanges`, completionTrend (improving/stable/declining). All outputs non-causal annotated.
- **Platform Health engine** (`src/core/platform-health.ts`) — read-only per-platform health: detection status, certification level, skills/rules/hooks installed state. Drives `doctor --platforms`.
- **Platform-driven detection** — `CONFIDENCE_BY_PATH` fully removed from `detect.ts`. `detectPlatforms` reads exclusively from `Platform.detectionPaths`. 52 lines deleted.

### Changed

- `src/core/detect.ts`: header comment updated to "v0.8 scans all 16 platforms via Platform.detectionPaths". Platform fallback table removed entirely.
- `src/core/platforms.ts`: `PlatformCertification` type added, `certification` (required) and `rulesBaseDir` (optional) fields added to Platform interface. 7 new platforms appended. PLATFORMS comment updated to "v0.8 supports 16 platforms (11 Certified + 5 Experimental)".
- `src/core/skills.ts`: new `getPlatformRulesDir()` function added for `rulesBaseDir` support.
- `src/core/render/index.ts`: 3 new hook renderer imports and cases. Exports array extended with `renderHookForGemini`, `renderHookForQwen`, `renderHookForKiro`.
- `src/commands/dashboard.ts`: `team` option added to `DashboardOptions`. Early return when `opts.team` is set.
- `src/commands/doctor.ts`: `platforms` option added to `DoctorOptions`. Early return when `opts.platforms` is set.
- `src/core/team-insights.ts`: reads L1 raw events directly (not through MetricQuery, per design §5.2). Non-causal annotation on all bottleneck/recommendation outputs.
- `README.md` and `README.zh-CN.md`: platform list updated to 16, commands updated, v0.8 scope documented.

### Fixed

- `change-metrics.ts` and `project-metrics.ts`: explicit type annotations for event collection loops to prevent implicit `any` types from `readRawEvents` AsyncGenerator.
- `skills.test.ts` and `platforms.test.ts`: test fixtures updated with required `certification` field.

### Coverage

- 415 passing tests across 38 test files.
- 38 test files (up from 37 in v0.7).
- Lines: **88.5%** (target ≥ 80%).
- New modules: metrics/ (29.85% — gaps in change-metrics.ts), team-insights.ts (84.65%), platform-health.ts (tested via doctor.test.ts).

**Transparent Advisor — Explain · Govern · Measure.** v0.7 completes the Advisor Closed Loop by adding full suggestion traceability (`ivy explain`), rule governance transparency (`ivy rules`), and adoption analytics (`ivy analytics` rewrite) — all with explicit confidence annotations per §9.13-§9.15.

### Added

- **`ivy explain`** — read-only suggestion traceability (§9.15). Single suggestion `--id` mode with immutable `SuggestionTraceSnapshot` (ruleName, algorithmVersion, configVersion, thresholdUsed, confidence, dataSource). Batch modes `--change` and `--type` with human-readable tree output. `--json` output. Nonexistent ID graceful error.
- **`ivy rules`** — rule governance transparency (§9.14). `--list` (5 built-in rules, version/source/override columns). `--info <name>` (algo/config versions, effective config, version history). `--override <rule.param=value>` (Derived Cache only, validated against allowedOverrides). `--remove <rule.param>`. All operations in the clear; overrides stored in `.ivy/sessions/cache/rule_manifest.json`.
- **`ivy analytics` rewrite** — adoption funnel with confidence disclosure (§9.13). Funnel metrics (totalCommits, totalChanges, completionRate, linesAdded, filesChanged) from L1 events. Suggestion impact (total/accepted/estimatedLinesFromAccepted) with "correlation observation, not causal conclusion" caveat. Weekly trend visualization. `--confidence` flag for detailed per-metric disclosure. `--json` output. Maintains `--enable`/`--disable` from v0.4.
- **Adoption Engine** (`src/core/adoption-engine.ts`) — descriptive analytics with 5-minute TTL cache (`adoption_profile.json`). Confidence annotation: low (<10 data points), medium (10+). Period filtering (7d/30d/90d) and change filtering.
- **Explain Engine** (`src/core/explain-engine.ts`) — builds `FullExplanation` from suggestion snapshot + Rule Registry + calibration history. Calibration version history (3 milestones + dynamic profile).
- **Rule Registry** (`src/core/rule-registry.ts`) — 5 built-in rules (stuck_detection v3/v2, phase_review v2/v1, rollback_detection v1/v1, visibility_adjust v1/v1, calibration v3/v2). `deepCloneConfig()` prevents shared mutable state on BUILTIN_RULES. Override/remove with `allowedOverrides` validation.
- **Quality Calibrator history** — `getCalibrationHistory()` exports 3 hardcoded milestones + dynamic profile state.
- **Data Trust Model DTM-v2** — `rule_trace` on L2 events, Derived Cache separation (rule_manifest.json, adoption_profile.json). Deletable/rebuildable cache.
- **Platform detectionPaths** — `Platform.detectionPaths` field on all 9 platforms, migrated from `CONFIDENCE_BY_PATH`. Fallback to deprecated `CONFIDENCE_BY_PATH` when detectionPaths absent.
- **Redline expansion** — `§9.13` (analytics precision claim), `§9.14` (override modifies builtin), `§9.15` (explain writes events) enforced in `check-suggest-redlines.js`.
- **Suggestion trace snapshots** — `SuggestionTraceSnapshot` attached to every v0.7+ Suggestion at generation time. Backward-compatible with pre-v0.7 suggestions (no trace field).
- **`ivy suggest --explain`** — inline trace display per suggestion (ruleName, versions, threshold, source).
- **Manifest v6** — `rules` → `ruleGovernance` config section, `explain` config section. schemaVersion 6, dataModelVersion DTM-v2.
- **391 passing tests** across 37 test files.

### Changed

- `ivy analytics` command description: "Show adoption metrics with data-source transparency (§9.13)".
- `src/core/detect.ts`: `detectPlatforms` prefers `platform.detectionPaths` over deprecated `CONFIDENCE_BY_PATH`. Platform name logging added.
- `src/core/sessions.ts`: RawEvent `meta` type relaxed for unstructured metadata.
- `assets/manifest.json` schemaVersion incremented to 6 with `explain` and `ruleGovernance` config sections.

### Fixed

- Shared mutable state in rule-registry.ts: `{...rule.defaultConfig}` shallow copy replaced with `deepCloneConfig()` using `JSON.parse(JSON.stringify())` to prevent BUILTIN_RULES mutation.
- Manifest `rules` key conflict: duplicate key between rule file array and v6 config section resolved by renaming config section to `ruleGovernance`.
- Calibration history conditional: hardcoded milestones moved outside `if (calibrationProfile)` block.
- Analytics test event dates: updated to within default 7-day window for period filtering correctness.

**Refined Advisor — Calibrate · Act · Share.** v0.6 transforms IvyFlow from passive observability into an active, calibrated workflow advisor with CI-friendly sharing.

### Added

- **Quality Calibration (`--calibrate`)** — P80 percentile-based threshold adjustment from archived change data. Three modes: `fixed`, `adaptive` (auto-applies P80), `hybrid` (clamped adaptive with [80%, 200%] bounds). Calibration is advisor-only, writes to Derived Cache (§9.12).
- **`ivy review`** — interactive suggestion processing (accept/dismiss/snooze/ignore/quit) with readline prompts. Batch mode (`--auto accept`, `--auto snooze --type X --snooze-days N`). JSON output with quality metrics.
- **`ivy check`** — CI-friendly non-blocking workflow health check. 3 execution modes (`quick`/`standard`/`full`). 3 output formats (`cli`/`markdown`/`json`). `--env` mode for environment detection (Node.js, Git, openspec, GitNexus). Exit code control (`--exit-code --fail-on none|stuck_critical|any_critical`).
- **`ivy dashboard --quality`** — suggestion quality panel: effectiveness/accuracy rates, per-type bar charts, weekly trend, calibration info.
- **Git Watch (experimental)** — file-level `file_save` events via `git diff-tree --name-status`. Opt-in via `IVY_GIT_WATCH=1`. No file content per §9.11.
- **Multi-signal session scoring (experimental)** — time gap (weight 0.5), file overlap (weight 0.3), commit frequency (weight 0.2). Confidence threshold ≥ 0.4 with `low~medium` label.
- **Suggestion lifecycle expansion** — 7 statuses (added `snoozed`/`expired`/`actioned`), visibility auto-adjustment (`normal`→`quiet`→`hidden` based on consecutive dismissals), expiration (pending > 60d auto-expired).
- **Manifest v5** — review/check config sections, suggest config extended with calibration/visibility/expiration settings.
- **`§9.11` new red line** — Git Watch emits file_save events with metadata only (no file content).
- **`§9.12` new red line** — calibration writes to Derived Cache only (no L1/L2 modification).

### Changed

- `ivy suggest` extended with `--calibrate`, `--quality`, `--show-expired`, `--show-all` flags.
- `ivy doctor` now includes environment detection (Node.js, Git, openspec, GitNexus) and calibration status check. `--fix` triggers calibration when feedback ≥ 50 entries.
- `stuck-detector.ts` supports 3-mode threshold resolution (`fixed`/`adaptive`/`hybrid`), exported `resolveEffectiveThresholds()`.
- `feedback-recorder.ts` quality metrics: `effectiveness`, `accuracy`, `dismissedReasons`, `weeklyTrend`, `calibrationInfo`.
- `session-inferer.ts` extended with `computeMultiSignalScore()`, `multiSignalScoring` config flag.
- `sessions.ts` extended with `file_save` event type (v3 schema, backward-compatible).
- `assets/manifest.json` schemaVersion 5 with review/check config sections.
- `assets/hooks/ivy-git-prepush.sh` includes non-blocking `ivy check` reminder.
- `assets/hooks/ivy-session-tracker.sh` v2 with Git Watch experimental support.

### Fixed

- (none — v0.6 is a feature release)

## [0.5.0] — 2026-06-17

**Workflow Enforcer + Advisor — first advisory release.** v0.5 takes IvyFlow from pure observability to actionable workflow intelligence. All suggestions are advisory-only, traceable via unique IDs, and backed by a feedback loop.

### Added

- **`ivy suggest`** — workflow suggestion engine: stuck detection (phase threshold), rollback detection (7d window), phase review (duration vs historical avg). All suggestions carry unique IDs and confidence scores.
- **Suggest Feedback Loop** — `ivy suggest --mark-resolved <id> --action accepted|dismissed|ignored` records user feedback; quality metrics (acceptance rate by type) in `--json` output.
- **Derived Cache layer** — `.ivy/sessions/cache/trend_profile.json`, `phase_duration_stats.json`, `common_transitions.json` with 1h TTL. Rebuildable, not a numbered data layer.
- **Session inference calibration** — noise filtering (<1min single-event sessions), weekend detection (possible_batch_operation marking), adjacent session merging (<5min gap), bias recording with `ivy analytics --bias`.
- **Dashboard v2** — trend visualization (commit trend, phase duration bars, suggestion acceptance rate), HTML export (`--html`), period filtering (`--period 30d|90d`). **Dashboard is display-only: zero suggestion logic.**
- **Platform expansion** — Cline and Amazon Q Developer formal support (detection + install paths); Windsurf Hook stable marker.
- **`$9.10` new red line** — all suggestions must carry unique IDs and support feedback closure.
- **Data model refinement** — Derived Cache separated from L0 layer naming; Phase Hint renamed to Phase Review (outputs `reviewRecommended` not `suggestedNextPhase`).

### Changed

- Dashboard output format enhanced with trend charts and suggestion quality display (backward-compatible with v0.4).
- analytics.ts: `--bias` flag for inference bias log query; Derived Cache freshness indicator.
- session-inferer.ts: `inferSessions()` now returns `{ events, bias }`; `runSessionInference()` returns `{ inferred, bias }`.
- sessions.ts: new L2 event types `stuck_detected` and `phase_drift`.
- manifest.json schemaVersion incremented to 4 with suggest config section.

### Fixed

- (none — v0.5 is a feature release)

## [0.4.0] — 2026-06-17

**Analytics base + data trust model.** Introduces the L1/L2/L3 data model with
confidence provenance tracking.

### Added

- **`ivy analytics`** — adoption metrics with data-source transparency.
  `--change`, `--project`, `--period 7d|30d|90d`, `--enable`, `--disable`, `--json`.
- **L1/L2 data model** — raw events (`events.jsonl`) + inferred sessions (`sessions.jsonl`)
  with physical separation and idempotent deduplication.
- **`runSessionInference`** — L2 layer generator from L1 events using 30min boundary heuristic.
- **`git post-commit` hook** — `ivy-session-tracker.sh` records L1 events (`git_commit`) on each
  commit. Wrapped with IvyFlow markers for clean uninstall.
- **`ivy dashboard`** — interactive ASCII dashboard with data-source transparency declaration,
  verified/inferred/experimental metric tiers, and optional GitNexus overlay (`--watch` mode).
- **GitNexus integration** — optional overlay via `queryGitNexusOverlay()` for code intelligence.
- **`analytics_enabled: false`** field in `.ivy/project.yaml` — toggle tracking on/off.
- **Confidence provenance** — every metric declares confidence level with basis and gaps.

### Changed

- `.ivy/project.yaml` schema bumped to `version: 0.4.0`.
- `manifest.json` schemaVersion incremented to 3.
- `session-inferer.ts` exports `inferSessions()` and `runSessionInference()`.

## [0.3.0] — 2026-06-17

**Security hardening + lifecycle management.** Delivers the two most-requested
missing capabilities from v0.2: safe removal (`ivy uninstall`) and version
checking (`ivy update`). Integrates security rules into `ivy validate` so that
`ivy-security.md` is no longer just distributed — it has an enforcement point.

### Added

- **`ivy uninstall`** — safely removes IvyFlow files from all configured
  platforms. `--dry-run` previews what would be deleted; `--force` skips the
  confirmation prompt for CI. Git pre-push hook is surgically removed (IvyFlow
  section only, user custom content preserved). Idempotent: repeated runs exit 0.
- **`ivy update`** — checks npm registry for a newer version, prints the upgrade
  command, but never auto-installs. `--check` returns exit code 0 (up to date) or
  1 (update available). Offline failures are graceful (warn + exit 0).
- **`ivy validate --security`** (default enabled since v0.3) — two new checks:
  1. **Rule presence**: verifies `ivy-security.{md,mdc}` is installed on every
     configured platform; warns with `run ivy init --overwrite` if missing.
  2. **Sensitive filename scan**: walks the working directory and warns about
     blacklisted filenames (`.env`, `*.pem`, `id_rsa`, etc.). Only filenames are
     checked — no file content is ever read (zero privacy risk).
- **`assets/rules/ivy-security.md`** — PII regexes, credential patterns, and
  sensitive-file blacklist. Rendered per-platform (`.mdc` for Cursor, DO/DO-NOT
  extraction for Copilot, plain `.md` for others) and validated at build time.
- **`analytics_enabled: false`** reserved field in `.ivy/project.yaml` — no-op
  in v0.3, lays the ground for v0.4 analytics toggle.

### Changed

- `.ivy/project.yaml` schema bumped to `version: 0.3.0`.
- `manifest.json` `rules[]` now includes `ivy-security.md` (schemaVersion stays 2).
- Git pre-push hook is now wrapped with IvyFlow start/end markers during
  installation, enabling precise removal during `uninstall`.

### Coverage

- Lines: **92.98%** (target ≥ 80%); security.ts 96%; uninstall.ts/update.ts covered.
- 17 test files / 165 tests, 100% pass.

### Deferred to v0.4

- Analytics / session events / dashboard (data-source matrix insufficient:
  6/7 platforms lack PreToolUse Hook; would produce "Windsurf-only" biased data).
- `.ivy/sessions/` directory and `events.jsonl`.
- PreToolUse Hook expansion to Cursor / Copilot / others (§9.6 red line:
  stable ≥ 6 months).

## [0.2.0-rc.1] — 2026-06-16

**Multi-platform adapter release candidate.** Expands distribution from 1 to 7
AI coding platforms; introduces `ivy doctor` and the §9 evolution-constraint
layer that bounds future v0.3 changes.

### Added

- **7-platform support** — `claude` (Claude Code), `codebuddy`, `cursor`,
  `github-copilot`, `windsurf`, `trae`, `qoder`. `PLATFORMS` is a const array
  of `PlatformConfig` records — no `Platform` interface, no registry (D1 / §9.1).
- **Confidence-scored detection** (`src/core/detect.ts`): hardcoded
  `CONFIDENCE_BY_PATH` table with three layers — `1.0` (settings/config file),
  `0.8` (rules directory), `0.6` (generic dir). Results below 0.8 default to
  unchecked in the `--standard` wizard. Offline-only (D3 / §9.2).
- **Per-platform rule rendering** (`src/core/render/`, 4 files, all ≤ 50 lines):
  - `index.ts` — pure switch-forwarding (26 lines, no IR / Renderer interface).
  - `rule-mdc.ts` — Cursor `.mdc` frontmatter wrapper.
  - `rule-copilot.ts` — GitHub Copilot DO / DO NOT extraction.
  - `hook-windsurf.ts` — Windsurf PreToolUse JSON.
- **Windsurf PreToolUse hook**: rendered to
  `<skillsDir>/hooks/ivy-phase-guard.json` during `ivy init`. Other platforms
  skip silently (no platform-wide hook abstraction).
- **`ivy doctor` command** (§9.4 strict local invariant): four-to-six checks
  (project.yaml schema, per-platform skills/rules/hook presence, git pre-push,
  phase-guard source). Three-state output (passed / warning / failed).
  `--fix` re-creates missing files only — never rewrites existing ones, never
  performs telemetry / network / state inference.
- **SKILL.md 4-block layout** (§9.3): single file enforced into ROUTER /
  CONSTRAINTS / VARIABLES / REFERENCES via HTML comment markers, each block
  ≤ 50 lines. Build pipeline now fails if any block exceeds the budget.
- **Manifest schema v2** (`assets/manifest.json`): adds `schemaVersion: 2`,
  `rules[]`, and `hooks` map (`claude-code` static / `windsurf` rendered).
  Validated by `scripts/check-manifest.js` at build time.
- **Per-platform parallel install**: `Promise.all` over platforms; one
  platform's failure does not block the others (R6).
- **`.ivy/project.yaml` v0.2 schema**: adds `version`, `last_migration`,
  `platforms: string[]`, and `detected_platforms[]` with confidence + matched
  path. v0.1 single-platform `platform: string` field is read transparently
  by `ivy status` / `ivy doctor`.
- **End-to-end test matrix**: 7 platforms × init flow, parallel multi-platform
  install, v0.1 → v0.2 backwards compatibility (`init-e2e.test.ts`).
- **Build-time invariant scripts**: `check-manifest.js` and
  `check-skill-blocks.js` now run before TypeScript compile.

### Changed

- `init.ts` quick mode auto-selects platforms with detection confidence ≥ 0.8;
  falls back to `claude` on a clean repo.
- `init.ts` standard mode uses `@inquirer/prompts` `checkbox` with
  confidence-based default checks (`1.0 → (detected)`, `0.8 → (rules dir)`,
  `0.6 → (low confidence — please confirm)`).
- `skills.ts` rule install now dispatches via `renderRule(format, md)`; rule
  output paths resolve per platform (`copilot-instructions.md` for Copilot,
  `<rulesDir>/<base>.{md,mdc}` otherwise).
- OpenSpec setup runs only when at least one selected platform exposes a
  non-empty `openspecToolId`.

### Coverage

- Lines: **92.51%** (target ≥ 80%); render/ 96.96%; detect 100%; skills 92.42%.
- 13 test files / 151 tests, 100% pass.

### Evolution constraints (§9 — enforced for v0.3)

The design doc's §9 red lines now ship as code-level guards:
- `render/` files ≤ 8, each ≤ 50 lines, `index.ts` ≤ 30 lines, no Renderer
  interface or IR.
- `detect.ts` confidence layers ≤ 4, no `DetectionStrategy` interface, no
  network or git-history reads.
- `SKILL.md` exactly 4 blocks, each ≤ 50 lines (CI-checked).
- `ivy doctor` may not add `--telemetry` / `--report` / `--upload`.

### Out of scope (deferred)

- Skill phase splitting into `ivy-open` / `ivy-build` / etc. (delayed to v0.3+
  contingent on ≥ 100-project usage data + 30% marginal-benefit evidence).
- PreToolUse hooks for Cursor / GitHub Copilot / CodeBuddy / Trae / Qoder
  (only Windsurf has a stable platform contract today).
- `ivy uninstall` / `ivy update` / `ivy analytics` / `ivy dashboard`.
- Adoption snapshot session-boundary tracking and PII scanning.
- Multi-change parallel management.
- GitNexus integration (v0.4).

[0.2.0-rc.1]: https://github.com/ivyflow/ivyflow-cli/releases/tag/v0.2.0-rc.1

## [0.1.0] — 2026-06-16

Initial public release. **Single-platform (Claude Code) MVP.**

### Added

- `ivy init` with three modes — `--quick` (default, no prompts), `--standard` (interactive wizard), `--enterprise` (standard + reserved plugin slots, currently a no-op).
- `ivy status` and `ivy status --change <name>` — prints the current phase, plus the adoption snapshot when the change is in `archive`.
- `ivy validate` — walks every `openspec/changes/*/.ivy.yaml` and validates `phase` + `phase_history` against the canonical transition table; exits non-zero on any illegal transition or unknown phase.
- Explicit TypeScript phase machine (`src/core/phase-machine.ts`): `IvyPhase` enum, `TRANSITIONS` table, `canTransition`, `isTerminalPhase`, `parsePhase`. 100% line coverage.
- Bidirectional drift gate: `scripts/sync-phases.js` regenerates the phase block in `assets/rules/ivy-phase-guard.md` from the enum at build time. `npm run sync-phases:check` fails CI on drift.
- Triple-defense distribution (v0.1 ships 2 of 3 layers):
  - **Primary** — `ivy-phase-guard.md` Rule copied to `.claude/rules/`.
  - **Secondary** — `ivy-git-prepush.sh` installed to `.git/hooks/pre-push`; uses only `grep`/`awk`/`sed`, no `yq` dependency. Blocks pushes from any `ivy/<change>` branch whose `.ivy.yaml` phase is not `archive`.
  - **Tertiary** — PreToolUse Hook deferred to v0.2.
- Manifest-driven Skill distribution (`assets/manifest.json` + `assets/skills/ivy/`).
- `SpecAdapter` interface (`name` / `ensureCli` / `init`) with `OpenSpecAdapter` as the v0.1 default. `IVY_SPEC_ADAPTER` env var is reserved for v0.2 substitution.
- Adoption-Lite tracker (`src/core/adoption-lite.ts`): single `git diff --shortstat <baseCommit>..HEAD` snapshot per change, written to the `adoption:` key in `openspec/changes/<name>/.ivy.yaml`. Snapshots are gated on `isTerminalPhase` and always tagged `confidence: 'low'`.
- Bilingual README (`README.md` + `README.zh-CN.md`).

### Out of scope (deferred)

- `ivy doctor` / `ivy uninstall` / `ivy update` (v0.2).
- Cursor / Windsurf / GitHub Copilot platforms (Phase 2).
- Skill phase splitting (`ivy-open` / `ivy-build` / etc.) (v0.2).
- PreToolUse Hook enforcement (v0.2).
- `@ivyflow/analytics` / `@ivyflow/gitnexus` / `@ivyflow/security` plugins.
- `--force-snapshot` outside `archive` (deliberate, may revisit in v0.2).
- `ivy validate --json` output (deliberate, may revisit in v0.2).
- Tech-stack recommendations, SaaS, telemetry, `ivy run` LLM runtime.

### Notes

- Roughly 60% of the v0.1 implementation was ported from the [Comet](https://github.com/) reference codebase (CLI bootstrap, OpenSpec integration, file utilities).
- The pre-push hook can still be bypassed with `git push --no-verify`. The Rule layer is the primary defense.

[0.1.0]: https://github.com/ivyflow/ivyflow-cli/releases/tag/v0.1.0

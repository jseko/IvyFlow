## 1. Sprint 6.1 — Quality Calibration (core: quality-calibrator + stuck-detector + feedback-recorder)

- [x] 1.1 Create `src/core/quality-calibrator.ts` with `CalibrationConfig` and `CalibrationResult` interfaces, `calibrateThresholds()` function using P80 percentiles, data sufficiency check (≥ 5 data points), percentileThreshold configuration
- [x] 1.2 Add calibration profile I/O: read/write `.ivy/sessions/cache/calibration_profile.json`, version fields (`calibrationVersion`, `advisorVersion`, `ruleVersion`)
- [x] 1.3 Extend `stuck-detector.ts` with three-mode support (`fixed`/`adaptive`/`hybrid`), `adaptiveMode` config, `calibratedThresholds` field, clamping logic for hybrid mode
- [x] 1.4 Extend `feedback-recorder.ts` with `SuggestionQuality` interface: `effectiveness`, `accuracy`, `dismissedReasons`, `weeklyTrend`, `calibrationInfo`
- [x] 1.5 Extend `suggest.ts` command with `--calibrate` option, `--quality` option, `--show-expired` option, `--show-all` option
- [x] 1.6 Wire `ivy doctor --fix` to trigger calibration when feedback ≥ 50 entries (write to Derived Cache only, per §9.12)
- [x] 1.7 Unit tests for quality-calibrator (sufficient data, insufficient data, P80 accuracy vs naive mean, fixed/adaptive/hybrid modes), stuck-detector modes, feedback quality metrics

## 2. Sprint 6.2 — Suggestion Review (new: ivy review command)

- [x] 2.1 Create `src/commands/review.ts` with `ReviewOptions` and `ReviewSession` interfaces, interactive loop (suggestion-by-suggestion with accept/dismiss/snooze/ignore/quit)
- [x] 2.2 Implement batch mode (`--auto accept`, `--auto snooze --type X --snooze-days N`) in review.ts
- [x] 2.3 Expand `SuggestionStatus` to include `snoozed`, `expired`, `actioned`; add `expiresAt`, `qualityScore`, `dismissedReason` fields to Suggestion interface
- [x] 2.4 Implement suggestion expiration: auto-mark pending > 60d as expired, snooze revert logic (`expiresAt` → pending), `--show-expired` filter
- [x] 2.5 Implement visibility auto-adjustment: track consecutive dismissals per type, auto-downgrade visibility (normal → quiet → hidden), auto-dismiss on 3× snooze, auto-restore on acceptance recovery; severity NEVER changes
- [x] 2.6 Add `advisorVersion` and `calibrationVersion` to suggestion generation (v0.6+ suggestions carry version metadata)
- [x] 2.7 Unit tests for review command (interactive mode with mocked stdin, batch mode, snooze mechanism, expiration logic, visibility auto-adjustment, version tracing)

## 3. Sprint 6.3 — CI Check (new: ivy check command + ci-reporter)

- [x] 3.1 Create `src/core/ci-reporter.ts` with `CiMode` type (`full`/`stale`/`no`), `CiReport` interface, `nonBlocking: true` flag, CI_MODE-based method selection
- [x] 3.2 Create `src/commands/check.ts` with `CheckOptions` interface, CLI/Markdown/JSON output rendering (3 formats)
- [x] 3.3 Implement 3 execution modes in check.ts: `quick` (phase+githook+project.yaml), `standard` (quick+stuck+rollback+suggestion), `full` (standard+GitNexus+security)
- [x] 3.4 Implement `--env` mode: Node.js version check (≥ 18), Git repo status, openspec detection, GitNexus detection
- [x] 3.5 Implement exit code control: `--exit-code --fail-on none|stuck_critical|any_critical`
- [x] 3.6 Update `assets/hooks/ivy-git-prepush.sh` with embedded `ivy check` reminder for critical suggestions (non-blocking)
- [x] 3.7 Register `review` and `check` commands in CLI at `src/cli/index.ts` (add 2 commands, total becomes 11)
- [x] 3.8 Update `assets/manifest.json` to v5 including review/check configuration IDs
- [x] 3.9 Unit tests for ci-reporter (3 CI modes, output format snapshots), check command (3 modes, --env, exit codes, markdown/json output), pre-push hook integration

## 4. Sprint 6.4 — Enhanced Event Collection (experimental: git-watch + session-inferer + sessions)

- [x] 4.1 Create `src/core/git-watch.ts` with file-level event generation via `git diff-tree --name-status`, `file_save` event schema (path, status, commitHash, fileSize, insertions/deletions; NO file content per §9.11)
- [x] 4.2 Update `assets/hooks/ivy-session-tracker.sh` to v2 with Git Watch file-level event emission (experimental, opt-in by env var or config flag)
- [x] 4.3 Extend `events.jsonl` to v3 schema with `file_save` event type; maintain backward compatibility with v2 readers
- [x] 4.4 Extend `session-inferer.ts` with multi-signal scoring: time gap (weight 0.5), file overlap (weight 0.3), commit frequency (weight 0.2), combined confidence threshold (≥ 0.4), confidence label `low~medium`
- [x] 4.5 Unit tests for git-watch (file_save event format, content exclusion), events.jsonl v3 compatibility, multi-signal session inference accuracy vs baseline

## 5. Sprint 6.5 — Dashboard Enhancement (dashboard + check reporter)

- [x] 5.1 Add quality metrics renderer to `dashboard.ts`: effectiveness/accuracy display, per-type bar charts, weekly trend, calibration info
- [x] 5.2 Add `ivy dashboard --quality` flag to show suggestion quality panel
- [x] 5.3 Wire `ivy check --output markdown` and `ivy check --output json` report generation
- [x] 5.4 Unit tests for dashboard quality panel (snapshot tests with mock data), check report output format correctness

## 6. Sprint 6.6 — Testing, Documentation & Release

- [x] 6.1 Add evolution constraint checks: `scripts/check-suggest-redlines.js` extend for §9.11 (file content) and §9.12 (L1 modification); update `build.js` to include new checks
- [x] 6.2 Update CHANGELOG.md: add v0.6.0 section with all changes
- [x] 6.3 Update README.md and README.zh-CN.md: command list extended to 11, CI integration (`ivy check`) section, calibration overview
- [x] 6.4 Privacy statement: document file path handling (relative paths only, no content) and calibration cache location
- [x] 6.5 Extend `ivy doctor` with environment detection: Node.js version, Git, openspec, GitNexus; `--fix` shows recovery suggestions (never auto-installs per §9.4)
- [x] 6.6 Full regression test pass: run all CI checks, verify coverage ≥ 80% for new modules, ensure all existing v0.5 tests still pass
- [x] 6.7 npm publish v0.6.0

## 1. Sprint 5.1 — Data Trust Upgrade

- [x] 1.1 Detect and select Cline PreToolUse Hook availability; implement in detect.ts
- [x] 1.2 Fallback: implement file_save-level event tracking via git watch/inotify in detect.ts
- [x] 1.3 Implement noise filtering in session-inferer.ts (<1min single-event sessions → discard)
- [x] 1.4 Implement weekend detection (mark non-working-hour sessions as possible_batch_operation)
- [x] 1.5 Implement adjacent session merging (<5min gap → merge, record bias)
- [x] 1.6 Implement bias recording (gap, confidence, rule name per inference)
- [x] 1.7 Implement CalibratedInferenceConfig interface and calibration mode switch
- [x] 1.8 Implement TrendProfile interface and buildTrendProfile() in trend-analyzer.ts
- [x] 1.9 Implement Derived Cache read/write with 1h TTL checks in .ivy/sessions/cache/
- [x] 1.10 Wire Derived Cache into analytics.ts query path
- [x] 1.11 Add `--bias` flag to `ivy analytics` for bias log querying

## 2. Sprint 5.2 — Workflow Suggestions

- [x] 2.1 StuckResult interface and DEFAULT_STUCK_CONFIG with per-phase thresholds in stuck-detector.ts
- [x] 2.2 Implement stuck detection logic (phase duration > threshold → stuck_detected L2 event)
- [x] 2.3 Implement rollback detection (7d window, >2 rollbacks → warning)
- [x] 2.4 Implement PhaseReviewResult interface (reviewRecommended, NO suggestedNextPhase)
- [x] 2.5 Implement phase review logic (current duration vs historical average)
- [x] 2.6 Implement Suggestion interface (id, type, severity, change, message, action, confidence, status, timestamps)
- [x] 2.7 Implement suggest-engine.ts — orchestrates stuck/rollback/phase-review checks
- [x] 2.8 Implement suggest.ts command (ivy suggest —stuck, --json)
- [x] 2.9 Implement SuggestionFeedback and SuggestionQuality interfaces in feedback-recorder.ts
- [x] 2.10 Implement recordFeedback() — writes to .ivy/sessions/cache/suggestion_feedback.json
- [x] 2.11 Implement --mark-resolved with --action flag (accepted|dismissed|ignored)
- [x] 2.12 Wire quality metrics into ivy suggest --json output
- [x] 2.13 Wire suggest engine into git pre-push hook for stuck warning display

## 3. Sprint 5.3 — Dashboard Enhancement

- [x] 3.1 Implement commit trend ASCII bar chart rendering in dashboard.ts
- [x] 3.2 Implement phase duration bar chart (current vs average) with annotation
- [x] 3.3 Implement suggestion quality display (pending count, acceptance rate)
- [x] 3.4 Implement data source declaration section in all dashboard output
- [x] 3.5 Implement HTML export to .ivy/reports/ (Unicode block chars, no JS, embedded metadata)
- [x] 3.6 Implement --period flag for time-filtered trend rendering
- [x] 3.7 Verify strict Dashboard/Suggest Engine responsibility separation (code review)

## 4. Sprint 5.4 — Platform Extension

- [x] 4.1 Add Cline detection paths to detect.ts (platform config + install paths)
- [x] 4.2 Add Amazon Q Developer detection paths to detect.ts
- [x] 4.3 Add Cline + Amazon Q to PLATFORMS array in platforms.ts
- [x] 4.4 Update install paths: Cline (.cline/skills/ivy/, .cline/rules/)
- [x] 4.5 Update install paths: Amazon Q Developer
- [x] 4.6 Remove Windsurf Hook experimental label; mark as stable
- [x] 4.7 Update total platform count documentation to 11

## 5. Sprint 5.5 — Testing & Release

- [x] 5.1 TC-1: ivy suggest outputs stuck detection (auto test)
- [x] 5.2 TC-2: ivy suggest with no data outputs empty list (auto test)
- [x] 5.3 TC-3: Stuck detection threshold configurable (auto test)
- [x] 5.4 TC-4: Rollback detection (7d >2 rollbacks) (auto test)
- [x] 5.5 TC-5: Phase Review outputs reviewRecommended:true NOT suggestedNextPhase (auto test)
- [x] 5.6 TC-6: Feedback loop: --mark-resolved writes feedback file (auto test)
- [x] 5.7 TC-7: Derived Cache TTL read/refresh (auto test)
- [x] 5.8 TC-8: Dashboard trend chart rendering (auto test)
- [x] 5.9 TC-9: Dashboard HTML export (auto test)
- [x] 5.10 TC-10: Cline/Amazon Q init flow (auto test)
- [x] 5.11 TC-11: Windsurf Hook stable marker doesn't break install (auto test)
- [x] 5.12 TC-12: v0.4→v0.5 data compatibility (auto test)
- [x] 5.13 TC-13: Session inference calibration noise filtering (auto test)
- [x] 5.14 TC-14: Phase Review with no data returns null (auto test)
- [x] 5.15 TC-15: Dashboard/Suggest Engine responsibility separation (code review)
- [x] 5.16 Update CHANGELOG.md with [0.5.0] section
- [x] 5.17 Update README.md / README.zh-CN.md: 9 commands, Advisor positioning
- [x] 5.18 Update privacy notice: feedback data is local-only
- [x] 5.19 Ensure §9 red lines CI passes (§9.9, §9.10)
- [ ] 5.20 npm publish v0.5.0
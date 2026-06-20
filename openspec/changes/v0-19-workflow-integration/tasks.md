## 1. Worktree Manager Core Module

- [x] 1.1 Create `src/core/worktree-manager.ts` with `WorktreeInfo` interface (path, branch, changeName only)
- [x] 1.2 Implement `WorktreeManager.create()` — create worktree at `../.zcf/<project>/<name>` with new branch
- [x] 1.3 Implement `WorktreeManager.list()` — read from `git worktree list`, map to WorktreeInfo[]
- [x] 1.4 Implement `WorktreeManager.cleanup()` — remove worktree directory and branch
- [x] 1.5 Implement `WorktreeManager.cleanupAll()` — iterate and clean all completed worktrees
- [x] 1.6 Implement `WorktreeManager.status()` — aggregate summary (total/active/completed)
- [x] 1.7 Implement `WorktreeManager.merge()` — merge worktree branch to origin (merge/squash strategies)
- [x] 1.8 Add unit tests for WorktreeManager (TC-1 ~ TC-5)
- [x] 1.9 Verify WorktreeInfo contains only path/branch/changeName (no lifecycle state)

## 2. Task Dispatcher Core Module

- [x] 2.1 Create `src/core/task-dispatcher.ts` with Task interface (id, subject, description, status, blocks, blockedBy)
- [x] 2.2 Implement `TaskDispatcher.parseTasks()` — parse tasks.md into structured Task[]
- [x] 2.3 Implement `TaskDispatcher.findRunnableTasks()` — filter pending + no unresolved blockedBy
- [x] 2.4 Implement `TaskDispatcher.dispatchIndependentTasks()` — fork Agent processes with maxParallel=4 cap
- [x] 2.5 Implement task timeout enforcement (default 300s)
- [x] 2.6 Implement `TaskDispatcher.trackStatus()` — in-memory execution status tracking
- [x] 2.7 Implement `TaskDispatcher.aggregateResults()` — collect and report execution results
- [x] 2.8 Implement `sync-status` logic — present diff of [ ] → [x] changes for user confirmation
- [x] 2.9 Verify read-only: dispatcher does not write tasks.md structure
- [x] 2.10 Add unit tests for TaskDispatcher (TC-7 ~ TC-12)

## 3. OpenSpec Bridge Core Module

- [x] 3.1 Create `src/core/openspec-bridge.ts` with `OpenSpecBridgeOptions` interface
- [x] 3.2 Implement `OpenSpecBridge.translateEvent()` — map propose/apply/archive events to phase recommendations
- [x] 3.3 Implement `OpenSpecBridge.recommendPhase()` — output phase suggestion message, wait for user confirm
- [x] 3.4 Verify bridge does not modify proposal/design content
- [x] 3.5 Verify bridge does not auto-promote phases
- [x] 3.6 Add unit tests for OpenSpecBridge

## 4. CLI: Worktree Commands

- [x] 4.1 Create `src/commands/worktree.ts` with `ivy worktree` command tree
- [x] 4.2 Implement `ivy worktree create [--branch]` command
- [x] 4.3 Implement `ivy worktree list` command
- [x] 4.4 Implement `ivy worktree cleanup <name>` command
- [x] 4.5 Implement `ivy worktree cleanup-all` command
- [x] 4.6 Implement `ivy worktree merge <name> [--strategy]` command
- [x] 4.7 Implement `ivy worktree status` command
- [x] 4.8 Register worktree commands in CLI index

## 5. CLI: Dispatch Commands

- [x] 5.1 Create `src/commands/dispatch.ts` with `ivy dispatch` command tree
- [x] 5.2 Implement `ivy dispatch [--tasks] [--parallel]` command
- [x] 5.3 Implement `ivy dispatch status` command
- [x] 5.4 Implement `ivy dispatch sync-status [--apply]` command
- [x] 5.5 Register dispatch commands in CLI index

## 6. CLI: Propose/Apply/Archive Enhancement

- [x] 6.1 Implement `ivy propose <name>` — wraps `/opsx:propose` + recommend_phase: DESIGN
- [x] 6.2 Implement `ivy apply <name>` — wraps `/opsx:apply` + recommend_phase: VERIFY
- [x] 6.3 Enhance `ivy archive --change <name>` with `--cleanup-worktree` option
- [x] 6.4 Register propose/apply commands in CLI index

## 7. Integration Tests

- [x] 7.1 Add E2E-1: Worktree full lifecycle test (create → develop → archive → cleanup)
- [x] 7.2 Add E2E-2: Dispatch full lifecycle test (parse → dispatch → track → aggregate)
- [x] 7.3 Add E2E-3: OpenSpec full lifecycle test (propose → apply → phase link → archive)
- [x] 7.4 Add capability boundary tests (dispatcher_not_scheduler, no_persistent_state, phase_is_label_only, worktree_no_lifecycle_state, tasks_md_read_only)

## 8. v0.19.5: Archive Cleanup

- [ ] 8.1 Create `src/core/archive-cleanup.ts` with archiveCleanup function
- [ ] 8.2 Implement archive cleanup hook — triggers when phase changes to ARCHIVE
- [ ] 8.3 Wire archive cleanup into lifecycle-projection

## 9. v0.19.5: Parallel Propose Enhancement

- [ ] 9.1 Enhance OpenSpecBridge to support parallel artifact generation
- [ ] 9.2 Implement `ivy propose --parallel` flag

## 10. v0.19.5: Dispatch Recommend Enhancements

- [ ] 10.1 Implement `ivy dispatch --recommend` — suggest runnable tasks, user confirms
- [ ] 10.2 Implement `ivy dispatch --recommend-phase` — suggest phase promotion, user confirms

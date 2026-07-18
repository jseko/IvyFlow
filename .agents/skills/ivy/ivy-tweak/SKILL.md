---
name: ivy-tweak
description: IvyFlow Tweak preset — small change shortcut that skips brainstorming and full plan, with lightweight build and verify.
---

# IvyFlow Tweak

小改动快捷路径。跳过 brainstorming 和完整 plan，轻量 build + 轻量 verify。

## 前置条件

- 不新增 capability
- 不改变架构
- 不涉及接口变化
- ≤ 3 个 tasks

## Steps

### 0. Entry State Verification

```bash
ivy state show
ivy workflow preset --detect
```

Verify the preset is `tweak`. If the preset detection suggests upgrade to `full`, stop and inform the user to use `/ivyflow` instead.

### 1. Create Change Structure

Load the `openspec-new-change` skill to create the OpenSpec change structure. Use a `tweak:` prefixed name.

### 2. Initialize State

```bash
ivy workflow start "<change-name>" --preset tweak
```

### 3. Execute Lightweight Build

Load the `ivy-build` skill with tweak defaults:
- `build_mode: direct`
- `tdd_mode: direct`
- `isolation: branch`

No brainstorming, no writing-plans. Implement directly. Keep changes minimal and focused.

### 4. Commit

```bash
git add -A && git commit -m "tweak: <简述变更>"
```

### 5. Guard Transition

```bash
ivy guard build --apply
```

### 6. Lightweight Verify

Load the `ivy-verify` skill. Verification is lightweight (≤ 3 tasks, ≤ 4 files):
- All tasks completed
- Changed files match task descriptions
- Compilation passes
- Related tests pass
- No obvious security issues
- Simplified code review (correctness, security, boundary conditions only)

### 7. Archive

Follow the standard `ivy-archive` skill.

## Upgrade to Full

If any upgrade condition is met during execution:
- 5+ files changed
- Cross-module coordination required
- 5+ new test cases needed
- Config items added or removed (not value changes)
- New capability or delta spec needed

Stop immediately and inform the user. Run:

```bash
ivy state set design
```

Then use `/ivyflow-design` to continue with full workflow.

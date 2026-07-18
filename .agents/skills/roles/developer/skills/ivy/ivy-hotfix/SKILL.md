---
name: ivy-hotfix
description: IvyFlow Hotfix preset — bug fix shortcut that skips brainstorming and full plan, with upgrade-to-full protocol and debug gate.
---

# IvyFlow Hotfix

Bug 修复快捷路径。跳过 brainstorming 和完整 plan，直接进入 build 阶段。

## 前置条件

- 修复已有功能的 bug，不新增 capability
- 不涉及接口变更或架构调整
- 改动范围 ≤ 2 个文件

## Steps

### 0. Entry State Verification

```bash
ivy state show
ivy workflow preset --detect
```

Verify the preset is `hotfix`. If the preset detection suggests upgrade to `full`, stop and inform the user to use `/ivyflow` instead.

### 1. Create Change Structure

Load the `openspec-new-change` skill to create the OpenSpec change structure. Use a `fix:` prefixed name.

### 2. Initialize State

```bash
ivy workflow start "<change-name>" --preset hotfix
```

### 3. Execute Build

Load the `ivy-build` skill with hotfix defaults:
- `build_mode: direct`
- `tdd_mode: direct`
- `isolation: branch`

No brainstorming, no writing-plans. Implement the fix directly.

### 4. Debug Gate

If any crash, exception, test failure, or build failure occurs during implementation:
- Load the Superpowers `systematic-debugging` skill
- Reproduce and identify root cause before proposing any fix
- Add a minimal failing test
- Fix and verify all tests pass

### 5. Root Cause Elimination Check

After fixing, verify:
- The root cause is addressed (not just the symptom)
- No similar patterns exist elsewhere in the codebase
- If similar patterns found, expand scope or recommend upgrading to full workflow

### 6. Commit

```bash
git add -A && git commit -m "fix: <简述修复>"
```

### 7. Guard Transition

```bash
ivy guard build --apply
```

### 8. Verify and Archive

Follow the standard `ivy-verify` and `ivy-archive` skills.

## Upgrade to Full

If any upgrade condition is met during execution:
- 3+ files changed
- Architecture change (new module, new interface, new dependency)
- Database schema change
- New public API introduced
- Scope exceeds single function/module

Stop immediately and inform the user. Run:

```bash
ivy state set design
```

Then use `/ivyflow-design` to continue with full workflow.

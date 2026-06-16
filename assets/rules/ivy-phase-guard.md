# Ivy Phase Guard

> 本规则文件随 IvyFlow Skill 一起分发到 `.claude/rules/ivy-phase-guard.md`，
> 是 9 步工作流阶段守卫的**主防线**（Primary Defense）。Git pre-push hook
> 是兜底（Secondary）。AI Agent 在每轮工作前必须读取本规则。

## 合法 Phase 列表

<!-- DO NOT EDIT: synced from src/core/phase-machine.ts -->
- `open`
- `design`
- `build`
- `verify`
- `archive`
<!-- END DO NOT EDIT -->

## 合法状态转移

| From | Allowed To |
|------|------------|
| `open` | `design` |
| `design` | `build` / `open` |
| `build` | `verify` / `design` |
| `verify` | `archive` / `build` |
| `archive` | （终态） |

> **VERIFY → DESIGN 不允许**。如需重做设计，请先 `verify → build → design`。

## 阶段约束（Agent 必读）

### `open` — 需求开口

- ✅ 允许：阅读现有代码、生成 proposal.md / design.md / specs/ / tasks.md 初稿
- ❌ 禁止：创建 / 修改任何业务代码文件、运行 `git commit`

### `design` — 设计澄清

- ✅ 允许：修订 design.md、specs/、tasks.md；与用户进行 Brainstorming
- ❌ 禁止：创建 / 修改任何业务代码文件

### `build` — 实现

- ✅ 允许：按 tasks.md 顺序实现代码；TDD（RED → GREEN → REFACTOR）
- ❌ 禁止：未通过质量门禁就推进到 `verify`

### `verify` — 验证

- ✅ 允许：代码审查、编译验证、测试执行；修复 CRITICAL / HIGH 问题
- ❌ 禁止：在测试未全绿前推进到 `archive`；回退到 `design`（必须先回 `build`）

### `archive` — 归档

- ✅ 允许：生成 `implementation-report.md`、`git push`、创建 PR
- ❌ 禁止：从 `archive` 反向流转（终态）

## 推送守卫

- 分支命名：`ivy/<change-name>` 触发守卫
- `.ivy.yaml#phase` 不为 `archive` 时，`git push` 会被 pre-push hook 拦截
- 用户可通过 `git push --no-verify` 绕过；这是 enforcer 不是 sandbox

## 与状态机源的关系

合法 phase 列表与转移表的**唯一权威来源**是 `src/core/phase-machine.ts`。
本文件由 `scripts/sync-phases.ts` 在构建时从 enum 派生，CI 校验一致性。
不要手工编辑顶部的 `DO NOT EDIT` 块。

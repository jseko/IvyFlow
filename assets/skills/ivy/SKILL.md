---
name: ivy
description: IvyFlow 9-step workflow enforcer skill — drives a complete development loop from requirement input to archival, strictly following the OpenSpec workflow.
---

# IvyFlow 开发工作流 Skill

本 skill 驱动从**需求输入**到**归档**的完整开发闭环，严格遵循 OpenSpec 工作流。
支持主流后端、主流前端和多种构建工具的通用项目。

每个交互节点需等待用户确认后再继续，跳过确认会导致需求理解偏差和返工。

## 五阶段别名层

> Open / Design / Build / Verify / Archive 是完整流程的上层表达别名，仅用于沟通、汇报和方法论对齐；实际执行以本文档各步骤为准。

| Alias Stage | Workflow Scope |
|-------------|-------------------------|
| Open | P0/P1/P3 + 步骤一初稿 artifacts |
| Design | Brainstorming 修订 + 步骤二文档确认 |
| Build | 步骤三 TDD 实现 |
| Verify | 质量门禁（审查+编译+测试+确认） |
| Archive | 步骤八实现报告 + 步骤九归档确认 |

## 交互节点分级

| 分级 | 节点 | 授权边界 |
|------|------|----------|
| 强确认 | 步骤二文档确认、步骤九归档确认 | 默认必须人工确认；仅本轮用户显式授权或 CI/CD 自动化场景可跳过 |
| 可自动确认 | Brainstorming 选择、质量门禁完成确认 | 可在用户显式授权或 CI/CD 自动化场景下跳过；不得由模型自行判断跳过 |

## 流程顺序约定

1. **按顺序执行**：P0 → P1/P3 → 步骤一（文档） → 步骤二（确认） → 步骤三（代码） → ... → 步骤九（归档）
2. **已有代码也不例外**：即使存在部分代码，也需完整执行步骤一生成所有文档
3. **文档先于代码**：步骤二用户确认文档之前，**不应创建或修改任何代码文件**
4. **步骤三的前置条件**：proposal.md、design.md、specs/、tasks.md 全部存在且通过步骤二确认
5. **探索优先**：用户输入含 `探索`、`交互式`、`/opsx:propose` → 触发探索快速通道（见 [`references/explore-fast-track.md`](references/explore-fast-track.md)）
6. **Brainstorming 在初稿之后**：必须使用 `AskUserQuestion` 询问是否启用 Brainstorming 修订
7. **🔴 每步必提示下一步**：每个步骤完成后必须主动展示下一步操作。严禁静默停止
8. **🔴 上下文传递，避免重复读取**：步骤间共享已读文件内容，不得对同一文件重复调用 `read_file`

## 阶段状态机（与 ivy-phase-guard.md 同源）

合法 phase：`open` / `design` / `build` / `verify` / `archive`。状态机由 `core/phase-machine.ts` 单一定义，禁止跳跃式流转：

- `open -> design`
- `design -> build | open`
- `build -> verify | design`
- `verify -> archive | build`（**`verify -> design` 不允许**）
- `archive` 终态

`ivy validate` 会基于该状态机校验 `.ivy.yaml` 中 `phase` 与 `phase_history`。Git pre-push hook 在非 `archive` 阶段拦截推送。

## 探索快速通道（最高优先级）

**触发条件**：用户输入包含 `探索`、`交互式`、`/opsx:propose` → 立即走快速通道。

**摘要**：P0 自动完成（默认 standard）→ P1/P3 → 提炼提案名称 → `Skill("opsx:propose")` 生成初稿 → 验证完整性 → Brainstorming 交互修订 → 反写 artifacts → 步骤二确认。

**完整规范** → 读取 [`references/explore-fast-track.md`](references/explore-fast-track.md)

## 前置条件 P0~P3

> 在接收用户需求、执行任何开发步骤之前，先建立项目画像并验证环境。
>
> ⚠️ 约束：P0 阶段仅读取项目说明文档、配置文件和目录结构，不读取已有业务代码。

| 阶段 | 目标 |
|------|------|
| P0.1 | 读取项目画像 |
| P0.2 | 校验画像设置核心变量 |
| P0.3 | 选择执行模式 (quick / standard / full) |
| P0.4 | 自动检测变量 (CI_MODE, E2E_FRAMEWORK) |

**完整规范** → 读取 [`references/prerequisites.md`](references/prerequisites.md)

## 步骤一：解析需求，创建提案与测试用例文档

**目标**：生成 proposal.md、design.md、specs/、tasks.md 全套 OpenSpec 文档。

**执行时加载** → [`references/step1-document-generation.md`](references/step1-document-generation.md)

## 步骤二：【强确认节点】提案文档确认

> ⏸️ **强确认：等待用户确认。**

展示已生成文档路径清单，请用户检查并回复 `[确认无误]` 或 `[需要修改]`。

修复约束：技术方案须与技术栈兼容；任务粒度 1-4 小时；最多迭代 3 轮。

## 步骤三：代码实现

> ⚠️ 前置条件：proposal.md / design.md / specs/ / tasks.md 全部通过步骤二确认。

按 tasks.md 顺序逐个实现。核心纪律：

- **一任务一标记 `[x]`**：完成即标记
- **TDD 纪律**（`ENABLE_UNIT_TEST=on`）：RED → GREEN → REFACTOR
- **Agent 分派**：每个代码文件由专业 Agent 实现
- **调试止损**：同一 Bug ≥ 3 次 → BLOCKED
- **设计歧义暂停**：向用户提问，不自行假设

**执行时加载** → [`references/step3-implementation.md`](references/step3-implementation.md)

## 质量门禁（合并步骤四~七）

按序连续执行：代码审查 → 编译验证 → 测试执行 → Gate 验证 → 向用户汇报。

**关键规则**：
- **Iron Law**：NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
- **重试上限**：同一 Bug / 编译错误 ≥ 3 次 → BLOCKED
- **复杂度自适应**：变更文件 > 5 个或跨模块时，审查步骤展开深度审查

**完整规范** → 读取 [`references/step4-7-quality-gates.md`](references/step4-7-quality-gates.md)

## 步骤八：生成功能实现报告

生成 `implementation-report.md`（变更文件、测试结果、风险评估）。

## 步骤九：【强确认节点】归档确认

> ⏸️ **强确认**。

请用户选择：(1) 归档到本地 (2) 推送并创建 PR (3) 保留当前状态 (4) 丢弃变更。

**步骤八/九完整规范** → [`references/step8-9-closure.md`](references/step8-9-closure.md)

## 完整流程状态机

```
用户输入 → [探索?] 是→快速通道 / 否→P0 → 步骤一(文档) → [Brainstorming?]
  → 步骤二(确认) → 步骤三(实现) → 质量门禁(审查+编译+测试+确认)
  → 步骤八(报告) → 步骤九(归档) → ✅
```

## 关键约束（全程遵守）

1. **流程顺序与变量驱动**：按 P0→步骤九顺序执行；命令通过核心变量动态生成
2. **文档先于代码**：步骤二确认前不创建/修改代码文件
3. **🔴 上下文传递**：步骤间共享已读文件内容，仅文件可能已变更或距上次读取超过 5 轮时重读
4. **🔴 每步必提示下一步**：严禁静默停止
5. **任务标记即时性**：完成即 `[x]`
6. **重试上限**：提案修复/编译修复最多 3 轮；同一 Bug ≥ 3 次 → BLOCKED
7. **Phase Machine 同源**：合法 phase 列表必须与 `core/phase-machine.ts` 的 `IvyPhase` enum 一致

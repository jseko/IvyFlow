---
name: ivy-dev-workflow
description: >
  当用户提出功能开发需求时使用：自动检测技术栈 → 生成提案/设计/任务文档 →
  用户确认 → Agent 分派实现代码 → 审查/编译/测试 → 归档。
  任何涉及新增功能、模块开发、功能修改的请求都应触发此 skill，包括但不限于
  "新增XX功能"、"开发XX模块"、"实现XX"、"做一个XX"、"加一个XX"、
  "帮忙做XX"、"项目需要XX"、"从头搞XX"、"走一遍完整开发流程"、
  "按openspec流程做XX"等。不要用于纯技术问答、代码解释、bug调试、配置查询。
  检测到"探索"、"交互式"等关键词时，自动走探索快速通道（跳过执行模式选择，
  先委托 opsx:propose 生成 OpenSpec 初稿文档，再进入 Brainstorming 交互入口，
  根据用户选择修订 artifacts 后进入步骤二确认）。未检测到探索关键词时，
  在 P0/P1/P3 完成后先生成初稿文档，再询问用户是否启用 Brainstorming。
compatibility:
  - openspec (>=0.0.1)
  - git
  - npm
---

# Ivy 开发工作流 Skill

本skill驱动从**需求输入**到**归档**的完整开发闭环，严格遵循 OpenSpec 工作流。
支持主流后端（Spring Boot、Express、Django、Go、Rust）、主流前端（Vue 3、React、Angular）
和多种构建工具（Maven、Gradle、npm/pnpm/yarn、Go、Cargo）的通用项目。

每个交互节点需等待用户确认后再继续，跳过确认会导致需求理解偏差和返工。

## 五阶段别名层

> Open / Design / Build / Verify / Archive 是完整流程的上层表达别名，仅用于沟通、汇报和方法论对齐；实际执行以本文档各步骤为准。

| Alias Stage | Existing Workflow Scope |
|-------------|-------------------------|
| Open | P0/P1/P3 + 步骤一初稿 artifacts |
| Design | Brainstorming 修订 + 步骤二文档确认 |
| Build | 步骤三 TDD 实现 |
| Verify | 质量门禁（审查+编译+测试+确认） |
| Archive | 步骤八实现报告 + 步骤九归档确认 |

若五阶段别名与实际步骤产生解释冲突，以本文档步骤描述为准。

## 交互节点分级

| 分级 | 节点 | 授权边界 |
|------|------|----------|
| 强确认 | 步骤二文档确认、步骤九归档确认 | 默认必须人工确认；仅本轮用户显式授权自动执行或 CI/CD 自动化场景可跳过 |
| 可自动确认 | Brainstorming 选择、质量门禁完成确认 | 可在本轮用户显式授权自动执行或 CI/CD 自动化场景下跳过；不得由模型自行判断跳过 |

可自动确认不是可随意省略。未获得本轮自动化授权且非 CI/CD 场景时，仍必须展示确认节点并等待用户回复。

## 流程顺序约定

> 以下顺序是经过验证的最佳路径，跳过步骤会导致文档与代码不一致、审查遗漏或测试缺失。

1. **按顺序执行**：P0 → P1/P3 → 步骤一（文档） → 步骤二（确认） → 步骤三（代码） → ... → 步骤九（归档）。顺序保证了每个阶段的输入来自上一阶段的输出。
2. **已有代码也不例外**：即使项目中已存在该功能的部分代码文件，也**需要完整执行步骤一生成所有文档**。已有代码在步骤三中按 tasks.md 逐任务审查/补全/修复。
3. **文档先于代码**：步骤二用户确认文档之前，**不应创建或修改任何代码文件**。
4. **步骤三的前置条件**：proposal.md、design.md、specs/、tasks.md 全部存在且通过步骤二确认。
5. **探索优先**：用户输入含 `探索`、`交互式`、`/opsx:propose` → 触发探索快速通道（→ 读取 [`references/explore-fast-track.md`](references/explore-fast-track.md)）。
6. **Brainstorming 发生在初稿之后**：初稿完成后必须使用 `AskUserQuestion` 询问是否启用 Brainstorming 修订。用户明确说"不要头脑风暴/直接确认/跳过澄清/自动执行"时，可跳过并记录。
7. **🔴 每步必提示下一步**：每个步骤完成后**必须**主动展示下一步操作。严禁静默停止。
8. **🔴 上下文传递，避免重复读取**：步骤间共享已读文件内容，不得对同一文件重复调用 `read_file`。仅在以下情况可重读：(a) 文件可能已被用户或 Agent 修改（如步骤三实现后进入步骤四审查前）；(b) 距上次读取已超过 5 轮对话。P0 阶段读取的源码内容应延续到步骤三使用。

---

## 附属文件索引

### 核心参考文档（references/）

| 文件 | 用途 |
|------|------|
| **`explore-fast-track.md`** | 探索快速通道完整流程 |
| **`prerequisites.md`** | P0 项目画像 + P1/P3 初始化 |
| **`step1-document-generation.md`** | 步骤一 1.0-1.10 文档生成 |
| **`step3-implementation.md`** | 步骤三 3.0-3.7 代码实现 |
| **`step4-7-quality-gates.md`** | 步骤四~七质量门禁 |
| **`step8-9-closure.md`** | 步骤八九收尾归档 |

### 按需参考文档

> 仅在对应场景触发时读取，不预加载。

| 触发场景 | 文件 |
|----------|------|
| 技术栈检测 | `detection-rules.md`, `tool-mapping.md`, `build-commands.md` |
| Agent 分派 | `agent-mapping.md`, `agent-specs.md` |
| 设计生成 | `design-generation-guide.md` |
| 代码智能 | `code-intelligence-layer.md` |
| 安全/可观测性 | `cross-cutting.md`, `overview.md` |
| E2E 测试 | `playwright-conventions.md` |
| 调试 | `systematic-debugging.md`, `root-cause-tracing.md` |
| Delta Spec | `delta-spec-patterns.md` |
| 扩展技术栈 | `extensibility-guide.md`, `paths-config.md` |

### 模板文件（templates/）

| 文件 | 使用阶段 |
|------|----------|
| `proposal-template.md` | 步骤 1.3 |
| `design-template.md` | 步骤 1.4 |
| `spec-template.md` | 步骤 1.5 |
| `tasks-template.md` | 步骤 1.7 |
| `review-prompt.md` | 质量门禁（复杂度自适应） |
| `implementation-report.md` | 步骤八 |

---

## 探索快速通道（最高优先级）

> **在进入 P0 之前，首先检测用户输入是否包含探索关键词。这是整个工作流的第一道判断，优先于所有后续步骤。**

**触发条件**：用户输入包含 `探索`、`交互式`、`/opsx:propose` → 立即走快速通道。

**摘要**：P0 自动完成（默认 standard）→ P1/P3 → 提炼提案名称 → `Skill("opsx:propose")` 生成初稿 → 验证完整性 → Brainstorming 交互修订 → 反写 artifacts → 步骤二确认。

**关键行为**：
1. P0.3 自动设为 `standard`，不询问用户
2. 必须通过 Skill 工具委托 `opsx:propose` 生成初稿，**禁止**主 agent 手动执行 `openspec new change` 等操作
3. Brainstorming 必须基于初稿进行，**禁止**在 artifacts 生成前执行空白需求澄清
4. Brainstorming 完成后 **🔴 必须立即展示步骤二的完整确认模板**，严禁只说"探索完成"

**完整流程规范** → 读取 [`references/explore-fast-track.md`](references/explore-fast-track.md)

---

## 前置条件 P0~P3

> 在接收用户需求、执行任何开发步骤之前，先建立项目画像并验证环境。

**⚠️ 约束：P0 阶段仅读取项目说明文档、配置文件和目录结构，不读取已有业务代码。**

| 阶段 | 目标 | 关键动作 |
|------|------|----------|
| P0.1 | 读取项目画像 | 优先级：用户指定 > 画像缓存 > 项目文档 > 配置文件 > 自动扫描 |
| P0.2 | 校验画像设置核心变量 | `{PROJECT_TYPE}`, `{BACKEND_STACK}`, `{FRONTEND_STACK}`, `{BUILD_TOOL}`, `{TEST_FRAMEWORK}` |
| P0.2.Fallback | 缺失/冲突时自动检测 | 扫描配置文件和目录结构 |
| P0.3 | 选择执行模式 | quick / standard / full（探索快速通道自动 standard） |
| P0.4 | 自动检测变量 | `CI_MODE`, `E2E_FRAMEWORK` |

**模式 → 子开关推导**：quick（仅 ASCII 图+会议解析）→ standard（+代码审查+单元测试+知识归档）→ full（+安全审查+E2E+条件 Plan Agent）

**完整规范（含 P0.1-P0.4 详细步骤、模式推导表、P1-P3 安装初始化、输出模板）** → 读取 [`references/prerequisites.md`](references/prerequisites.md)

---

## 代码智能层（GitNexus）

> 由 P0.4 自动检测 CI_MODE（full/stale/no）。6 个抽象接口统一封装所有 GitNexus 调用，CI_MODE=no 时自动降级。完整接口 → [`references/code-intelligence-layer.md`](references/code-intelligence-layer.md)

### 文档生成阶段检索（步骤一）

| 时机 | 接口 | 检索目标 |
|------|------|---------|
| proposal 生成前 | `ci_query` + `ci_clusters` | 已有实现、受影响模块、归属位置 |
| design 生成前 | `ci_query` + `ci_context` + `ci_processes` | 设计模式、可复用组件、调用链 |

**调用原则**：优先 GitNexus → 静默降级 → 检索结果写入文档 → **不检索则不准写**

---

## 步骤一：解析需求，创建提案与测试用例文档

**目标**：生成 proposal.md、design.md、specs/、tasks.md（+ test-cases.md 当 `ENABLE_UNIT_TEST=on`）全套 OpenSpec 文档。

**Brainstorming 修订判断**：探索关键词 → 强制 Brainstorming；明确跳过 → 记录；其他 → `AskUserQuestion` 询问。

**执行时加载** → [`references/step1-document-generation.md`](references/step1-document-generation.md)（含 1.1-1.10 子步骤、模板要点、Self-Review 检查清单）

**步骤一完成后** → 进入 Brainstorming 或步骤二

---

## 需求分析 / 设计 / 测试规范

> 需求分析由主 agent 直接执行；Plan Agent 条件触发（>5 Entity / 跨模块 / 新架构模式）；Spec→Test 派生规则和诊断流程 → [`references/agent-specs.md`](references/agent-specs.md)

---

## 步骤二：【强确认节点】提案文档确认

> ⏸️ **强确认：等待用户确认。** 降级策略：仅本轮用户明确"自动执行"或 CI/CD 场景可跳过。

展示已生成文档路径清单（proposal.md、design.md、specs/、tasks.md），请用户检查并回复 [确认无误] 或 [需要修改]。

修复约束：技术方案须与技术栈兼容；任务粒度 1-4 小时；最多迭代 3 轮。

---

## 步骤三：代码实现

> ⚠️ 前置条件：proposal.md / design.md / specs/ / tasks.md 全部存在且通过步骤二确认。

按 tasks.md 顺序逐个实现。核心纪律：
- **一任务一标记 `[x]`**：完成即标记
- **TDD 纪律**（`ENABLE_UNIT_TEST=on`）：RED → GREEN → REFACTOR，违规则 STOP
- **Agent 分派**：每个代码文件由专业 Agent 实现（路由见 [`references/agent-mapping.md`](references/agent-mapping.md)）
- **调试止损**：同一 Bug ≥ 3 次 → BLOCKED，禁止第 4 次自动修复
- **设计歧义暂停**：向用户提问，不自行假设

**执行时加载** → [`references/step3-implementation.md`](references/step3-implementation.md)（含 3.0-3.7 子步骤、TDD 纪律、Agent 分派路由、Delta Spec）

**步骤三完成后** → 立即进入质量门禁

---

## 质量门禁（合并原步骤四~七）

> 步骤三完成后立即进入，按序连续执行，内部失败自动修复（最多3次），全部通过后才向用户汇报。

### 执行流程

1. **代码审查**（`ENABLE_CODE_REVIEW=on` 时）— 读变更文件 → 静态检查（冗余/泄漏/类型安全）→ 分级报告（CRITICAL > HIGH > MEDIUM > LOW）→ 修复 CRITICAL/HIGH
2. **编译验证** — `{BUILD_TOOL}` 编译 → 失败则最小修复（不抑制警告）
3. **测试执行**（`ENABLE_UNIT_TEST=on` 时）— 全量回归 → 失败修复 → 覆盖率检查
4. **Gate 验证** — 检查 tasks.md 标记 + `git diff --name-only` vs tasks.md 预期 + Delta Spec
5. **向用户汇报** — 展示编译/测试/tasks/变更文件证据，请回复 [功能完成] 或 [需要优化]

### 关键规则

- **Iron Law**：NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE。不可凭记忆声称完成，必须展示运行时证据。
- **重试上限**：同一 Bug / 编译错误 ≥ 3 次 → BLOCKED，禁止第 4 次自动修复。
- **复杂度自适应**：变更文件 > 5 个或跨模块时，审查步骤自动加载 `templates/review-prompt.md` 展开深度审查。

**完整规范（审查 Agent 分派、反馈 6 步响应、E2E、覆盖率）** → 读取 [`references/step4-7-quality-gates.md`](references/step4-7-quality-gates.md)

**质量门禁通过后** → 进入步骤八：生成实现报告

---

## 步骤八：生成功能实现报告

生成 `implementation-report.md`（变更文件、颜色方案、测试结果、风险评估）。

**执行时加载** → [`references/step8-9-closure.md`](references/step8-9-closure.md) + [`templates/implementation-report.md`](templates/implementation-report.md)

**v0.10 交接协议（归档前执行）**：
1. `ivy verify --change <name>` — 运行质量门禁，生成证据报告
2. `ivy export metrics --pipe` — 导出项目数据的便携 JSON 快照
3. `ivy archive --change <name> --adr` — 归档时生成 ADR 决策记录
4. `ivy release --change <name>` — 打包归档报告、知识、证据、L0 记忆

**步骤八完成后** → 进入步骤九：归档确认

---

## 步骤九：【强确认节点】归档确认

> ⏸️ **强确认**。降级策略：仅本轮用户明确"自动执行"或 CI/CD 场景可跳过。

请用户选择：(1) 归档到本地 (2) 推送并创建 PR (3) 保留当前状态 (4) 丢弃变更（需输入 'discard'）。

**执行时加载** → [`references/step8-9-closure.md`](references/step8-9-closure.md)

---

## 安全护栏

> 三层架构：事前防御 → 事中控制 → 事后审核。**AI 扫描不等同于专业 SAST 工具**。完整架构和免责声明 → [`references/cross-cutting.md`](references/cross-cutting.md)

---

## 可观测性与成本管控

> Token 预算：quick ~26K / standard ~64K / full ~82K。告警 1.2x，硬上限 1.5x，2x 自动降级。 → [`references/cross-cutting.md`](references/cross-cutting.md)

---

## 知识记忆引擎

> 标签匹配 ≥ 2 触发检索 → 同主题保留最新 3 条 → 6 月未访问移至 archive。 → [`references/cross-cutting.md`](references/cross-cutting.md)

---

## 文件结构总览

> v3.2 新增目录和参考文件。完整目录树 → [`references/overview.md`](references/overview.md)

---

## 架构决策记录

> 7 个关键 ADR → [`references/overview.md`](references/overview.md) | 详细文件 → `design/adr/`

---

## 风险与缓解矩阵

> 9 项已知风险 → [`references/overview.md`](references/overview.md)

---

## 完整流程状态机

```
用户输入 → [探索?] 是→快速通道 / 否→P0 → 步骤一(文档) → [Brainstorming?]
  → 步骤二(确认) → 步骤三(实现) → 质量门禁(审查+编译+测试+确认)
  → 步骤八(报告) → 步骤九(归档) → ✅
```

---

## 关键约束（全程遵守）

1. **流程顺序与变量驱动**：按 P0→步骤九顺序执行；所有命令通过核心变量动态生成，不硬编码。
2. **文档先于代码**：步骤二确认前不创建/修改代码文件。P0 仅检测配置，不读取业务代码。
3. **🔴 上下文传递，避免重复读取**：步骤间共享已读文件内容，仅文件可能已变更或距上次读取超过 5 轮时重读。
4. **🔴 每步必提示下一步**：严禁静默停止。质量门禁通过后汇报结果并请用户确认。
5. **任务标记即时性**：完成即 `[x]`，汇报前检查遗漏。
6. **重试上限**：提案修复/编译修复最多 3 轮；同一 Bug ≥ 3 次 → BLOCKED。
7. **文档生成前代码检索优先**：proposal/design 生成前必须检索现有代码，Impact/Context 章节引用实际结果。

---

## 扩展性指引

> 新增技术栈/构建工具/测试框架 → [`references/extensibility-guide.md`](references/extensibility-guide.md)

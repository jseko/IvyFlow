---
name: ivy
description: IvyFlow 9-step workflow enforcer skill — drives a complete development loop from requirement input to archival, strictly following the OpenSpec workflow.
---

# IvyFlow 开发工作流 Skill

本 skill 驱动从**需求输入**到**归档**的完整开发闭环，严格遵循 OpenSpec 工作流。
SKILL.md 由四个语义区块组成（ROUTER / CONSTRAINTS / VARIABLES / REFERENCES），
每个区块由 HTML 注释标记，单区块 ≤ 50 行。详细内容延迟加载至 references/。

<!-- BLOCK 1: ROUTER ============================================ -->

## 阶段路由（Phase Router）

根据用户输入的阶段标签或当前 `.ivy.yaml` 的 `phase` 字段，路由到对应步骤：

| 输入特征 | 当前 phase | 路由动作 |
|---|---|---|
| 含 `探索` / `交互式` / `/opsx:propose` | 任意 | 探索快速通道 → [`references/explore-fast-track.md`](references/explore-fast-track.md) |
| 新需求 / 无 `.ivy.yaml` | — | P0 项目画像 → 步骤一文档生成 |
| `phase: open` | open | 步骤一文档生成（仅文档，禁止代码编辑） |
| `phase: design` | design | 步骤二文档确认（强确认） |
| 文档已确认 | design → build | 步骤三代码实现（TDD + Agent 分派） |
| `phase: build` | build | 质量门禁（审查 → 编译 → 测试 → 确认） |
| `phase: verify` | verify | 步骤八生成实现报告 |
| `phase: archive` | archive | 步骤九归档确认（强确认） |

阶段流转必须遵守状态机（见 BLOCK 4 phase-state-machine 引用）：
`open → design → build → verify → archive`，禁止 `verify → design`。

<!-- BLOCK 1 END ================================================ -->

<!-- BLOCK 2: CONSTRAINTS ======================================= -->

## 全程约束（Constraints）

1. **流程顺序**：P0 → 步骤一 → 步骤二 → 步骤三 → 质量门禁 → 步骤八 → 步骤九，禁止跳跃。
2. **文档先于代码**：步骤二未通过确认时，禁止创建或修改代码文件。
3. **强确认节点**：步骤二、步骤九默认必须人工确认；仅本轮显式授权或 CI/CD 场景可跳过。
4. **可自动确认**：Brainstorming、质量门禁完成；不得由模型自行判断跳过。
5. **🔴 上下文传递**：步骤间共享已读文件内容；仅文件可能已变更或距上次读取超过 5 轮时重读。
6. **🔴 每步必提示下一步**：每个步骤完成后必须主动展示下一步操作；严禁静默停止。
7. **任务标记即时性**：tasks.md 完成即标记 `[x]`，汇报前检查遗漏。
8. **TDD 纪律**：`ENABLE_UNIT_TEST=on` 时 RED → GREEN → REFACTOR，违规则 STOP。
9. **重试上限**：同一 Bug / 编译错误 ≥ 3 次 → BLOCKED，禁止第 4 次自动修复。
10. **Iron Law**：NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE；不可凭记忆声称完成。
11. **设计歧义暂停**：向用户提问，不自行假设。
12. **Phase Machine 同源**：合法 phase 列表必须与 `core/phase-machine.ts` 的 `IvyPhase` enum 一致。
13. **P0 阶段仅读配置**：项目说明文档、配置文件、目录结构；不读取已有业务代码。
14. **离线优先**：所有命令应能在断网环境运行（除显式联网的 `openspec init`）。
15. **不在仓库中提交密钥**：工具调用前检查目标路径是否在工作区内。

<!-- BLOCK 2 END ================================================ -->

<!-- BLOCK 3: VARIABLES ========================================= -->

## 核心变量（Variables）

| 变量 | 含义 | 取值来源 |
|---|---|---|
| `{PROJECT_TYPE}` | 项目类型（backend/frontend/full-stack/lib） | P0.1 项目画像 |
| `{BACKEND_STACK}` | 后端技术栈 | P0.2 + 配置文件检测 |
| `{FRONTEND_STACK}` | 前端技术栈 | P0.2 + 配置文件检测 |
| `{BUILD_TOOL}` | 构建工具（maven/gradle/npm/pnpm/yarn/go/cargo） | P0.2 |
| `{TEST_FRAMEWORK}` | 测试框架 | P0.2 |
| `{MODE}` | 执行模式（quick/standard/full） | P0.3 用户选择 |
| `{CI_MODE}` | 代码智能层模式（full/stale/no） | P0.4 自动检测 |
| `{E2E_FRAMEWORK}` | E2E 测试框架（playwright/cypress/none） | P0.4 自动检测 |
| `{ENABLE_CODE_REVIEW}` | 是否启用代码审查 | 由 `{MODE}` 推导 |
| `{ENABLE_UNIT_TEST}` | 是否启用单元测试 | 由 `{MODE}` 推导 |

**Mode → 子开关推导**：
- `quick` → 仅 ASCII 图 + 会议解析（~26K token）
- `standard` → + 代码审查 + 单元测试 + 知识归档（~64K token）
- `full` → + 安全审查 + E2E + 条件 Plan Agent（~82K token）

**Token 预算告警**：1.2x 告警，1.5x 硬上限，2x 自动降级到 quick。

<!-- BLOCK 3 END ================================================ -->

<!-- BLOCK 4: REFERENCES ======================================== -->

## 引用文档（References）

按需加载，不预读取：

| 触发场景 | 文档 |
|---|---|
| 探索快速通道 | [`references/explore-fast-track.md`](references/explore-fast-track.md) |
| 阶段状态机定义 | [`references/phase-state-machine.md`](references/phase-state-machine.md) |
| 安全 / 可观测性 / 知识记忆 | [`references/cross-cutting.md`](references/cross-cutting.md) |
| 步骤八九（实现报告 + 归档） | [`references/step8-9-closure.md`](references/step8-9-closure.md) |

**关键引用规则**：
1. 每次仅加载 1 个 references 文件，加载后即纳入上下文。
2. 文档与代码的真理来源是 `core/phase-machine.ts`；状态机文档由 CI 校验同步。
3. 探索关键词的优先级最高，先于 P0 检测。

<!-- BLOCK 4 END ================================================ -->

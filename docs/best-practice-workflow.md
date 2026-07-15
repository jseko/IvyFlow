# IvyFlow 最佳实践工作流操作指南

> 基于 `specs/old/ivyflow-role-system-design-v3.3.md` 设计，结合当前 v0.15.0 实现
> 适用于：个人 AI 辅助开发者和团队 AI 编码协作

---

## 一、工作流总览

IvyFlow 提供 **5 个角色** × **5 套工作流** 的矩阵式协作体系：

```
                    PM（产品经理）
                 collect → analyze
                   → prd → review → accept
                         │
              ┌──────────┼──────────┐
              ▼                     ▼
     Architect（架构师）      Developer（开发者）
   research → design        open → design → build
     → review → guide         → verify → archive
              │                     │
              └──────────┬──────────┘
                         ▼
                     QA（测试）
                  testcase → execute
                   → bug → report → regression
                    ╱              ╲
               all_pass         bugs_found
                  ╱                  ╲
                 ▼                    ▼
           DevOps（运维）        Developer（修复）
        env → cicd → deploy    （回到 coding 阶段）
         → monitor → alert
```

### 何时使用哪种协作模式

| 场景 | 推荐模式 | 说明 |
|------|----------|------|
| 个人小项目 | 仅 Developer | `/ivyflow` 走完 5 阶段 |
| 有明确需求的新功能 | PM → Developer → QA | 先写 PRD 再开发再测试 |
| 技术方案复杂 | PM → Architect → Developer → QA | 架构师介入设计 |
| 需要上线的功能 | PM → Architect → Developer → QA → DevOps | 完整五角色流水线 |
| 小需求/简单功能 | PM → Developer（跳过 Architect） | 小需求不需要架构评审 |
| Bug 修复 | Developer only | `/ivyflow-hotfix` 快速修复 |

---

## 二、角色工作流详解

### 2.1 Developer（开发者）— OpenSpec 开发流程

**工作流**：`open → design → build → verify → archive`

**入口命令**：`/ivyflow "描述"`

#### 阶段一：OPEN（开启）

| 项目 | 内容 |
|------|------|
| **目标** | 创建变更提案，明确要做什么 |
| **能力** | `planning → ivy-open` |
| **产出物** | `proposal.md`、`design.md`、`tasks.md` |
| **门禁** | 三个文档均存在且非空 |
| **权限** | 只读代码，可编辑 .md 文档 |
| **用户决策** | 确认提案内容 / 需要调整 |

**操作步骤**：

```
在 Agent 中输入：/ivyflow "实现用户邮箱密码登录，支持 JWT Token 认证"

Agent 会：
1. 创建 OpenSpec 变更结构
2. 运行 10 项规格质量检查清单
3. 暂停等待你确认提案
```

#### 阶段二：DESIGN（深度设计）

| 项目 | 内容 |
|------|------|
| **目标** | 完成技术方案设计，确定实现路径 |
| **能力** | `design → ivy-design` |
| **产出物** | `docs/superpowers/specs/*-design.md`、`spec.md` |
| **门禁** | 上下文交接文件存在、哈希匹配 |
| **权限** | 只读代码，可编辑设计文档 |
| **用户决策** | 确认技术方案 / 需要调整 |
| **可回退** | 是（回退到 OPEN） |

**操作步骤**：

```
Agent 会：
1. 生成上下文交接文件（design-context.json / design-context.md）
2. 运行头脑风暴（6 个上下文问题）
3. 运行 Delta Spec 完整性检查（5 类：输入边界/外部依赖/局部失败/安全默认/多路径守卫）
4. 创建详细设计文档
5. 暂停等待你确认技术方案

你可以回复：
- "确认" → 进入 BUILD
- "JWT 换成 Session 方案" → Agent 调整设计
```

#### 阶段三：BUILD（构建）

| 项目 | 内容 |
|------|------|
| **目标** | 按 tasks.md 逐任务实现代码 |
| **能力** | `coding → ivy-build` |
| **产出物** | `src/**`、`tests/**` |
| **门禁** | 隔离环境已设置、构建模式已选择、任务全部完成 |
| **权限** | ✅ 可写代码和测试，❌ 不可修改设计文档 |
| **用户决策** | 选择执行模式（executing-plans / subagent / direct） |
| **可回退** | 是（回退到 DESIGN） |

**操作步骤**：

```
Agent 会：
1. 询问执行模式 → 选择 "executing-plans"（推荐）
2. 生成实施计划
3. 逐个执行任务：
   - 如果启用 TDD：先写测试 → 再写实现 → 确认测试通过
   - 每个任务两阶段审查：规格合规 + 代码质量
   - 最多 3 轮修复，超过则阻塞
4. 全部任务完成后自动进入 VERIFY
```

**执行模式选择**：

| 模式 | 适用场景 | 特点 |
|------|----------|------|
| `executing-plans` | 标准功能开发（推荐） | 主会话内联执行，有完整计划 |
| `subagent-driven` | 大型功能，多任务并行 | 子 Agent 并行执行，每个 ≤5 上下文项 |
| `direct` | Hotfix/Tweak | 直接执行，无计划 |

#### 阶段四：VERIFY（验证）

| 项目 | 内容 |
|------|------|
| **目标** | 运行质量门禁，确保代码质量 |
| **能力** | `testing + review → ivy-verify` |
| **产出物** | `verification_report` |
| **门禁** | 验证报告存在、分支已处理 |
| **权限** | ✅ 可修编译错误和测试失败，❌ 不可添加新功能 |
| **用户决策** | 验证失败时：修复问题 / 接受偏差 |
| **可回退** | 是（回退到 BUILD） |

**操作步骤**：

```
Agent 会：
1. 运行全部门禁：编译 → 测试 → Lint → 覆盖率
2. 如果全部通过 → 处理分支（合并/PR/推送）
3. 如果有失败 → 暂停询问："修复问题"或"接受偏差"

注意：verify → design 是明确禁止的回退路径
```

#### 阶段五：ARCHIVE（归档）

| 项目 | 内容 |
|------|------|
| **目标** | 归档变更，提取知识，清理环境 |
| **能力** | 无（终态阶段） |
| **产出物** | `openspec/changes/archive/*` |
| **门禁** | 已归档标记、提案/设计文档存在、所有任务完成 |
| **权限** | 只读，❌ 不可写任何代码或文档 |
| **用户决策** | 确认归档 / 取消 |
| **可回退** | 否（终态） |

**操作步骤**：

```
Agent 会：
1. 显示最终摘要（Change 名称、完成任务、验证结果、影响文件）
2. 暂停询问："确认归档"或"取消"
3. 确认后：OpenSpec 归档 → 知识提取 → 工作树清理
```

### 2.2 快速预设（跳过部分阶段）

| 预设 | 命令 | 跳过 | 约束 |
|------|------|------|------|
| **Hotfix** | `/ivyflow-hotfix "描述"` | 头脑风暴、完整计划 | ≤2 文件，无新能力，无 API 变更 |
| **Tweak** | `/ivyflow-tweak "描述"` | 头脑风暴、完整计划 | ≤3 任务，无新能力，无架构变更 |
| **Quick** | `/ivyflow-quick "描述"` | 头脑风暴、计划 | 无硬性约束 |

**自动升级机制**：当 Hotfix 或 Tweak 超出约束范围时，Agent 会建议升级到完整 `/ivyflow`。

---

### 2.3 PM（产品经理）— 产品流程

**工作流**：`collect → analyze → prd → review → accept`

**入口命令**：`/pmflow "描述"`

| 阶段 | 目标 | 产出物 | 回退 |
|------|------|--------|------|
| **collect** | 收集需求 | `docs/pm/collect-summary.md` | — |
| **analyze** | 需求分析 | `docs/pm/analysis-report.md` | — |
| **prd** | 撰写 PRD | `docs/prd/*.md` | — |
| **review** | 评审 | `docs/pm/review-record.md` | 可回退到 prd |
| **accept** | 验收 | `docs/pm/acceptance-report.md` | 禁止回退 |

**快捷命令**：
- `/pmflow-prd "描述"` — 快速生成 PRD
- `/pmflow-review` — 启动需求审查

**使用示例**：

```
切换到 PM 角色：ivy role set pm

在 Agent 中输入：/pmflow "设计用户权限管理系统，支持 RBAC 模型"

Agent 依次执行：
1. collect — 收集需求背景、用户场景、竞品参考
2. analyze — 分析需求可行性、边界条件、依赖关系
3. prd — 撰写完整 PRD（功能描述、验收标准、非功能需求）
4. review — 运行审查清单、生成验收用例、分析变更影响
5. accept — 最终验收确认

完成后切换到 Developer：ivy role set developer
```

---

### 2.4 Architect（架构师）— 架构设计流程

**工作流**：`research → design → review → guide`

**入口命令**：`/archflow "描述"`

| 阶段 | 目标 | 产出物 | 回退 |
|------|------|--------|------|
| **research** | 方案调研 | `docs/architecture/research/*.md` | — |
| **design** | 架构设计 | `docs/architecture/design/*.md` | — |
| **review** | 评审 | `docs/architecture/review-record.md` | 可回退到 design |
| **guide** | 落地指导 | `docs/architecture/implementation-guide.md` | 禁止回退 |

**快捷命令**：
- `/archflow-research "描述"` — 快速技术调研
- `/archflow-review` — 启动架构审查

**使用示例**：

```
切换到 Architect：ivy role set architect

在 Agent 中输入：/archflow "设计用户权限系统的技术架构"

Agent 依次执行：
1. research — 调研 RBAC/ABAC 方案、对比框架、评估性能
2. design — 确定技术选型、绘制架构图、定义接口规范
3. review — 运行设计清单、识别风险和瓶颈、评估技术债务
4. guide — 编写实现指南、定义编码规范、标注关键决策点

完成后切换到 Developer：ivy role set developer
```

---

### 2.5 QA（测试工程师）— 测试流程

**工作流**：`testcase → execute → bug → report → regression`

**入口命令**：`/qaflow "描述"`

| 阶段 | 目标 | 产出物 | 回退 |
|------|------|--------|------|
| **testcase** | 用例设计 | `docs/testcases/*.md` | — |
| **execute** | 测试执行 | `test-results/*.json` | — |
| **bug** | 缺陷跟踪 | `docs/bugs/*.md` | 可回退到 execute |
| **report** | 测试报告 | `docs/reports/test-report.md` | — |
| **regression** | 回归验证 | `docs/reports/regression-report.md` | 禁止回退 |

**快捷命令**：
- `/qaflow-bug "描述"` — 快速生成 Bug 报告
- `/qaflow-report` — 生成测试总结报告

**使用示例**：

```
切换到 QA：ivy role set qa

在 Agent 中输入：/qaflow "测试用户权限管理系统"

Agent 依次执行：
1. testcase — 设计功能用例、边界用例、异常用例、权限矩阵用例
2. execute — 执行测试、记录结果
3. bug — 发现缺陷时记录（复现步骤、预期/实际结果、环境信息）
4. report — 生成报告（测试统计、缺陷统计、覆盖率、质量评估）
5. regression — 缺陷修复后回归验证

如果有 Bug → 通知 Developer 修复
如果全部通过 → 通知 DevOps 部署
```

---

### 2.6 DevOps（运维）— 运维流程

**工作流**：`env → cicd → deploy → monitor → alert`

**入口命令**：`/devopsflow "描述"`

| 阶段 | 目标 | 产出物 | 回退 |
|------|------|--------|------|
| **env** | 环境规划 | `docs/devops/infrastructure.md` | — |
| **cicd** | CI/CD 搭建 | `.github/workflows/*.yml` | — |
| **deploy** | 部署 | `docs/devops/deployment.md` | 可回退到 cicd |
| **monitor** | 监控 | `docs/devops/monitoring.md` | — |
| **alert** | 告警 | `docs/devops/alerts.md` | 禁止回退 |

**快捷命令**：
- `/devopsflow-deploy` — 快速部署（含部署前检查、策略执行、部署后验证、回滚确认）
- `/devopsflow-monitor` — 查看监控状态

---

## 三、最佳实践工作流场景

### 场景 1：个人开发者 — 从想法到代码

**适用**：个人项目、独立功能开发

```
ivy role set developer

Agent: /ivyflow "实现文章收藏功能"
  → OPEN：创建提案，确认
  → DESIGN：设计方案，确认
  → BUILD：编码实现
  → VERIFY：运行测试
  → ARCHIVE：归档知识
```

**耗时估算**：小型功能 30-60 分钟，中型功能 2-4 小时

---

### 场景 2：两人团队 — PM + Developer

**适用**：有明确需求的新功能，不需要专职 QA

```
第一个人（PM）：
  ivy role set pm
  Agent: /pmflow "设计用户积分系统"
    → collect → analyze → prd → review → accept
  产出：docs/prd/points-system.md

第二个人（Developer）：
  ivy role set developer
  Agent: /ivyflow "实现用户积分系统"
    → 基于 PRD 进行 open → design → build → verify → archive
```

**关键点**：PRD 是 PM 和 Developer 之间的**契约文档**，Developer 的 OPEN 阶段会读取 PRD 作为输入。

---

### 场景 3：三人团队 — PM + Developer + QA

**适用**：需要质量保证的中型功能

```
1. PM 写需求：/pmflow "设计支付系统"
   产出 PRD → 通知 Developer

2. Developer 开发：/ivyflow "实现支付系统"
   完成开发 → 通知 QA

3. QA 测试：/qaflow "测试支付系统"
   如果有 Bug → 通知 Developer 修复（/ivyflow-hotfix）
   如果全部通过 → 功能完成
```

**使用 Pipeline 命令自动化**：

```bash
# 创建流水线
ivy pipeline start "支付系统"

# PM 完成需求后
ivy pipeline complete requirements

# Developer 完成开发后
ivy pipeline complete coding

# QA 测试后（根据结果选择分支）
ivy pipeline complete testing --choice all_pass    # 通过 → DevOps
ivy pipeline complete testing --choice bugs_found  # 有Bug → 回退 Developer
```

---

### 场景 4：完整团队 — 五角色全流程

**适用**：企业级功能，需要架构设计、质量保证和生产部署

```
1. PM
   ivy role set pm
   /pmflow "设计企业级权限管理系统"

2. Architect（架构复杂时启用）
   ivy role set architect
   /archflow "设计权限系统技术架构"
   → 产出架构设计文档和实现指南

3. Developer
   ivy role set developer
   /ivyflow "实现企业级权限管理系统"
   → 基于 PRD + 架构设计进行开发

4. QA
   ivy role set qa
   /qaflow "测试权限管理系统"
   → 全量测试，Bug 跟踪

5. DevOps
   ivy role set devops
   /devopsflow "部署权限管理系统到生产环境"
   → 环境准备 → CI/CD → 部署 → 监控 → 告警
```

---

### 场景 5：紧急 Bug 修复

```
ivy role set developer

Agent: /ivyflow-hotfix "修复支付回调签名验证失败导致订单状态不更新"

Agent 会：
1. 直接进入 BUILD（跳过 OPEN 和 DESIGN）
2. 先定位根因 → 再修复 → 验证没有类似问题
3. 轻量级验证 → 归档

约束：≤2 文件，无新功能，无 API 变更
```

---

### 场景 6：跨角色反馈循环

**Developer 发现设计问题**：

```
Developer 在 BUILD 阶段发现架构设计有缺陷
  → ivy guard run build → 状态回退到 design
  → ivy role set architect
  → /archflow "调整权限系统缓存策略设计"
  → 完成后通知 Developer
  → ivy role set developer
  → 继续 BUILD
```

**QA 发现 Bug**：

```
QA 测试发现支付金额计算错误
  → 记录 Bug：/qaflow-bug "支付金额小数点精度丢失"
  → Pipeline: ivy pipeline block testing --reason "Bug: 支付精度问题"
  → ivy role set developer
  → /ivyflow-hotfix "修复支付金额精度丢失问题"
  → 修复后：ivy pipeline retry testing
  → ivy role set qa
  → 回归测试
```

---

## 四、工作流阶段状态机规则

### 4.1 Developer 状态转换

```
open ──→ design ──→ build ──→ verify ──→ archive (终态)
  ↑        ↑  │       ↑  │       ↑  │
  └────────┘  │       └──┘       └──┘
    (回退)   (回退)    (回退)    (回退)
```

**明确禁止**：
- ❌ verify → design（不可跳过 build 回退到设计）
- ❌ archive → 任何阶段（终态不可回退）

### 4.2 PM 状态转换

```
collect → analyze → prd → review → accept (终态)
                          ↑  │
                          └──┘ (回退)
```

### 4.3 Architect 状态转换

```
research → design → review → guide (终态)
                     ↑  │
                     └──┘ (回退)
```

### 4.4 QA 状态转换

```
testcase → execute → bug → report → regression (终态)
                       ↑  │
                       └──┘ (回退)
```

### 4.5 DevOps 状态转换

```
env → cicd → deploy → monitor → alert (终态)
               ↑  │
               └──┘ (回退)
```

---

## 五、关键操作速查

### Agent 内命令

| 命令 | 用途 |
|------|------|
| `/ivyflow "描述"` | Developer 完整工作流 |
| `/ivyflow-hotfix "描述"` | Bug 修复（≤2 文件） |
| `/ivyflow-tweak "描述"` | 小改动（≤3 任务） |
| `/ivyflow-quick "描述"` | 快速修改 |
| `/pmflow "描述"` | PM 完整工作流 |
| `/pmflow-prd "描述"` | 快速生成 PRD |
| `/pmflow-review` | 启动需求审查 |
| `/archflow "描述"` | Architect 完整工作流 |
| `/archflow-research "描述"` | 快速技术调研 |
| `/archflow-review` | 启动架构审查 |
| `/qaflow "描述"` | QA 完整工作流 |
| `/qaflow-bug "描述"` | 快速 Bug 报告 |
| `/qaflow-report` | 生成测试报告 |
| `/devopsflow "描述"` | DevOps 完整工作流 |
| `/devopsflow-deploy` | 快速部署 |
| `/devopsflow-monitor` | 查看监控 |
| `/status` | 查看当前进度 |
| `/phase` | 查看当前阶段 |
| `/help` | 帮助 |

### 终端命令

| 命令 | 用途 |
|------|------|
| `ivy role set <role>` | 切换角色 |
| `ivy role show` | 查看当前角色 |
| `ivy role list` | 列出所有角色 |
| `ivy pipeline start "name"` | 创建多角色流水线 |
| `ivy pipeline status` | 查看流水线状态 |
| `ivy pipeline complete <stage>` | 完成流水线阶段 |
| `ivy pipeline block <stage> --reason "..."` | 阻塞阶段 |
| `ivy pipeline retry <stage>` | 重试阶段 |
| `ivy status` | 项目状态 |
| `ivy guard validate` | 守卫状态 |

---

## 六、常见问题

### Q1：什么时候需要 Architect 角色？

当功能满足以下任一条件时：
- 涉及新技术选型
- 需要设计新的系统模块
- 涉及多个服务的交互
- 有性能/安全/可扩展性的特殊要求

简单 CRUD 功能可以跳过 Architect。

### Q2：Pipeline 和 Agent 命令的关系？

- **Agent 命令**（`/ivyflow`、`/pmflow` 等）是角色内部的工作流，控制单一角色如何完成工作
- **Pipeline**（`ivy pipeline`）是角色之间的编排，控制角色之间的交接和流转

两者互补：Pipeline 管理"谁做"，Agent 命令管理"怎么做"。

### Q3：多个 Developer 如何协作？

当前版本每个角色在 Pipeline 中只有一个阶段。多 Developer 场景建议：
- 使用 `ivy worktree create` 为不同功能创建隔离工作树
- 通过 Git 分支协作
- 未来版本将支持 Supervisor Agent 进行多 Developer 任务分配

### Q4：可以跳过 Pipeline 直接使用 Agent 命令吗？

可以。Pipeline 是可选的协作编排层。个人开发者可以直接使用 `/ivyflow` 完成全部工作。

---

## 相关文档

- [在 AI Agent 中使用 IvyFlow](./agent-usage.md) — 斜杠命令完整参考
- [流水线实现评估](./pipeline-implementation-assessment.md) — 当前实现与设计的对比
- [ivy-pipeline.md](./ivy-pipeline.md) — Pipeline CLI 命令
- [ivy-role.md](./ivy-role.md) — 角色管理
- [ivy-guard.md](./ivy-guard.md) — 阶段守卫
- [ivy-workflow.md](./ivy-workflow.md) — 工作流管理

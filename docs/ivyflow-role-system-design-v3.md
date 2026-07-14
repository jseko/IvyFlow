# IvyFlow 角色系统设计文档 v3

> 日期：2026-07-14 | 版本：v3.0
> 参考：OpenSwarm 多 Agent 团队实践 + full-stack-skills 技能生态

---

## 一、评估结论

### 1.1 核心判断：**不引入外部 skills**

经过对 `vendors/full-stack-skills` 的完整评估，结论是：

**IvyFlow 的角色系统不应该引入任何外部 skills。**

理由如下：

| 评估维度 | 结论 |
|----------|------|
| **定位冲突** | full-stack-skills 是**技能集合**（按语言/框架/工具分组），IvyFlow 是**工作流执行器**（管理阶段状态和守卫）。两者职责不同，强行耦合会导致概念混乱 |
| **依赖爆炸** | full-stack-skills 有 200+ 个 skill、30+ 个技能组，引入任何一个角色都会牵连大量依赖（如 PM 角色需要 docx/pptx/pdf/mermaid/drawio 等 10+ 个外部 skill） |
| **维护噩梦** | 外部 skills 独立演进，IvyFlow 无法控制其版本和兼容性。每次外部 skill 更新都可能破坏角色工作流 |
| **价值有限** | 角色系统的核心价值是**工作流编排**（阶段管理 + 守卫 + 状态机），不是**技能推荐**。告诉 AI "你是一个 PM" 比安装 10 个外部 skill 更有效 |
| **简单即美** | IvyFlow 当前 4 步 init 流程简洁高效，引入外部 skill 选择会让 init 变成 10+ 步的迷宫 |

### 1.2 那 vendors 中的 skills 有什么用？

它们可以**独立使用**，但不应耦合到 IvyFlow 的角色系统中：

```
IvyFlow（工作流引擎）     full-stack-skills（技能集合）
┌─────────────────┐       ┌──────────────────────┐
│ 阶段状态管理      │       │ api-design-principles │
│ 守卫检查          │       │ react-state-mgmt      │
│ 知识提取          │       │ playwright-testing    │
│ Worktree 隔离     │       │ terraform-modules     │
│ topology 协作     │       │ ... (200+ skills)    │
└─────────────────┘       └──────────────────────┘
        ↓                          ↓
   专注流程控制              专注技术指导
        ↓                          ↓
   用户自己选择何时加载      用户按技术栈安装
```

---

## 二、v3 核心设计：轻量角色 + 内联 Prompt

### 2.1 设计理念

角色系统的真正价值不是"安装更多 skill"，而是**改变 AI 的行为模式**。这可以通过一个轻量的角色 prompt 实现，无需任何外部依赖。

```
角色 = 角色 Prompt（内联在 SKILL.md 中） + 工作流阶段定义 + topology 模式
```

### 2.2 5 个角色

| 角色 | 标识 | 核心行为 | 工作流 | topology |
|------|------|---------|--------|----------|
| **全栈开发** | `developer` | 编码 + 设计 + 测试 | open → design → build → verify → archive | parallel |
| **产品经理** | `pm` | 需求分析 + PRD + 验收 | collect → analyze → prd → review → accept | supervisor |
| **测试工程师** | `qa` | 用例 + 测试 + 缺陷 | testcase → execute → bug → report | parallel |
| **架构师** | `architect` | 选型 + 设计 + 评审 | research → design → review → guide | supervisor |
| **运维/DevOps** | `devops` | 环境 + CI/CD + 部署 + 监控 | env → cicd → deploy → monitor | serial |

### 2.3 角色 Prompt 示例

每个角色在 `assets/roles/<role-id>/SKILL.md` 中定义一个内联 Prompt，直接告诉 AI 如何行为：

**PM 角色 Prompt 示例：**

```markdown
---
name: pm
description: 产品经理角色 — 需求分析、PRD 撰写、评审验收
role: pm
topology: supervisor
phases: collect → analyze → prd → review → accept
---

# 产品经理

你是产品经理。你的职责是理解用户需求、撰写 PRD、组织评审和验收。

## 行为准则

1. 以用户视角思考问题，不做技术实现假设
2. PRD 必须包含：背景、目标用户、功能范围、验收标准、风险
3. 验收标准必须可测试（Given/When/Then 格式）
4. 评审时必须列出 3 个以上边界条件
5. 不编写代码，不做技术选型

## 工作流

| 阶段 | 产出 |
|------|------|
| collect | 需求收集摘要 |
| analyze | 需求分析报告（竞品/用户故事/优先级） |
| prd | PRD 文档（docs/prd/<feature>.md） |
| review | 评审记录 + 验收用例 |
| accept | 验收报告 |
```

**Developer 角色 Prompt 示例（现有内容精简）：**

```markdown
---
name: developer
description: 全栈开发者 — open → design → build → verify → archive
role: developer
topology: parallel
phases: open → design → build → verify → archive
---

# 全栈开发者

你是全栈开发者。你遵循 IvyFlow 5 阶段工作流。

## 阶段

| 阶段 | 描述 |
|------|------|
| open | 创建 OpenSpec 变更结构（proposal → design → tasks） |
| design | 技术设计 + brainstorming |
| build | 编码实现（TDD + 代码审查） |
| verify | 质量门控（编译 + 测试 + 覆盖率） |
| archive | 归档变更 + 知识提取 |

## 规则

- 禁止跨阶段编辑代码
- build 阶段强制 TDD
- verify 阶段必须通过所有门控
```

---

## 三、init 流程

### 角色选择步骤（Step 2.5）

```
✔ 工作语言： 中文（默认）

  🔍 检测到技术栈：typescript  前端:vue  后端:spring-boot

? 选择你的角色：
❯ 全栈开发（默认）— 编码 + 设计 + 测试
  产品经理 — 需求分析 + PRD + 验收
  测试工程师 — 用例 + 测试 + 缺陷
  架构师 — 选型 + 设计 + 评审
  运维/DevOps — 环境 + CI/CD + 部署 + 监控
```

### 按角色安装

选择角色后，安装对应的 assets：

| 角色 | 安装内容 |
|------|---------|
| developer | `assets/roles/developer/` — 现有 8 个 phase skills + 3 rules + 5 commands |
| pm | `assets/roles/pm/` — 1 个角色 SKILL.md + 5 个 phase SKILL.md + 3 commands |
| qa | `assets/roles/qa/` — 1 个角色 SKILL.md + 5 个 phase SKILL.md + 3 commands |
| architect | `assets/roles/architect/` — 1 个角色 SKILL.md + 4 个 phase SKILL.md + 3 commands |
| devops | `assets/roles/devops/` — 1 个角色 SKILL.md + 5 个 phase SKILL.md + 3 commands |

---

## 四、目录结构

```
assets/roles/
├── developer/
│   ├── SKILL.md                    # 角色 Prompt
│   ├── skills/ivy/                 # 8 个 phase skills
│   ├── rules/                      # 3 个规则
│   └── commands/                   # 5 个命令
│
├── pm/
│   ├── SKILL.md                    # 角色 Prompt（内联，无需外部依赖）
│   ├── skills/pm/                  # 6 个 phase skills（含 SKILL.md 调度器）
│   │   ├── SKILL.md
│   │   ├── pm-collect/SKILL.md
│   │   ├── pm-analyze/SKILL.md
│   │   ├── pm-prd/SKILL.md
│   │   ├── pm-review/SKILL.md
│   │   └── pm-accept/SKILL.md
│   └── commands/                   # 3 个命令
│
├── qa/
│   ├── SKILL.md
│   ├── skills/qa/
│   │   ├── SKILL.md
│   │   ├── qa-testcase/SKILL.md
│   │   ├── qa-execute/SKILL.md
│   │   ├── qa-bug/SKILL.md
│   │   ├── qa-report/SKILL.md
│   │   └── qa-regression/SKILL.md
│   └── commands/
│
├── architect/
│   ├── SKILL.md
│   ├── skills/architect/
│   │   ├── SKILL.md
│   │   ├── arch-research/SKILL.md
│   │   ├── arch-design/SKILL.md
│   │   ├── arch-review/SKILL.md
│   │   └── arch-guide/SKILL.md
│   └── commands/
│
└── devops/
    ├── SKILL.md
    ├── skills/devops/
    │   ├── SKILL.md
    │   ├── devops-env/SKILL.md
    │   ├── devops-cicd/SKILL.md
    │   ├── devops-deploy/SKILL.md
    │   ├── devops-monitor/SKILL.md
    │   └── devops-alert/SKILL.md
    └── commands/
```

---

## 五、v2 → v3 关键变更

| 变更 | v2 | v3 |
|------|-----|-----|
| **外部 skill 引入** | 未明确 | **明确不引入**——角色 Prompt 内联，无外部依赖 |
| **角色 SKILL.md** | 仅调度器 | **角色 Prompt + 行为准则 + 工作流阶段** |
| **PM rules** | pm-prd-checklist.md | 移除——检查清单内联到 SKILL.md 的行为准则中 |
| **QA rules** | qa-testcase-checklist.md | 同上 |
| **Architect rules** | arch-design-checklist.md | 同上 |
| **DevOps rules** | devops-security-checklist.md | 同上 |
| **manifest 复杂度** | upstream/downstream_roles | 移除——角色间协作由 topology 字段表达 |
| **实施复杂度** | 13-15 天 | **5-7 天**——无需等待外部 skill 集成 |

---

## 六、实施计划

| 阶段 | 内容 | 工作量 |
|------|------|--------|
| **M1：基础设施** | RoleRegistry、init 角色选择步骤、InstallConfig.role 字段 | 1-2 天 |
| **M2：Developer 迁移** | 现有内容迁移到 `assets/roles/developer/`，保持向后兼容 | 1 天 |
| **M3：PM + QA 角色** | 2 个角色的 SKILL.md + phase skills + commands | 2 天 |
| **M4：Architect + DevOps 角色** | 2 个角色的 SKILL.md + phase skills + commands | 2 天 |
| **M5：测试 + 文档** | 单元测试、集成测试 | 1 天 |

**总计**：约 5-7 天。

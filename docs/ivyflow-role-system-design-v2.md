# IvyFlow 角色系统设计文档 v2

> 日期：2026-07-14 | 版本：v2.0 | 参考：OpenSwarm 多 Agent 团队实践

---

## 一、设计理念

### 1.1 核心理念：模拟真实开发团队

OpenSwarm 证明了：**真实开发团队的效率来源于分工协作**。AI 单 Agent 只是把一个人的工作自动化了，但没有模拟团队的协作方式。

IvyFlow 的角色系统采用同样的思路：**每个角色是一个独立的 AI Agent，在自己的 Git Worktree 中并行工作，通过结构化的通信协议协作**。

```
单 Agent 模式：输入需求 → AI 编码 → 人工 Review → 修改 → 合并
                          ↑ 瓶颈：Review 循环需要人参与

角色协作模式：PM 分析需求 → Architect 设计方案 → Developer 编码 → QA 测试 → DevOps 部署
              每个角色在自己的 Worktree 中并行工作，通过状态协议传递产物
```

### 1.2 关键原则

1. **Worktree 隔离** — 每个 Agent 在独立分支上工作，互不覆盖
2. **角色流水线** — 上游角色产出 → 下游角色消费，形成自动化流水线
3. **topology 协作** — 支持 serial（串行）、parallel（并行）、supervisor（主从）、debate（辩论）四种拓扑
4. **不强制编码** — 非开发者角色不需要写代码，但可以通过 AI 工具完成自己的专业工作

---

## 二、5 个核心角色

### 角色总览

| 角色 | 标识 | 定位 | topology | 工作流阶段 |
|------|------|------|----------|-----------|
| **产品经理** | `pm` | 需求输入源 | supervisor | 收集 → 分析 → PRD → 评审 → 验收 |
| **架构师** | `architect` | 技术决策者 | supervisor | 调研 → 设计 → 评审 → 指导 |
| **全栈开发** | `developer` | 编码主力 | parallel | open → design → build → verify → archive |
| **测试工程师** | `qa` | 质量守门人 | parallel | 用例 → 执行 → 缺陷 → 回归 |
| **运维/DevOps** | `devops` | 交付保障 | serial | 环境 → CI/CD → 部署 → 监控 |

### 角色间协作流程

```
PM 产出 PRD ──→ Architect 产出架构设计 ──→ Developer 编码 ──→ QA 测试 ──→ DevOps 部署
     │                    │                      │                │              │
     └── 验收 ◄───────────┴──────────────────────┴────────────────┴──────────────┘
```

**每个角色的产物是下一个角色的输入**，通过 IvyFlow 的状态协议自动传递。

---

## 三、角色详细设计

### 角色 1：产品经理（pm）

| 属性 | 值 |
|------|-----|
| 标识 | `pm` |
| 图标 | 📋 |
| topology | `supervisor`（调度其他角色，但自己不编码） |
| 输入 | 用户需求、Issue、用户反馈 |
| 产出 | PRD 文档、验收用例、需求分析报告 |

#### 工作流

```
/pmflow → 需求收集 → 需求分析 → PRD 撰写 → 评审 → 验收
```

#### Skills（3 个）

| Skill | 阶段 | 描述 |
|-------|------|------|
| `pm-collect` | 需求收集 | 整理需求来源（Issue/用户反馈/竞品分析），分类汇总 |
| `pm-prd` | PRD 撰写 | 生成 PRD 文档（背景/目标/功能范围/验收标准/风险） |
| `pm-review` | 评审验收 | 需求评审 checklist、验收用例生成、变更影响分析 |

#### Rules（1 个）

| Rule | 描述 |
|------|------|
| `pm-prd-checklist.md` | PRD 质量检查：SMART 目标、可测试验收标准、边界条件覆盖、依赖明确 |

#### Commands（3 个）

| Command | 描述 |
|---------|------|
| `/pmflow "分析用户反馈中的登录问题"` | 启动需求分析工作流 |
| `/pmflow-prd "用户权限管理系统"` | 快速生成 PRD |
| `/pmflow-review` | 启动需求评审 |

#### 与其他角色的协作

```
PM 产出 PRD
  ├──→ Architect：技术可行性评估、架构方案建议
  ├──→ Developer：功能实现
  ├──→ QA：测试用例设计依据
  └──→ PM 自己：验收标准对照
```

---

### 角色 2：架构师（architect）

| 属性 | 值 |
|------|-----|
| 标识 | `architect` |
| 图标 | 🏗️ |
| topology | `supervisor`（技术决策者，指导开发者实现） |
| 输入 | PRD、现有系统架构、技术约束 |
| 产出 | 架构设计文档、技术选型报告、实现指南 |

#### 工作流

```
/archflow → 方案调研 → 架构设计 → 评审 → 落地指导
```

#### Skills（3 个）

| Skill | 阶段 | 描述 |
|-------|------|------|
| `arch-research` | 方案调研 | 技术选型对比、业界方案调研、POC 验证 |
| `arch-design` | 架构设计 | C4 模型架构图、模块划分、接口设计、数据模型 |
| `arch-review` | 评审指导 | 架构评审 checklist、技术债务评估、实现指南 |

#### Rules（1 个）

| Rule | 描述 |
|------|------|
| `arch-design-checklist.md` | 架构质量：可扩展性/可维护性/安全性/性能/成本 |

#### Commands（3 个）

| Command | 描述 |
|---------|------|
| `/archflow "设计用户权限系统架构"` | 启动架构设计 |
| `/archflow-research "对比 React vs Vue"` | 快速技术调研 |
| `/archflow-review` | 启动架构评审 |

#### 与其他角色的协作

```
Architect 产出架构设计
  ├──→ Developer：实现指南、模块划分、接口契约
  ├──→ DevOps：基础设施方案、部署架构
  └──→ QA：架构级测试策略（集成测试范围、性能瓶颈点）
```

---

### 角色 3：全栈开发（developer）

| 属性 | 值 |
|------|-----|
| 标识 | `developer` |
| 图标 | 💻 |
| topology | `parallel`（多个 Developer 可并行处理不同 Change） |
| 输入 | PRD、架构设计、Issue |
| 产出 | 代码实现、单元测试、PR |

#### 工作流

```
/ivyflow → open → design → build → verify → archive
```

#### Skills（8 个）

现有 skills 不变，增加 role-aware 调度：

| Skill | 阶段 | 描述 |
|-------|------|------|
| `ivy-open` | open | 创建 OpenSpec 变更结构，读取 PM 的 PRD 和 Architect 的架构设计 |
| `ivy-design` | design | 技术设计，参照架构师的实现指南 |
| `ivy-build` | build | 编码实现 + 代码审查（可由 QA 角色 Review） |
| `ivy-verify` | verify | 质量门控，QA 可参与测试验证 |
| `ivy-archive` | archive | 归档变更 + 知识提取 |
| `ivy-hotfix` | hotfix | Bug 修复快捷路径 |
| `ivy-tweak` | tweak | 小改动快捷路径 |
| `ivy` | dispatch | 调度器，根据 topology 决定串行/并行 |

#### topology 增强

Developer 角色支持 `parallel` topology，多个开发者可同时在不同 Worktree 中处理不同 Change：

```
Change A: Developer A (Worktree A) ──→ PR A
Change B: Developer B (Worktree B) ──→ PR B
Change C: Developer C (Worktree C) ──→ PR C
                                      ↓
                                  QA 统一测试
```

---

### 角色 4：测试工程师（qa）

| 属性 | 值 |
|------|-----|
| 标识 | `qa` |
| 图标 | 🧪 |
| topology | `parallel`（与 Developer 并行工作，Review PR） |
| 输入 | PRD、架构设计、Developer 的 PR |
| 产出 | 测试用例、Bug 报告、测试报告 |

#### 工作流

```
/qaflow → 用例设计 → 测试执行 → 缺陷跟踪 → 回归验证
```

#### Skills（4 个）

| Skill | 阶段 | 描述 |
|-------|------|------|
| `qa-testcase` | 用例设计 | 基于 PRD 生成测试用例矩阵（功能/边界/异常/性能） |
| `qa-execute` | 测试执行 | 手工测试指导、自动化脚本（Playwright/Cypress）、接口测试 |
| `qa-bug` | 缺陷跟踪 | Bug 报告（复现/预期/实际/环境）、严重等级判定、回归验证 |
| `qa-report` | 测试报告 | 测试总结、覆盖率分析、质量评估 |

#### Rules（1 个）

| Rule | 描述 |
|------|------|
| `qa-testcase-checklist.md` | 测试用例质量：正向/逆向/边界/异常/性能全覆盖 |

#### Commands（3 个）

| Command | 描述 |
|---------|------|
| `/qaflow "测试用户登录模块"` | 启动测试工作流 |
| `/qaflow-bug "登录页面点击无响应"` | 快速提交 Bug |
| `/qaflow-report` | 生成测试报告 |

#### 与 Developer 的协作（对标 OpenSwarm Worker → Reviewer → Test 流水线）

```
Developer 提交 PR
  ├──→ QA Review（对标 OpenSwarm Reviewer）：
  │     检查代码逻辑、测试覆盖率、边界条件
  │     ├── 通过 → QA Test（对标 OpenSwarm Test）：
  │     │     运行测试套件、回归测试
  │     │     ├── 全部通过 → PR 可合并
  │     │     └── 失败 → 反馈给 Developer 修复
  │     └── 不通过 → PR 下评论 → Developer 修改 → 重新提交
  └── 自动化：QA 角色可配置为 PR 创建时自动触发
```

---

### 角色 5：运维/DevOps（devops）

| 属性 | 值 |
|------|-----|
| 标识 | `devops` |
| 图标 | 🚀 |
| topology | `serial`（部署必须按顺序：环境 → CI/CD → 部署 → 监控） |
| 输入 | 架构设计、代码仓库、部署需求 |
| 产出 | 基础设施配置、CI/CD 流水线、部署文档、监控配置 |

#### 工作流

```
/devopsflow → 环境规划 → CI/CD 搭建 → 部署 → 监控告警
```

#### Skills（4 个）

| Skill | 阶段 | 描述 |
|-------|------|------|
| `devops-env` | 环境规划 | 基础设施方案（Docker/K8s/云服务）、环境拓扑、资源评估 |
| `devops-cicd` | CI/CD | 流水线配置生成、构建优化、制品管理 |
| `devops-deploy` | 部署 | 部署策略（蓝绿/金丝雀/滚动）、回滚方案、健康检查 |
| `devops-monitor` | 监控 | 监控方案（Prometheus/Grafana）、告警规则、日志聚合 |

#### Rules（1 个）

| Rule | 描述 |
|------|------|
| `devops-security-checklist.md` | 部署安全检查：密钥管理/网络策略/访问控制/镜像扫描 |

#### Commands（3 个）

| Command | 描述 |
|---------|------|
| `/devopsflow "为项目搭建 CI/CD"` | 启动 DevOps 工作流 |
| `/devopsflow-deploy` | 快速部署 |
| `/devopsflow-monitor` | 查看监控状态 |

---

## 四、目录结构

```
assets/roles/
├── developer/                    # 默认角色（现有内容）
│   ├── manifest.yaml
│   ├── skills/ivy/               # 8 个 phase skills
│   ├── rules/                    # 3 个规则
│   └── commands/                 # 5 个命令
│
├── pm/
│   ├── manifest.yaml
│   ├── skills/pm/                # 3 个 skills
│   ├── rules/                    # 1 个 rule
│   └── commands/                 # 3 个 commands
│
├── architect/
│   ├── manifest.yaml
│   ├── skills/architect/         # 3 个 skills
│   ├── rules/                    # 1 个 rule
│   └── commands/                 # 3 个 commands
│
├── qa/
│   ├── manifest.yaml
│   ├── skills/qa/                # 4 个 skills
│   ├── rules/                    # 1 个 rule
│   └── commands/                 # 3 个 commands
│
└── devops/
    ├── manifest.yaml
    ├── skills/devops/            # 4 个 skills
    ├── rules/                    # 1 个 rule
    └── commands/                 # 3 个 commands
```

---

## 五、init 流程变更

### 新增 Step：角色选择

```
Step 1: 欢迎 + 作用域
Step 2: 语言 + 技术栈检测
Step 2.5: 角色选择          ← 新增
Step 3: CodeGraph + OpenSpec
Step 4: 安装执行 + 完成指引
```

```
✔ 工作语言： 中文（默认）

  🔍 检测到技术栈：typescript  前端:vue  后端:spring-boot

? 选择你的角色：
❯ 全栈开发（默认）— open → design → build → verify → archive
  产品经理 — 需求分析 + PRD 撰写 + 评审验收
  测试工程师 — 用例设计 + 测试执行 + 缺陷跟踪
  架构师 — 技术选型 + 系统设计 + 评审指导
  运维/DevOps — 环境规划 + CI/CD + 部署监控
```

### 按角色安装

选择角色后，只安装该角色对应的 skills/rules/commands：

- `developer` → 安装 `assets/roles/developer/`（现有内容，不变）
- `pm` → 安装 `assets/roles/pm/`
- `qa` → 安装 `assets/roles/qa/`
- `architect` → 安装 `assets/roles/architect/`
- `devops` → 安装 `assets/roles/devops/`

### InstallConfig 变更

```typescript
export interface InstallConfig {
  scope: InstallScope;
  language: string;
  role: string;          // ← 新增，默认 'developer'
  cwd: string;
  overwrite: boolean;
  skipOpenSpec: boolean;
  platforms: Platform[];
  capabilities: CapabilityPack[];
}
```

---

## 六、topology 协作模式

IvyFlow 已有 `topology` 字段（`StateYaml.topology`），角色系统将其激活：

### 四种 topology

| topology | 描述 | 适用角色 |
|----------|------|---------|
| `serial` | 串行执行，一步完成才能进入下一步 | DevOps（环境 → CI/CD → 部署 → 监控） |
| `parallel` | 多个 Agent 并行工作，互不干扰 | Developer（多 Change 并行）+ QA（并行 Review） |
| `supervisor` | 主 Agent 调度其他 Agent，自己不做执行 | PM（调度 Architect + Developer + QA）、Architect（指导 Developer） |
| `debate` | 多个 Agent 讨论方案，取最优解 | Architect 评审阶段（多个方案对比） |

### topology 在 Worktree 中的体现

```
serial：
  Worktree-DevOps ──→ Worktree-Deploy ──→ Worktree-Monitor
  （同一 Worktree，串行阶段）

parallel：
  Worktree-ChangeA (Developer A) ──→ PR A ──→ Worktree-QA
  Worktree-ChangeB (Developer B) ──→ PR B ──→ Worktree-QA
  （多个 Worktree，并行编码）

supervisor：
  Worktree-PM ──→ 调度 ──→ Worktree-Developer + Worktree-QA
  （PM 不编码，在自己的 Worktree 中管理需求和验收）
```

---

## 七、manifest.yaml 格式（v2）

```yaml
# assets/roles/qa/manifest.yaml
role: qa
display_name: "测试工程师"
icon: "🧪"
description: "用例设计 + 测试执行 + 缺陷跟踪"
topology: parallel           # ← 新增
workflow_phases:
  - testcase
  - execute
  - bug
  - report
skills:
  - qa/SKILL.md
  - qa/qa-testcase/SKILL.md
  - qa/qa-execute/SKILL.md
  - qa/qa-bug/SKILL.md
  - qa/qa-report/SKILL.md
rules:
  - qa-testcase-checklist.md
commands:
  - qaflow.md
  - qaflow-bug.md
  - qaflow-report.md
upstream_roles:               # ← 新增：上游角色
  - pm
  - developer
downstream_roles:             # ← 新增：下游角色
  - devops
```

---

## 八、实施计划

| 阶段 | 内容 | 工作量 |
|------|------|--------|
| **M1：基础设施** | `RoleRegistry`、`manifest.yaml` 解析、init 向导新增角色选择步骤、topology 字段激活 | 2-3 天 |
| **M2：Developer 迁移** | 现有内容迁移到 `assets/roles/developer/`，保持向后兼容 | 1 天 |
| **M3：PM 角色** | 3 个 skill + 1 个 rule + 3 个 command | 2 天 |
| **M4：QA 角色** | 4 个 skill + 1 个 rule + 3 个 command | 2 天 |
| **M5：Architect 角色** | 3 个 skill + 1 个 rule + 3 个 command | 2 天 |
| **M6：DevOps 角色** | 4 个 skill + 1 个 rule + 3 个 command | 2 天 |
| **M7：测试 + 文档** | 单元测试、集成测试、更新 README | 2 天 |

**总计**：约 13-15 天，可分批交付。

---

## 九、v1 vs v2 变更摘要

| 变更 | v1 | v2 |
|------|-----|-----|
| **设计理念** | 独立角色各自工作 | OpenSwarm 风格的角色协作流水线 |
| **topology** | 无 | serial / parallel / supervisor / debate |
| **Worktree 隔离** | 无 | 每个角色独立 Worktree |
| **角色间协作** | 无 | 上游产出 → 下游消费（PM → Architect → Developer → QA → DevOps） |
| **Developer-QA 流水线** | QA 独立测试 | QA 对标 OpenSwarm Reviewer + Test，自动 Review PR |
| **manifest 字段** | 基础字段 | 新增 topology、upstream_roles、downstream_roles |
| **PM 角色** | pm-collect 缺失 | 新增 pm-collect（需求收集） |
| **Architect 角色** | 不变 | 增加 topology: supervisor，指导 Developer |

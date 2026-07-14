# IvyFlow 角色系统设计文档

> 日期：2026-07-14 | 状态：设计中 | 版本：v1.0

---

## 一、概述

IvyFlow 当前只有「全栈开发者」一个角色，所有 skill 和工作流都面向编码场景。引入角色系统可以让不同职能的用户获得定制化的 AI 辅助体验。

---

## 二、设计目标

1. **init 时选择角色** → 按角色安装不同的 skills/rules/commands
2. **不同角色有不同工作流** → 产品经理走 PRD 流程，开发者走编码流程
3. **不膨胀核心代码** → 角色是 assets 层的概念，不影响 CLI 核心逻辑

---

## 三、5 个核心角色

### 角色 1：全栈开发（developer）— 默认

| 属性 | 值 |
|------|-----|
| 标识 | `developer` |
| 定位 | 编码 + 设计 + 测试 |
| 工作流 | open → design → build → verify → archive |
| 核心 skill | ivy-open、ivy-design、ivy-build、ivy-verify、ivy-archive |
| 快捷路径 | hotfix（Bug 修复）、tweak（小改动） |
| 规则 | ivy-phase-guard、ivy-security、never-assume |

**现有内容，无需新增。**

---

### 角色 2：产品经理（pm）

| 属性 | 值 |
|------|-----|
| 标识 | `pm` |
| 定位 | 需求分析 + PRD 撰写 + 评审验收 |
| 工作流 | 需求收集 → 需求分析 → PRD 撰写 → 评审 → 验收 |
| 不需要 | OpenSpec 变更管理、代码阶段守卫、TDD |

#### Skills（3 个）

| Skill | 阶段 | 描述 |
|-------|------|------|
| `pm-analyze` | 需求分析 | 竞品调研、用户故事拆解、需求优先级排序、可行性评估 |
| `pm-prd` | PRD 撰写 | PRD 模板（背景/目标/功能范围/非功能需求/验收标准/风险）、交互流程梳理 |
| `pm-review` | 评审验收 | 需求评审 checklist、验收用例生成、变更影响分析 |

#### Rules（1 个）

| Rule | 描述 |
|------|------|
| `pm-prd-checklist.md` | PRD 质量检查清单：目标是否 SMART、验收标准是否可测试、边界条件是否覆盖、依赖是否明确 |

#### Commands（3 个）

| Command | 描述 |
|---------|------|
| `/pmflow "分析用户反馈中的登录问题"` | 启动需求分析工作流 |
| `/pmflow-prd "用户权限管理系统"` | 快速生成 PRD |
| `/pmflow-review` | 启动需求评审 |

#### 工作流详解

```
/pmflow → 需求收集 → 需求分析 → PRD 撰写 → 评审 → 验收
```

**需求收集阶段**：
- 读取项目已有的文档、issue、用户反馈
- 整理需求来源和背景
- 产出：需求收集摘要

**需求分析阶段** (`pm-analyze`)：
- 竞品调研（如果涉及）
- 用户故事拆分（As a... I want... So that...）
- 优先级排序（MoSCoW 方法）
- 可行性评估（技术可行性、资源可行性）
- 产出：需求分析报告

**PRD 撰写阶段** (`pm-prd`)：
- 按模板生成 PRD 文档
- 包含：背景与目标、功能范围、非功能需求、验收标准、风险与依赖、时间线
- 交互流程梳理（如有 UX 需求）
- 产出：`docs/prd/<feature-name>.md`

**评审阶段** (`pm-review`)：
- 需求评审 checklist
- 验收用例生成
- 变更影响分析
- 产出：评审记录

**验收阶段**：
- 对照 PRD 验收标准逐项检查
- 产出：验收报告

---

### 角色 3：测试工程师（qa）

| 属性 | 值 |
|------|-----|
| 标识 | `qa` |
| 定位 | 用例设计 + 测试执行 + 缺陷跟踪 + 回归验证 |
| 工作流 | 用例设计 → 测试执行 → 缺陷跟踪 → 回归验证 |
| 不需要 | OpenSpec 变更管理、架构设计 |

#### Skills（4 个）

| Skill | 阶段 | 描述 |
|-------|------|------|
| `qa-testcase` | 用例设计 | 基于 PRD/设计文档生成测试用例（功能、边界、异常、性能场景） |
| `qa-execute` | 测试执行 | 手工测试步骤指导、自动化脚本生成（Playwright/Cypress）、接口测试 |
| `qa-bug` | 缺陷跟踪 | Bug 报告模板（复现步骤/预期/实际/环境/截图）、严重等级判定、回归验证 |
| `qa-report` | 测试报告 | 测试总结报告、覆盖率分析、质量评估 |

#### Rules（1 个）

| Rule | 描述 |
|------|------|
| `qa-testcase-checklist.md` | 测试用例质量标准：正向/逆向/边界/异常/性能场景是否覆盖 |

#### Commands（3 个）

| Command | 描述 |
|---------|------|
| `/qaflow "测试用户登录模块"` | 启动测试工作流 |
| `/qaflow-bug "登录页面点击无响应"` | 快速提交 Bug |
| `/qaflow-report` | 生成测试报告 |

#### 工作流详解

```
/qaflow → 用例设计 → 测试执行 → 缺陷跟踪 → 回归验证
```

**用例设计阶段** (`qa-testcase`)：
- 读取 PRD 或设计文档
- 生成测试用例矩阵（功能/边界/异常/性能）
- 产出：`docs/testcases/<module>.md`

**测试执行阶段** (`qa-execute`)：
- 手工测试步骤指导
- 自动化脚本生成（Playwright/Cypress）
- 接口测试（curl/Postman 脚本）
- 产出：测试执行记录

**缺陷跟踪阶段** (`qa-bug`)：
- Bug 报告（复现步骤/预期/实际/环境/截图）
- 严重等级判定（P0-P4）
- 指派给开发者
- 产出：Bug 报告

**回归验证阶段**：
- 验证已修复的 Bug
- 回归测试核心流程
- 产出：回归测试报告

---

### 角色 4：架构师（architect）

| 属性 | 值 |
|------|-----|
| 标识 | `architect` |
| 定位 | 技术选型 + 系统设计 + 评审 + 落地指导 |
| 工作流 | 方案调研 → 架构设计 → 评审 → 落地指导 |
| 不需要 | 日常编码、测试执行 |

#### Skills（3 个）

| Skill | 阶段 | 描述 |
|-------|------|------|
| `arch-research` | 方案调研 | 技术选型对比（框架/数据库/中间件）、业界方案调研、POC 验证 |
| `arch-design` | 架构设计 | 系统架构图（C4 模型）、模块划分、接口设计、数据模型、非功能需求方案 |
| `arch-review` | 评审指导 | 架构评审 checklist、技术债务评估、落地指导（给开发者的实现指南） |

#### Rules（1 个）

| Rule | 描述 |
|------|------|
| `arch-design-checklist.md` | 架构设计质量清单：可扩展性/可维护性/安全性/性能/成本 |

#### Commands（3 个）

| Command | 描述 |
|---------|------|
| `/archflow "设计用户权限系统架构"` | 启动架构设计工作流 |
| `/archflow-research "对比 React vs Vue 技术选型"` | 快速技术调研 |
| `/archflow-review` | 启动架构评审 |

#### 工作流详解

```
/archflow → 方案调研 → 架构设计 → 评审 → 落地指导
```

**方案调研阶段** (`arch-research`)：
- 技术选型对比（框架、数据库、中间件、云服务）
- 业界方案调研（同类产品的架构参考）
- POC 验证（如需要）
- 产出：技术选型报告 `docs/architecture/research/<topic>.md`

**架构设计阶段** (`arch-design`)：
- C4 模型架构图（Context → Container → Component → Code）
- 模块划分与职责定义
- 接口设计（API 契约）
- 数据模型设计
- 非功能需求方案（性能/安全/扩展性/可观测性）
- 产出：架构设计文档 `docs/architecture/design/<system>.md`

**评审阶段** (`arch-review`)：
- 架构评审 checklist
- 技术债务评估
- 风险识别与缓解
- 产出：评审记录

**落地指导阶段**：
- 给开发者的实现指南
- 关键技术难点的实现建议
- 产出：实现指南

---

### 角色 5：运维/DevOps（devops）

| 属性 | 值 |
|------|-----|
| 标识 | `devops` |
| 定位 | 环境规划 + CI/CD 搭建 + 部署 + 监控 |
| 工作流 | 环境规划 → CI/CD 搭建 → 部署 → 监控告警 |
| 不需要 | 编码、需求分析 |

#### Skills（4 个）

| Skill | 阶段 | 描述 |
|-------|------|------|
| `devops-env` | 环境规划 | 基础设施方案（Docker/K8s/云服务）、环境拓扑、资源评估 |
| `devops-cicd` | CI/CD | 流水线配置生成（GitHub Actions/GitLab CI/Jenkins）、构建优化、制品管理 |
| `devops-deploy` | 部署 | 部署策略（蓝绿/金丝雀/滚动）、回滚方案、健康检查 |
| `devops-monitor` | 监控 | 监控方案（Prometheus/Grafana）、告警规则、日志聚合、故障排查手册 |

#### Rules（1 个）

| Rule | 描述 |
|------|------|
| `devops-security-checklist.md` | 部署安全检查清单：密钥管理/网络策略/访问控制/镜像扫描 |

#### Commands（3 个）

| Command | 描述 |
|---------|------|
| `/devopsflow "为 blog-vue-springboot 搭建 CI/CD"` | 启动 DevOps 工作流 |
| `/devopsflow-deploy` | 快速部署 |
| `/devopsflow-monitor` | 查看监控状态 |

#### 工作流详解

```
/devopsflow → 环境规划 → CI/CD 搭建 → 部署 → 监控告警
```

**环境规划阶段** (`devops-env`)：
- 基础设施方案（Docker/K8s/云服务选型）
- 环境拓扑（开发/测试/预发布/生产）
- 资源评估（CPU/内存/存储/网络）
- 产出：基础设施方案 `docs/devops/infrastructure.md`

**CI/CD 搭建阶段** (`devops-cicd`)：
- 流水线配置生成（GitHub Actions / GitLab CI / Jenkins）
- 构建优化（缓存策略、并行构建）
- 制品管理（Docker Registry / npm / Maven）
- 产出：CI/CD 配置文件

**部署阶段** (`devops-deploy`)：
- 部署策略选择（蓝绿/金丝雀/滚动）
- 健康检查配置
- 回滚方案
- 产出：部署文档

**监控告警阶段** (`devops-monitor`)：
- 监控方案配置（Prometheus/Grafana）
- 告警规则定义
- 日志聚合方案（ELK/Loki）
- 故障排查手册
- 产出：监控配置

---

## 四、目录结构

```
assets/roles/
├── developer/                          # 默认角色
│   ├── manifest.yaml                   # 角色元数据
│   ├── skills/ivy/                     # 现有 skills（不变）
│   │   ├── SKILL.md
│   │   ├── ivy-open/SKILL.md
│   │   ├── ivy-design/SKILL.md
│   │   ├── ivy-build/SKILL.md
│   │   ├── ivy-verify/SKILL.md
│   │   ├── ivy-archive/SKILL.md
│   │   ├── ivy-hotfix/SKILL.md
│   │   ├── ivy-tweak/SKILL.md
│   │   └── references/ (×10)
│   ├── rules/
│   │   ├── ivy-phase-guard.md
│   │   ├── ivy-security.md
│   │   └── never-assume.md
│   └── commands/
│       ├── ivyflow.md
│       ├── ivyflow-quick.md
│       ├── ivyflow-hotfix.md
│       ├── ivyflow-tweak.md
│       └── ivyflow-status.md
│
├── pm/
│   ├── manifest.yaml
│   ├── skills/pm/
│   │   ├── SKILL.md                    # 调度器
│   │   ├── pm-analyze/SKILL.md
│   │   ├── pm-prd/SKILL.md
│   │   └── pm-review/SKILL.md
│   ├── rules/
│   │   └── pm-prd-checklist.md
│   └── commands/
│       ├── pmflow.md
│       ├── pmflow-prd.md
│       └── pmflow-review.md
│
├── qa/
│   ├── manifest.yaml
│   ├── skills/qa/
│   │   ├── SKILL.md
│   │   ├── qa-testcase/SKILL.md
│   │   ├── qa-execute/SKILL.md
│   │   ├── qa-bug/SKILL.md
│   │   └── qa-report/SKILL.md
│   ├── rules/
│   │   └── qa-testcase-checklist.md
│   └── commands/
│       ├── qaflow.md
│       ├── qaflow-bug.md
│       └── qaflow-report.md
│
├── architect/
│   ├── manifest.yaml
│   ├── skills/architect/
│   │   ├── SKILL.md
│   │   ├── arch-research/SKILL.md
│   │   ├── arch-design/SKILL.md
│   │   └── arch-review/SKILL.md
│   ├── rules/
│   │   └── arch-design-checklist.md
│   └── commands/
│       ├── archflow.md
│       ├── archflow-research.md
│       └── archflow-review.md
│
└── devops/
    ├── manifest.yaml
    ├── skills/devops/
    │   ├── SKILL.md
    │   ├── devops-env/SKILL.md
    │   ├── devops-cicd/SKILL.md
    │   ├── devops-deploy/SKILL.md
    │   └── devops-monitor/SKILL.md
    ├── rules/
    │   └── devops-security-checklist.md
    └── commands/
        ├── devopsflow.md
        ├── devopsflow-deploy.md
        └── devopsflow-monitor.md
```

---

## 五、init 流程变更

### 新增 Step 2.5：角色选择

在语言选择之后、CodeGraph 安装之前插入：

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

### InstallEngine 变更

- `InstallConfig` 新增 `role: string` 字段，默认 `'developer'`
- `installKernel` 根据 role 选择对应 `assets/roles/<role>/` 目录下的 skills/rules/commands
- `installPlatforms` 根据 role 安装对应的 commands 到平台目录

### 向后兼容

- `--quick` 模式默认 `role: 'developer'`（行为不变）
- 已有 `.ivy/project.yaml` 不包含 `role` 字段时视为 `developer`

---

## 六、manifest.yaml 格式

```yaml
# assets/roles/pm/manifest.yaml
role: pm
display_name: "产品经理"
icon: "📋"
description: "需求分析 + PRD 撰写 + 评审验收"
workflow_phases:
  - collect      # 需求收集
  - analyze      # 需求分析
  - prd          # PRD 撰写
  - review       # 评审
  - accept       # 验收
skills:
  - pm/SKILL.md
  - pm/pm-analyze/SKILL.md
  - pm/pm-prd/SKILL.md
  - pm/pm-review/SKILL.md
rules:
  - pm-prd-checklist.md
commands:
  - pmflow.md
  - pmflow-prd.md
  - pmflow-review.md
```

---

## 七、实施计划

| 阶段 | 内容 | 工作量 |
|------|------|--------|
| **M1：基础设施** | 角色注册表 `RoleRegistry`、manifest.yaml 解析、init 向导新增步骤 | 1-2 天 |
| **M2：PM 角色** | 3 个 skill + 1 个 rule + 3 个 command | 1-2 天 |
| **M3：QA 角色** | 4 个 skill + 1 个 rule + 3 个 command | 1-2 天 |
| **M4：Architect 角色** | 3 个 skill + 1 个 rule + 3 个 command | 1-2 天 |
| **M5：DevOps 角色** | 4 个 skill + 1 个 rule + 3 个 command | 1-2 天 |
| **M6：测试 + 文档** | 单元测试、集成测试、更新 README | 1-2 天 |

**总计**：约 6-12 天，可分批交付（先出 PM + QA，再出 Architect + DevOps）。

---

## 八、风险与权衡

| 风险 | 缓解 |
|------|------|
| **维护成本翻 5 倍** | 每个角色的 skill 文件独立，修改工作流时需同步 5 份 |
| **90% 用户只用 developer** | 默认角色是 developer，其他角色作为可选增强 |
| **Skill 内容质量** | 初期可先出骨架（模板 + checklist），逐步完善 |
| **与 Comet 定位冲突** | Comet 是通用工作流，IvyFlow 角色系统是差异化优势 |

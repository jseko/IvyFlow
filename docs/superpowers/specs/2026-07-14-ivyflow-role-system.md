# IvyFlow 角色系统实施设计

> 日期：2026-07-14 | 状态：待实施 | 版本：v1.0
> 基于：docs/ivyflow-role-system-design-v3.3.md

---

## 一、设计目标

在现有 `ivy init` 流程中新增角色选择步骤（Step 2.5），用户可选择 5 个角色之一。按角色安装不同的 skills/rules/commands。现有 Developer 内容迁移到 `assets/roles/developer/`。

---

## 二、实施范围

| 阶段 | 内容 | 工作量 |
|------|------|--------|
| **M1：基础设施** | RoleRegistry 配置化、workflow.yaml（含 transitions + artifacts）、init 角色选择步骤、Session Config 字段 | 2 天 |
| **M2：Developer 迁移** | `assets/skills/ivy/` → `assets/roles/developer/skills/ivy/`，更新所有路径引用 | 1 天 |
| **M3：PM + QA 角色** | role.yaml + SKILL.md + prompt/ + 完整 phase skills + commands/ | 2 天 |
| **M4：Architect + DevOps** | role.yaml + SKILL.md + prompt/ + 完整 phase skills + commands/ | 2 天 |
| **M5：公共 Commands + Templates** | commands/common/、templates/ | 1 天 |
| **M6：测试 + 文档** | 单元测试、集成测试 | 1 天 |

---

## 三、init 交互流程

```
Step 1: 欢迎 + 作用域
Step 2: 语言 + 技术栈检测
Step 2.5: 角色选择          ← 新增
Step 3: CodeGraph + OpenSpec 可选安装
Step 4: 安装执行 + 完成指引
```

### Step 2.5 交互

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

### 非交互模式

| 参数 | role |
|------|------|
| `--quick` / `--yes` / `--all` | `developer` |
| `--role pm` | `pm` |
| `--role qa` | `qa` |
| `--role architect` | `architect` |
| `--role devops` | `devops` |

---

## 四、目录结构

```
assets/
├── roles/
│   ├── developer/
│   │   ├── role.yaml
│   │   ├── SKILL.md
│   │   ├── prompt/
│   │   │   ├── identity.md
│   │   │   ├── workflow.md
│   │   │   └── thinking.md
│   │   ├── rules/
│   │   │   ├── coding.md
│   │   │   ├── review.md
│   │   │   └── quality.md
│   │   ├── skills/ivy/             # 现有 8 个 phase skills（迁移自 assets/skills/ivy/）
│   │   └── commands/               # 现有 5 个命令（迁移自 assets/commands/ivyflow*.md）
│   │
│   ├── pm/
│   │   ├── role.yaml
│   │   ├── SKILL.md
│   │   ├── prompt/
│   │   │   ├── identity.md
│   │   │   ├── prd-checklist.md
│   │   │   └── review-checklist.md
│   │   ├── skills/pm/
│   │   │   ├── SKILL.md
│   │   │   ├── pm-collect/SKILL.md
│   │   │   ├── pm-analyze/SKILL.md
│   │   │   ├── pm-prd/SKILL.md
│   │   │   ├── pm-review/SKILL.md
│   │   │   └── pm-accept/SKILL.md
│   │   └── commands/
│   │       ├── pmflow.md
│   │       ├── pmflow-prd.md
│   │       └── pmflow-review.md
│   │
│   ├── qa/
│   │   ├── role.yaml
│   │   ├── SKILL.md
│   │   ├── prompt/
│   │   │   ├── identity.md
│   │   │   └── testcase-checklist.md
│   │   ├── skills/qa/
│   │   │   ├── SKILL.md
│   │   │   ├── qa-testcase/SKILL.md
│   │   │   ├── qa-execute/SKILL.md
│   │   │   ├── qa-bug/SKILL.md
│   │   │   ├── qa-report/SKILL.md
│   │   │   └── qa-regression/SKILL.md
│   │   └── commands/
│   │       ├── qaflow.md
│   │       ├── qaflow-bug.md
│   │       └── qaflow-report.md
│   │
│   ├── architect/
│   │   ├── role.yaml
│   │   ├── SKILL.md
│   │   ├── prompt/
│   │   │   ├── identity.md
│   │   │   └── design-checklist.md
│   │   ├── skills/architect/
│   │   │   ├── SKILL.md
│   │   │   ├── arch-research/SKILL.md
│   │   │   ├── arch-design/SKILL.md
│   │   │   ├── arch-review/SKILL.md
│   │   │   └── arch-guide/SKILL.md
│   │   └── commands/
│   │       ├── archflow.md
│   │       ├── archflow-research.md
│   │       └── archflow-review.md
│   │
│   └── devops/
│       ├── role.yaml
│       ├── SKILL.md
│       ├── prompt/
│       │   ├── identity.md
│       │   └── security-checklist.md
│       ├── skills/devops/
│       │   ├── SKILL.md
│       │   ├── devops-env/SKILL.md
│       │   ├── devops-cicd/SKILL.md
│       │   ├── devops-deploy/SKILL.md
│       │   ├── devops-monitor/SKILL.md
│       │   └── devops-alert/SKILL.md
│       └── commands/
│           ├── devopsflow.md
│           ├── devopsflow-deploy.md
│           └── devopsflow-monitor.md
│
├── workflows/
│   ├── openspec.yaml
│   ├── product.yaml
│   ├── qa.yaml
│   ├── architecture.yaml
│   └── devops.yaml
│
├── commands/
│   └── common/
│       ├── status.md
│       ├── phase.md
│       └── help.md
│
└── templates/
    ├── prd.md
    ├── testcase.md
    └── design-doc.md
```

---

## 五、关键文件格式

### 5.1 role.yaml

```yaml
# assets/roles/developer/role.yaml
id: developer
name: "全栈开发"
icon: "💻"
description: "编码 + 设计 + 测试"
version: 1
default_workflow: openspec
default_topology: parallel

capabilities:
  - id: coding
    implementation: ivy-build
  - id: review
    implementation: ivy-verify
  - id: testing
    implementation: ivy-verify
  - id: design
    implementation: ivy-design
  - id: planning
    implementation: ivy-open

commands:
  - common
  - developer
```

```yaml
# assets/roles/pm/role.yaml
id: pm
name: "产品经理"
icon: "📋"
description: "需求分析 + PRD 撰写 + 评审验收"
version: 1
default_workflow: product
default_topology: supervisor

capabilities:
  - id: research
    implementation: pm-analyze
  - id: documentation
    implementation: pm-prd
  - id: planning
    implementation: pm-collect
  - id: review
    implementation: pm-review

commands:
  - common
  - pm
```

### 5.2 workflow.yaml

```yaml
# assets/workflows/openspec.yaml
id: openspec
name: "OpenSpec 开发流程"
description: "open → design → build → verify → archive"
version: 1
category: development
supports:
  - developer
  - architect

phases:
  - id: open
    name: "开启"
    requires:
      - planning
    artifacts:
      - proposal.md
      - design.md
      - tasks.md
    guards:
      - proposal_exists
      - design_exists
      - tasks_exist

  - id: design
    name: "设计"
    requires:
      - design
    artifacts:
      - docs/superpowers/specs/*-design.md
    guards:
      - handoff_context
      - handoff_hash

  - id: build
    name: "构建"
    requires:
      - coding
    artifacts:
      - src/**
      - tests/**
    guards:
      - isolation_set
      - build_mode_set
      - tasks_complete

  - id: verify
    name: "验证"
    requires:
      - testing
      - review
    artifacts:
      - verification_report
    guards:
      - verification_report_exists
      - branch_handled

  - id: archive
    name: "归档"
    requires: []
    artifacts:
      - openspec/changes/archive/*
    guards:
      - archived_flag

transitions:
  - from: open
    to: design
    condition: all_guards_pass
  - from: design
    to: build
    condition: all_guards_pass
  - from: design
    to: open
    condition: rollback_allowed
  - from: build
    to: verify
    condition: all_guards_pass
  - from: build
    to: design
    condition: rollback_allowed
  - from: verify
    to: archive
    condition: all_guards_pass
  - from: verify
    to: build
    condition: rollback_allowed

forbidden_transitions:
  - from: verify
    to: design
  - from: archive
    to: open
  - from: archive
    to: design
  - from: archive
    to: build
```

```yaml
# assets/workflows/product.yaml
id: product
name: "产品流程"
description: "collect → analyze → prd → review → accept"
version: 1
category: product
supports:
  - pm

phases:
  - id: collect
    name: "需求收集"
    requires:
      - planning
    artifacts:
      - docs/pm/collect-summary.md
  - id: analyze
    name: "需求分析"
    requires:
      - research
    artifacts:
      - docs/pm/analysis-report.md
  - id: prd
    name: "PRD 撰写"
    requires:
      - documentation
    artifacts:
      - docs/prd/*.md
  - id: review
    name: "评审"
    requires:
      - review
    artifacts:
      - docs/pm/review-record.md
  - id: accept
    name: "验收"
    requires:
      - review
    artifacts:
      - docs/pm/acceptance-report.md

transitions:
  - from: collect
    to: analyze
    condition: all_guards_pass
  - from: analyze
    to: prd
    condition: all_guards_pass
  - from: prd
    to: review
    condition: all_guards_pass
  - from: review
    to: accept
    condition: all_guards_pass
  - from: review
    to: prd
    condition: rollback_allowed

forbidden_transitions:
  - from: accept
    to: collect
```

### 5.3 SKILL.md（精简后）

```markdown
---
name: developer
description: 全栈开发者角色
role: developer
default_workflow: openspec
---

# 全栈开发者

你是全栈开发者。你遵循 IvyFlow 工作流。

## 角色定义

参考 `prompt/identity.md` 了解你的定位和职责。

## 工作流

参考 `prompt/workflow.md` 了解阶段定义。

## 思考方式

参考 `prompt/thinking.md` 了解分析和决策模式。

## 规则

- `rules/coding.md` — 编码规范
- `rules/review.md` — 审查标准
- `rules/quality.md` — 质量要求

## 快速开始

使用 `/ivyflow "描述"` 启动工作流。
```

---

## 六、关键技术决策

### D1：InstallEngine 按 role 选择 assets 源目录

`installKernel` 和 `installForOnePlatform` 根据 `InstallConfig.role` 从 `assets/roles/<role>/` 下选择对应的 skills/rules/commands。

### D2：Phase Skills 路径映射

Workflow `requires: coding` → RoleRegistry → `implementation: ivy-build` → `skills/ivy/ivy-build/SKILL.md`

### D3：公共 Commands 按平台安装

`commands/common/` 在所有角色下都安装，角色特有命令从 `roles/<role>/commands/` 安装。

### D4：向后兼容

- 旧 `.ivy/project.yaml` 无 `role` 字段 → 视为 `developer`
- `--quick` → `role: 'developer'`
- 旧路径引用全部更新

---

## 七、文件变更清单

### 新增文件（约 80 个）

| 类别 | 文件数 | 说明 |
|------|--------|------|
| role.yaml | 5 | 每个角色一个 |
| SKILL.md（角色入口） | 5 | 精简版，身份+引用 |
| prompt/ | 10 | identity + checklist |
| phase skills（完整版） | 25 | PM 5 + QA 5 + Architect 4 + DevOps 5 + Developer 调度器 5 + 公共 1 |
| commands/ | 18 | PM 3 + QA 3 + Architect 3 + DevOps 3 + common 3 + Developer 3 |
| workflows/ | 5 | openspec + product + qa + architecture + devops |
| templates/ | 3 | prd + testcase + design-doc |
| RoleRegistry | 1 | src/core/role-registry.ts |

### 修改文件（约 7 个）

| 文件 | 变更 |
|------|------|
| `assets/manifest.json` | 更新 skills 路径 |
| `src/core/skills.ts` | 支持按 role 选择源目录 |
| `src/core/installers/kernel.ts` | 按 role 安装 |
| `src/core/installers/platform.ts` | 按 role 安装 commands |
| `src/core/install-engine.ts` | InstallConfig 新增 role 字段 |
| `src/commands/init.ts` | 新增 stepRole() |
| `src/cli/index.ts` | 新增 --role 参数 |

### 移动文件

| 源路径 | 目标路径 |
|--------|---------|
| `assets/skills/ivy/*` | `assets/roles/developer/skills/ivy/*` |
| `assets/rules/*` | `assets/roles/developer/rules/*` |
| `assets/commands/ivyflow*.md` | `assets/roles/developer/commands/` |

---

## 八、测试策略

| 类型 | 测试内容 |
|------|---------|
| 单元测试 | RoleRegistry 加载/解析/查询 |
| 单元测试 | stepRole() 交互逻辑 |
| 集成测试 | `ivy init --role pm` 安装正确文件 |
| 集成测试 | `ivy init --quick` 保持向后兼容 |
| 回归测试 | 现有 971 个测试全部通过 |

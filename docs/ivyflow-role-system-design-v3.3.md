# IvyFlow 角色系统设计文档 v3.3（最终版）

> 日期：2026-07-14 | 版本：v3.3 | 状态：**冻结设计，进入实现**
> 参考：OpenSwarm + full-stack-skills 生态 + 三轮架构评审

---

## 一、评审采纳决策

| 建议 | 采纳 | 理由 |
|------|------|------|
| **Capability 绑定 Implementation 而非 Skill** | ✅ 采纳 | 为 MCP Tool / Agent / Remote Workflow 等未来实现方式预留空间 |
| **Workflow 声明 Artifacts** | ✅ 采纳 | 为 Archive 自动收集和 Knowledge Extraction 提供依据 |
| **状态转换规范（Transitions）** | ✅ 采纳 | 让 Workflow 从 Prompt 变成真正的 State Machine |
| Workflow 输入输出 | ⏸ MVP 后 | 当前 Workflow 阶段简单，输入输出可在 Phase 描述中说明 |
| Capability Cost | ⏸ MVP 后 | MVP 阶段无 Agent Scheduler，后续再引入 |
| Capability → Executor 抽象 | ⏸ v4+ | 当前 5 个角色无此需求，未来再分层 |

---

## 二、v3.3 核心变更

### 2.1 capability 绑定 implementation 而非 skill

```
v3.2：
  capabilities:
    - id: coding
      skill: ivy-build          ← 绑定 Skill

v3.3：
  capabilities:
    - id: coding
      implementation: ivy-build  ← 绑定 Implementation（可以是 Skill/MCP/Agent）
```

未来可以：
```yaml
implementation: mcp://code-review    # MCP Tool
implementation: agent://architect    # Agent
implementation: workflow://security  # 子 Workflow
```

### 2.2 Workflow 声明 transitions（状态机）

```
v3.2：只有 phases 列表，无状态转换约束

v3.3：增加 transitions 定义，Workflow 成为真正的 State Machine
```

### 2.3 Workflow 声明 artifacts

```
v3.3：每个 phase 声明 outputs（产出物），Archive 阶段可自动收集
```

---

## 三、最终架构

```
Session Config ──→ Role ──→ Workflow ──→ Phase ──→ Implementation
                        │                              │
                        └── Capability Mapping ────────┘
                               (id → implementation)
```

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
│   │   ├── skills/ivy/
│   │   └── commands/
│   │
│   ├── pm/
│   │   ├── role.yaml
│   │   ├── SKILL.md
│   │   ├── prompt/
│   │   ├── skills/pm/
│   │   └── commands/
│   │
│   ├── qa/
│   │   ├── role.yaml
│   │   ├── SKILL.md
│   │   ├── prompt/
│   │   ├── skills/qa/
│   │   └── commands/
│   │
│   ├── architect/
│   │   ├── role.yaml
│   │   ├── SKILL.md
│   │   ├── prompt/
│   │   ├── skills/architect/
│   │   └── commands/
│   │
│   └── devops/
│       ├── role.yaml
│       ├── SKILL.md
│       ├── prompt/
│       ├── skills/devops/
│       └── commands/
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
# assets/roles/ai-engineer/role.yaml  ← 未来角色示例
id: ai-engineer
name: "AI 工程师"
icon: "🤖"
description: "AI 辅助编码"
version: 1
default_workflow: openspec
default_topology: parallel

capabilities:
  - id: coding
    implementation: ai-coding          # 不同实现
  - id: review
    implementation: mcp://code-review  # MCP Tool
  - id: testing
    implementation: ivy-verify
  - id: design
    implementation: agent://architect  # 委托给 Agent
  - id: planning
    implementation: ivy-open
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
      - openspec/changes/<name>/specs/*/spec.md
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

# 状态转换规范（State Machine）
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
  - from: archive
    to: verify
    condition: false                # 禁止从 archive 回退

forbidden_transitions:
  - from: verify
    to: design                      # 明确禁止 verify → design
  - from: archive
    to: open
  - from: archive
    to: design
  - from: archive
    to: build
```

### 5.3 SKILL.md

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

参考 `prompt/identity.md`。

## 工作流

参考 `prompt/workflow.md`。

## 思考方式

参考 `prompt/thinking.md`。

## 规则

- `rules/coding.md` — 编码规范
- `rules/review.md` — 审查标准
- `rules/quality.md` — 质量要求

## 快速开始

使用 `/ivyflow "描述"` 启动工作流。
```

---

## 六、init 流程

### 角色选择（Step 2.5）

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

### .ivy/project.yaml

```yaml
role: developer
default_workflow: openspec
workflow_version: 1
default_topology: parallel
capabilities:
  coding: ivy-build
  review: ivy-verify
  testing: ivy-verify
  design: ivy-design
  planning: ivy-open
```

---

## 七、Session Config

```bash
# 用 QA workflow 跑 Developer 角色
ivy workflow start --workflow qa

# 切换 topology
ivy session set topology tree

# 覆盖 capability 实现
ivy session set capability:coding ai-coding
```

---

## 八、RoleRegistry

```typescript
interface CapabilityMapping {
  id: string;
  implementation: string;    // Skill | mcp://xxx | agent://xxx | workflow://xxx
}

interface RoleConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  version: number;
  default_workflow: string;
  default_topology: 'serial' | 'parallel' | 'supervisor' | 'debate';
  capabilities: CapabilityMapping[];
  commands: string[];
}

class RoleRegistry {
  private roles: Map<string, RoleConfig> = new Map();

  async load(): Promise<void> {
    const rolesDir = path.join(getAssetsDir(), 'roles');
    const entries = await fs.readdir(rolesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const yamlPath = path.join(rolesDir, entry.name, 'role.yaml');
      try {
        const config = await readYaml<RoleConfig>(yamlPath);
        if (config) this.roles.set(config.id, config);
      } catch { /* skip invalid */ }
    }
  }

  get(id: string): RoleConfig | undefined { return this.roles.get(id); }
  getAll(): RoleConfig[] { return [...this.roles.values()]; }
  getDefault(): RoleConfig { return this.roles.get('developer')!; }
  resolveImplementation(roleId: string, capabilityId: string): string | undefined {
    return this.roles.get(roleId)?.capabilities.find(c => c.id === capabilityId)?.implementation;
  }
}
```

---

## 九、Workflow Engine（后续设计）

以下模块属于**运行时引擎**范畴，不在本角色系统设计文档范围内，将在单独的《Workflow Engine 设计文档》中详细定义：

| 模块 | 职责 |
|------|------|
| WorkflowRunner | 驱动状态机，按 transitions 执行阶段 |
| PhaseExecutor | 执行单个 Phase，解析 capability → implementation |
| CapabilityResolver | 根据 Role + Session 解析 implementation |
| GuardEvaluator | 校验 guards，决定是否允许状态迁移 |
| TransitionManager | 管理合法状态转换、回退和恢复 |
| SessionManager | 管理运行时配置、覆盖项和状态持久化 |

---

## 十、实施计划

| 阶段 | 内容 | 工作量 |
|------|------|--------|
| **M1：基础设施** | RoleRegistry 配置化、workflow.yaml 格式（含 transitions + artifacts）、init 角色选择步骤、Session Config | 1-2 天 |
| **M2：Developer 迁移** | 现有内容迁移到 `roles/developer/`，SKILL.md 精简，prompt/rules 拆分 | 1 天 |
| **M3：PM + QA 角色** | role.yaml + SKILL.md + prompt/ + skills/ + commands/ | 2 天 |
| **M4：Architect + DevOps** | role.yaml + SKILL.md + prompt/ + skills/ + commands/ | 2 天 |
| **M5：公共 Commands + Templates** | commands/common/ 抽取，templates/ 创建 | 0.5 天 |
| **M6：测试 + 文档** | 单元测试、集成测试 | 1 天 |

**总计**：约 7-9 天。

---

## 十一、后续迭代

| 功能 | 优先级 | 版本 |
|------|--------|------|
| Workflow Engine（运行时） | 🔴 高 | v0.16 |
| Guard Registry | 🟡 中 | v0.17 |
| Capability Registry（独立） | 🟡 中 | v0.18 |
| Workflow Marketplace | 🟢 低 | v0.20 |
| Role Inheritance（extends） | 🟢 低 | v0.21 |
| Capability Cost + Executor 抽象 | 🟢 低 | v1.0 |

---

## 十二、版本变更历史

| 版本 | 核心变更 |
|------|---------|
| v1 | 5 个角色定义，按角色安装不同 skills |
| v2 | 引入 OpenSwarm 风格协作流水线，topology 字段 |
| v3 | 不引入外部 skills，角色 Prompt 内联 |
| v3.1 | Prompt 分层、Workflow 解耦、公共 Commands、RoleRegistry 配置化 |
| v3.2 | Workflow 依赖 Capability 而非 Skill、Workflow Metadata、Workflow Version |
| **v3.3** | **capability → implementation（非 skill）、Workflow transitions（状态机）、Workflow artifacts** |

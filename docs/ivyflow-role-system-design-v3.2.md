# IvyFlow 角色系统设计文档 v3.2

> 日期：2026-07-14 | 版本：v3.2 | 状态：开发就绪
> 参考：OpenSwarm + full-stack-skills 生态 + 两轮架构评审

---

## 一、评审采纳决策

| 建议 | 采纳 | 理由 |
|------|------|------|
| **Workflow 不直接引用 Skill，改用 Capability** | ✅ 采纳 | 唯一影响长期演进的设计点。Workflow 依赖抽象能力，不绑定具体实现 |
| **Guard Registry** | ⏸ MVP 后 | 当前 guards 数量少（~10 个），Registry 暂不需要。先统一命名规范 |
| **Workflow Metadata** | ✅ 采纳 | 增加 category/supports 字段，init 时可智能推荐 workflow |
| **Capability 结构化** | ✅ 采纳 | 增加 description/version 预留字段，但 MVP 阶段仍内联在 role.yaml |
| **Commands 权限声明** | ⏸ MVP 后 | 当前命令少（~20 个），声明式权限暂不需要 |
| **Workflow Version** | ✅ 采纳 | workflow.yaml 增加 version 字段，project.yaml 记录 workflow_version |
| **Role Inheritance** | ⏸ MVP 后 | MVP 阶段 5 个角色无继承需求，v2.x 再引入 extends 机制 |
| **Session Runtime** | ⏸ MVP 后 | 当前 Session Config 已覆盖 init 阶段需求，运行时扩展后续迭代 |

---

## 二、最终架构

### 2.1 六层架构

```
                 User
                   │
                   ▼
             Session Config
      (language / topology /
       workflow / role)
                   │
                   ▼
                 Role
       (Identity + default_workflow
        + capability → skill 映射)
                   │
                   ▼
              Workflow
      (Phase State Machine,
       phases 引用 capability)
                   │
                   ▼
              Capability
      (coding / review / testing ...)
       ← MVP 内联在 role.yaml
                   │
                   ▼
                Skills
        (Phase SKILL.md / Rules / Commands)
```

### 2.2 核心设计原则

> **Workflow 依赖 Capability，不依赖 Skill。**
> **Role 负责 Capability → Skill 的映射。**
> **同一个 Workflow 可以被不同 Role 复用，只需提供不同的映射。**

```
Developer 跑 OpenSpec workflow：
  build phase 需要 coding capability → developer 映射到 ivy-build skill

AI Engineer 跑 OpenSpec workflow：
  build phase 需要 coding capability → ai-engineer 映射到 ai-coding skill

Workflow 不变，Role 变。
```

---

## 三、目录结构

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
│   │   ├── skills/ivy/             # Phase skills
│   │   └── commands/               # 角色命令
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
└── templates/                      # ← 新增，可复用模板
    ├── prd.md
    ├── testcase.md
    └── design-doc.md
```

---

## 四、关键文件格式

### 4.1 role.yaml

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
    skill: ivy-build
  - id: review
    skill: ivy-verify
  - id: testing
    skill: ivy-verify
  - id: design
    skill: ivy-design
  - id: planning
    skill: ivy-open

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
    skill: pm-analyze
  - id: documentation
    skill: pm-prd
  - id: planning
    skill: pm-collect
  - id: review
    skill: pm-review

commands:
  - common
  - pm
```

### 4.2 workflow.yaml

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
    guards:
      - proposal_exists
      - design_exists
      - tasks_exist

  - id: design
    name: "设计"
    requires:
      - design
    guards:
      - handoff_context
      - handoff_hash

  - id: build
    name: "构建"
    requires:
      - coding
    guards:
      - isolation_set
      - build_mode_set
      - tasks_complete

  - id: verify
    name: "验证"
    requires:
      - testing
      - review
    guards:
      - verification_report
      - branch_handled

  - id: archive
    name: "归档"
    requires: []
    guards:
      - archived_flag
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
  - id: analyze
    name: "需求分析"
    requires:
      - research
  - id: prd
    name: "PRD 撰写"
    requires:
      - documentation
  - id: review
    name: "评审"
    requires:
      - review
  - id: accept
    name: "验收"
    requires:
      - review
```

### 4.3 SKILL.md（精简后）

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

## 五、init 流程

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

## 六、Session Config

运行时覆盖，不改变角色定义：

```bash
# 用 QA workflow 跑 Developer 角色
ivy workflow start --workflow qa

# 切换 topology
ivy session set topology tree

# AI Engineer 用同一 workflow 但不同 skill 映射
ivy session set capability:coding ai-coding
```

---

## 七、RoleRegistry 配置化

```typescript
interface CapabilityMapping {
  id: string;
  skill: string;
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

  /** Resolve which skill to use for a given capability in a workflow phase */
  resolveSkill(roleId: string, capabilityId: string): string | undefined {
    const role = this.roles.get(roleId);
    return role?.capabilities.find(c => c.id === capabilityId)?.skill;
  }
}
```

---

## 八、实施计划

| 阶段 | 内容 | 工作量 |
|------|------|--------|
| **M1：基础设施** | RoleRegistry 配置化、workflow.yaml 格式定义、init 角色选择步骤、Session Config 字段 | 1-2 天 |
| **M2：Developer 迁移** | 现有内容迁移到 `roles/developer/`，SKILL.md 精简，prompt/rules 拆分 | 1 天 |
| **M3：PM + QA 角色** | role.yaml + SKILL.md + prompt/ + skills/ + commands/ | 2 天 |
| **M4：Architect + DevOps** | role.yaml + SKILL.md + prompt/ + skills/ + commands/ | 2 天 |
| **M5：公共 Commands + Templates** | commands/common/ 抽取，templates/ 创建 | 0.5 天 |
| **M6：测试 + 文档** | 单元测试、集成测试 | 1 天 |

**总计**：约 7-9 天。

---

## 九、后续迭代（v2.x / v3.x）

| 功能 | 优先级 | 说明 |
|------|--------|------|
| Guard Registry | 中 | Guards 统一注册，避免命名漂移 |
| Capability Registry（独立） | 中 | capability.yaml 独立文件，当前内联在 role.yaml |
| Commands 权限声明 | 中 | 声明式权限控制 |
| Role Inheritance（extends） | 低 | 角色继承，减少 Prompt 复制 |
| Session Runtime | 低 | 运行时状态恢复 |
| Workflow Marketplace | 低 | 社区共享 workflow |

---

## 十、版本变更历史

| 版本 | 核心变更 |
|------|---------|
| v1 | 5 个角色定义，按角色安装不同 skills |
| v2 | 引入 OpenSwarm 风格协作流水线，topology 字段 |
| v3 | 不引入外部 skills，角色 Prompt 内联，topology 移到 Session |
| v3.1 | Prompt 分层、Workflow 解耦、公共 Commands、RoleRegistry 配置化 |
| **v3.2** | **Workflow 依赖 Capability 而非 Skill、Workflow Metadata、Workflow Version** |

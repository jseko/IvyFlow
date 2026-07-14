# IvyFlow 角色系统设计文档 v3.1

> 日期：2026-07-14 | 版本：v3.1
> 参考：OpenSwarm + full-stack-skills 生态 + 架构评审

---

## 一、评审采纳决策

| 建议 | 采纳 | 理由 |
|------|------|------|
| **Prompt 分层** | ✅ 采纳 | SKILL.md 只保留身份 + 引用，具体内容放在 prompt/ rules/ 子目录 |
| **Workflow 与 Role 解耦** | ✅ 采纳 | Role 只指定 default_workflow，Workflow 独立定义，可复用 |
| **公共 Commands** | ✅ 采纳 | `/status` `/phase` `/help` 等共享，角色特有命令单独放 |
| **RoleRegistry 配置化** | ✅ 采纳 | 每个角色一个 role.yaml，RoleRegistry 自动扫描 |
| **Topology 从 Role 移到 Session** | ✅ 采纳 | Topology 是会话级配置，不是角色固定属性。Role 只设默认值 |
| **引入 Capability 层** | ⚠️ 部分采纳 | 方向正确但 MVP 阶段暂不实现。先在 role.yaml 中预留 capability 字段，Phase Skill 中引用 capability 名称即可，不做独立的 Capability 注册表 |

---

## 二、采纳后的架构

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
        + capabilities)
                   │
                   ▼
              Workflow
      (Phase State Machine)
                   │
                   ▼
              Capability         ← MVP 阶段内联在 Role 中，后续独立
    (coding / review / testing ...)
                   │
                   ▼
                Skills
        (Phase SKILL.md / Rules / Commands)
```

### 2.2 各层职责

| 层 | 职责 | MVP 实现 |
|-----|------|---------|
| **Session Config** | topology、language、role、workflow 运行时配置 | init 时写入 `.ivy/project.yaml` |
| **Role** | 身份定义、默认 workflow、可用 capability | `role.yaml` 配置化 |
| **Workflow** | 阶段状态机，与 Role 解耦 | `workflows/<name>.yaml` |
| **Capability** | 抽象通用工程能力 | MVP 阶段在 role.yaml 中声明，Phase Skill 中按名引用 |
| **Skills** | Phase SKILL.md、Rules、Commands | 现有实现 |

---

## 三、目录结构

```
assets/
├── roles/
│   ├── developer/
│   │   ├── role.yaml              # 角色配置（← 新增，替代 manifest.yaml）
│   │   ├── SKILL.md               # 身份 + 引用（← 精简）
│   │   ├── prompt/
│   │   │   ├── identity.md        # 角色定位
│   │   │   ├── workflow.md        # 工作流说明
│   │   │   └── thinking.md        # 思考方式
│   │   ├── rules/
│   │   │   ├── coding.md
│   │   │   ├── review.md
│   │   │   └── quality.md
│   │   ├── skills/ivy/            # Phase skills
│   │   └── commands/
│   │       └── ivyflow-*.md
│   │
│   ├── pm/
│   │   ├── role.yaml
│   │   ├── SKILL.md
│   │   ├── prompt/
│   │   │   ├── identity.md
│   │   │   ├── prd-checklist.md
│   │   │   └── review-checklist.md
│   │   ├── skills/pm/
│   │   └── commands/
│   │       └── pmflow-*.md
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
├── workflows/                     # ← 新增，独立于 Role
│   ├── openspec.yaml              # open → design → build → verify → archive
│   ├── product.yaml               # collect → analyze → prd → review → accept
│   ├── qa.yaml                    # testcase → execute → bug → report → regression
│   ├── architecture.yaml          # research → design → review → guide
│   └── devops.yaml                # env → cicd → deploy → monitor → alert
│
└── commands/
    └── common/                    # ← 新增，公共命令
        ├── status.md
        ├── phase.md
        └── help.md
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
default_workflow: openspec
default_topology: parallel
capabilities:
  - coding
  - review
  - testing
  - design
  - planning
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
default_workflow: product
default_topology: supervisor
capabilities:
  - planning
  - review
  - documentation
  - research
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
phases:
  - id: open
    name: "开启"
    skill: ivy-open
    guards:
      - proposal_exists
      - design_exists
      - tasks_exist
  - id: design
    name: "设计"
    skill: ivy-design
    guards:
      - handoff_context
      - handoff_hash
  - id: build
    name: "构建"
    skill: ivy-build
    guards:
      - isolation_set
      - build_mode_set
      - tasks_complete
  - id: verify
    name: "验证"
    skill: ivy-verify
    guards:
      - verification_report
      - branch_handled
  - id: archive
    name: "归档"
    skill: ivy-archive
    guards:
      - archived_flag
```

```yaml
# assets/workflows/product.yaml
id: product
name: "产品流程"
description: "collect → analyze → prd → review → accept"
phases:
  - id: collect
    name: "需求收集"
    skill: pm-collect
  - id: analyze
    name: "需求分析"
    skill: pm-analyze
  - id: prd
    name: "PRD 撰写"
    skill: pm-prd
  - id: review
    name: "评审"
    skill: pm-review
  - id: accept
    name: "验收"
    skill: pm-accept
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

### 按角色安装

| 角色 | 安装到平台的内容 |
|------|----------------|
| developer | `roles/developer/SKILL.md` + `skills/ivy/` + `rules/` + `commands/developer/` + `commands/common/` |
| pm | `roles/pm/SKILL.md` + `prompt/` + `skills/pm/` + `commands/pm/` + `commands/common/` |
| qa | `roles/qa/SKILL.md` + `prompt/` + `skills/qa/` + `commands/qa/` + `commands/common/` |
| architect | `roles/architect/SKILL.md` + `prompt/` + `skills/architect/` + `commands/architect/` + `commands/common/` |
| devops | `roles/devops/SKILL.md` + `prompt/` + `skills/devops/` + `commands/devops/` + `commands/common/` |

### .ivy/project.yaml 新增字段

```yaml
role: developer
default_workflow: openspec
default_topology: parallel
capabilities:
  - coding
  - review
  - testing
  - design
  - planning
```

---

## 六、Session Config（运行时覆盖）

`topology` 和 `workflow` 可以在会话中动态覆盖，不改变角色定义：

```bash
# 用 QA workflow 跑 Developer 角色
ivy workflow start --workflow qa

# 切换 topology
ivy session set topology tree
```

角色只提供默认值，运行时可以覆盖。

---

## 七、RoleRegistry 配置化

```typescript
interface RoleConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  default_workflow: string;
  default_topology: 'serial' | 'parallel' | 'supervisor' | 'debate';
  capabilities: string[];
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
}
```

新增角色只需创建 `assets/roles/<id>/role.yaml`，无需修改代码。

---

## 八、实施计划

| 阶段 | 内容 | 工作量 |
|------|------|--------|
| **M1：基础设施** | RoleRegistry 配置化、workflow.yaml 格式定义、init 角色选择步骤、Session Config 字段 | 1-2 天 |
| **M2：Developer 迁移** | 现有内容迁移到 `roles/developer/`，SKILL.md 精简，prompt/ rules/ 拆分 | 1 天 |
| **M3：PM + QA 角色** | role.yaml + SKILL.md + prompt/ + skills/ + commands/ | 2 天 |
| **M4：Architect + DevOps** | role.yaml + SKILL.md + prompt/ + skills/ + commands/ | 2 天 |
| **M5：公共 Commands** | commands/common/ 抽取 | 0.5 天 |
| **M6：测试 + 文档** | 单元测试、集成测试 | 1 天 |

**总计**：约 7-9 天。

---

## 九、v3 → v3.1 变更摘要

| 变更 | v3 | v3.1 |
|------|-----|------|
| **Prompt 分层** | SKILL.md 包含全部内容 | SKILL.md 精简为身份+引用，prompt/ rules/ 拆分 |
| **Workflow 解耦** | phases 写在 Role 中 | Workflow 独立为 `workflows/*.yaml`，Role 只指定 default_workflow |
| **公共 Commands** | 每个角色复制一份 | `commands/common/` 共享，角色特有命令单独放 |
| **RoleRegistry** | 代码硬编码 | 完全配置化（`role.yaml` 自动扫描） |
| **Topology** | 角色固定属性 | 移到 Session Config，Role 只设默认值，运行时可覆盖 |
| **Capability** | 无 | role.yaml 中声明，Phase Skill 中按名引用（MVP 阶段内联，后续独立） |

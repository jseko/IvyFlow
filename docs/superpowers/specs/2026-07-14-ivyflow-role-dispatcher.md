# IvyFlow 全量安装 + 角色调度器设计

> 日期：2026-07-14 | 状态：待实施 | 版本：v1.0

---

## 一、设计目标

解决多次 `ivy init --role` 导致角色覆盖的问题。改为 init 时全量安装所有 5 个角色，Claude Code 根据 `.ivy/project.yaml` 中的 `role` 字段确定当前角色，用户通过 `ivy role set` 命令切换角色。

---

## 二、核心架构

```
ivy init（全量安装）
  ↓
.claude/
├── commands/          ← 所有 5 个角色的命令 + common
├── skills/
│   ├── ivy-role/      ← 角色调度器（Claude Code 入口）
│   ├── ivy/           ← Developer phase skills
│   ├── pm/            ← PM phase skills
│   ├── qa/            ← QA phase skills
│   ├── architect/     ← Architect phase skills
│   └── devops/        ← DevOps phase skills
└── rules/             ← 共享规则

.ivy/project.yaml → role: developer（默认）
```

---

## 三、角色调度器

### ivy-role/SKILL.md

```markdown
---
name: ivy-role
description: IvyFlow 角色调度器 — 读取 project.yaml 确定当前角色并路由
---

# IvyFlow 角色调度器

读取 .ivy/project.yaml 中的 role 字段确定当前角色。

## 角色与命令

| 命令 | 角色 | 工作流 |
|------|------|--------|
| /ivyflow | developer | open → design → build → verify → archive |
| /pmflow | pm | collect → analyze → prd → review → accept |
| /qaflow | qa | testcase → execute → bug → report → regression |
| /archflow | architect | research → design → review → guide |
| /devopsflow | devops | env → cicd → deploy → monitor → alert |

## 切换角色

```bash
ivy role set pm     # 切换到产品经理
ivy role show       # 查看当前角色
ivy role list       # 列出所有可用角色
```
```

### 调度流程

```
Claude Code 启动 → 加载 ivy-role/SKILL.md
  ↓
读取 .ivy/project.yaml → role 字段
  ↓
匹配对应角色的 SKILL.md → 进入角色工作流
```

---

## 四、CLI 命令

### ivy role

```bash
ivy role show              # 显示当前角色和描述
ivy role list              # 列出所有可用角色（id + name + description）
ivy role set <role>        # 切换角色（更新 .ivy/project.yaml 中的 role 字段）
```

### init 变更

- 移除 `--role` 参数
- 移除 Step 2.5 角色选择步骤
- `installForOnePlatform` 安装所有 5 个角色的 skills + commands
- `installKernel` 安装所有角色的内核内容
- `.ivy/project.yaml` 默认 `role: developer`

---

## 五、文件变更

### 新增文件

| 文件 | 内容 |
|------|------|
| `src/commands/role.ts` | `ivy role set/show/list` 命令实现 |
| `assets/skills/ivy-role/SKILL.md` | 角色调度器 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/commands/init.ts` | 移除 `stepRole()`、`InitOptions.role` |
| `src/core/installers/platform.ts` | `installForOnePlatform` 安装所有角色内容 |
| `src/core/installers/kernel.ts` | 安装所有角色的 skills/rules/hooks |
| `src/core/install-engine.ts` | `InstallConfig` 移除 `role` 字段 |
| `src/cli/index.ts` | 移除 `--role` 参数，新增 `role` 子命令 |

### 删除/移动文件

| 文件 | 操作 |
|------|------|
| `assets/roles/developer/skills/ivy/SKILL.md` | 合并到 `ivy-role/SKILL.md` |

---

## 六、实施计划

| 阶段 | 内容 | 工作量 |
|------|------|--------|
| M1: CLI | `ivy role set/show/list` 命令 | 0.5 天 |
| M2: 调度器 | `ivy-role/SKILL.md` 角色调度器 | 0.5 天 |
| M3: init 变更 | 移除角色选择，全量安装 | 1 天 |
| M4: 测试 | 单元测试 + 集成测试 | 0.5 天 |

**总计**：约 2.5 天。

# IvyFlow 操作手册

> **AI-Native Development Workflow** — AI 编码 Agent 的工作流强约束器

## 概述

IvyFlow 通过三重阶段守卫、5 角色多 Agent 协作、采纳率分析和知识记忆系统，为 AI 编码 Agent 提供结构化开发工作流。

- **版本**：v0.15.0
- **CLI 命令**：`ivy`
- **安装**：`npm install -g ivyflow-cli`

## 快速开始

```bash
npm install -g ivyflow-cli
cd your-project
ivy init
```

### 在 AI Agent 中使用

安装完成后，重启 AI 编码工具，在对话框中输入：

```
/ivyflow "实现用户登录功能"
```

详细说明请参阅 [**在 AI Agent 中使用 IvyFlow**](./agent-usage.md)。

### 最佳实践工作流

参阅 [**最佳实践工作流操作指南**](./best-practice-workflow.md) — 5 角色协作模式、6 种实战场景、状态机规则。

### 实现评估

参阅 [**多 Agent 流水线实现评估**](./pipeline-implementation-assessment.md) — 当前实现与设计规范的对比分析。

---

## 命令索引

### Agent 使用指南

| 文档 | 说明 |
|------|------|
| [agent-usage.md](./agent-usage.md) | **在 AI Agent 中使用 IvyFlow** — 全部斜杠命令、5 角色使用、工作流实操 |

### 安装与维护

| 命令 | 文档 | 说明 |
|------|------|------|
| `ivy init` | [ivy-init.md](./ivy-init.md) | 安装与初始化 |
| `ivy uninstall` | [ivy-uninstall.md](./ivy-uninstall.md) | 安全卸载 |
| `ivy update` | [ivy-update.md](./ivy-update.md) | 更新检查 |
| `ivy doctor` | [ivy-doctor.md](./ivy-doctor.md) | 健康检查与修复 |
| `ivy sync` | [ivy-sync.md](./ivy-sync.md) | 平台规则同步 |

### 工作流核心

| 命令 | 文档 | 说明 |
|------|------|------|
| `ivy status` | [ivy-status.md](./ivy-status.md) | 状态查询 |
| `ivy validate` | [ivy-validate.md](./ivy-validate.md) | 阶段验证 |
| `ivy guard` | [ivy-guard.md](./ivy-guard.md) | 三重阶段守卫 |
| `ivy guard validate` | [ivy-guard-validate.md](./ivy-guard-validate.md) | 守卫层验证 |
| `ivy verify` | [ivy-verify.md](./ivy-verify.md) | 质量门禁 |
| `ivy archive` | [ivy-archive.md](./ivy-archive.md) | 变更归档 |
| `ivy state` | [ivy-state.md](./ivy-state.md) | 生命周期检查点 |
| `ivy workflow` | [ivy-workflow.md](./ivy-workflow.md) | 工作流管理 |

### 分析洞察

| 命令 | 文档 | 说明 |
|------|------|------|
| `ivy analytics` | [ivy-analytics.md](./ivy-analytics.md) | 采纳率分析 |
| `ivy dashboard` | [ivy-dashboard.md](./ivy-dashboard.md) | 交互式仪表盘 |
| `ivy suggest` | [ivy-suggest.md](./ivy-suggest.md) | 工作流建议 |
| `ivy review` | [ivy-review.md](./ivy-review.md) | 交互式建议审查 |
| `ivy check` | [ivy-check.md](./ivy-check.md) | CI 健康检查 |
| `ivy explain` | [ivy-explain.md](./ivy-explain.md) | 建议溯源 |
| `ivy feedback` | [ivy-feedback.md](./ivy-feedback.md) | 反馈分析 |
| `ivy assess` | [ivy-assess.md](./ivy-assess.md) | 遗留项目评估 |

### 知识管理

| 命令 | 文档 | 说明 |
|------|------|------|
| `ivy audit` | [ivy-audit.md](./ivy-audit.md) | 证据审计 |
| `ivy trace` | [ivy-trace.md](./ivy-trace.md) | 知识链接追溯 |
| `ivy knowledge` | [ivy-knowledge.md](./ivy-knowledge.md) | 知识链接管理 |
| `ivy memory` | [ivy-memory.md](./ivy-memory.md) | 记忆系统管理 |
| `ivy council` | [ivy-council.md](./ivy-council.md) | 记忆智囊团 |

### 能力与规则

| 命令 | 文档 | 说明 |
|------|------|------|
| `ivy fingerprint` | [ivy-fingerprint.md](./ivy-fingerprint.md) | 技术栈检测 |
| `ivy capability` | [ivy-capability.md](./ivy-capability.md) | 能力检测与管理 |
| `ivy rules` | [ivy-rules.md](./ivy-rules.md) | 规则管理 |
| `ivy skill` | [ivy-skill.md](./ivy-skill.md) | 技能注册表 |

### 发布与导出

| 命令 | 文档 | 说明 |
|------|------|------|
| `ivy release` | [ivy-release.md](./ivy-release.md) | 发布打包 |
| `ivy export` | [ivy-export.md](./ivy-export.md) | 数据导出 |

### 多角色与协作

| 命令 | 文档 | 说明 |
|------|------|------|
| `ivy role` | [ivy-role.md](./ivy-role.md) | 角色管理 |
| `ivy pipeline` | [ivy-pipeline.md](./ivy-pipeline.md) | 多角色流水线 |
| `ivy dispatch` | [ivy-dispatch.md](./ivy-dispatch.md) | 多 Agent 任务分发 |

### 开发流程

| 命令 | 文档 | 说明 |
|------|------|------|
| `ivy propose` | [ivy-propose.md](./ivy-propose.md) | 提案驱动开发 |
| `ivy apply` | [ivy-apply.md](./ivy-apply.md) | 实施入口 |
| `ivy worktree` | [ivy-worktree.md](./ivy-worktree.md) | Git 工作树管理 |
| `ivy handoff` | [ivy-handoff.md](./ivy-handoff.md) | 上下文交接 |
| `ivy next` | [ivy-next.md](./ivy-next.md) | 下一技能解析 |
| `ivy explore` | [ivy-explore.md](./ivy-explore.md) | 只读探索模式 |

---

## 典型工作流

### Developer 完整流程

```bash
# 1. 初始化
ivy init --yes

# 2. 创建提案
ivy propose add-user-auth

# 3. 阶段转换
ivy guard run open --apply --change add-user-auth    # OPEN → DESIGN
ivy guard run design --apply --change add-user-auth  # DESIGN → BUILD

# 4. 上下文交接
ivy handoff add-user-auth design --write

# 5. 构建完成后验证
ivy guard run build --apply --change add-user-auth   # BUILD → VERIFY
ivy verify --change add-user-auth

# 6. 归档
ivy guard run verify --apply --change add-user-auth  # VERIFY → ARCHIVE
ivy archive --change add-user-auth --adr

# 7. 查看成果
ivy analytics --change add-user-auth
```

### 多角色流水线

```bash
# 1. 启动流水线
ivy pipeline start user-dashboard

# 2. PM 阶段
ivy role set pm
# ... 完成需求分析和 PRD
ivy pipeline complete pm-accept

# 3. Developer 阶段
ivy role set developer
# ... 完成开发和验证
ivy pipeline complete dev-archive

# 4. QA 阶段
ivy role set qa
# ... 完成测试
ivy pipeline complete qa-regression

# 5. DevOps 阶段
ivy role set devops
# ... 完成部署
ivy pipeline complete devops-alert
```

---

## 相关资源

- [README (English)](../README.md)
- [README (简体中文)](../README.zh-CN.md)
- [更新日志](../CHANGELOG.md)
- [贡献指南](../CONTRIBUTING.md)

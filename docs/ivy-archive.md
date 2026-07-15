# ivy archive — 变更归档

## 功能介绍

`ivy archive` 将已完成的 Change 归档，同时执行知识提取和 L0 记忆写入。归档是工作流的终态阶段，完成后 Change 不可再修改。

### 核心能力

- **知识提取**：从设计文档中自动提取决策、约束、风险和事实
- **L0 记忆写入**：将提取的知识存入三层记忆系统的核心层
- **ADR 生成**：生成架构决策记录
- **分支操作**：支持归档到本地、推送 PR、保持状态、丢弃
- **工作树清理**：可选清理关联的 git worktree

## 操作步骤

### 基本归档

```bash
ivy archive --change add-user-auth
```

### 带知识提取归档

```bash
ivy archive --change add-user-auth --adr
```

### 指定归档后动作

```bash
# 归档到本地
ivy archive --change add-user-auth --action archive-local

# 推送 PR
ivy archive --change add-user-auth --action push-pr --message "feat: add user auth"

# 保持当前状态
ivy archive --change add-user-auth --action keep-state

# 丢弃
ivy archive --change add-user-auth --action discard
```

### 强制归档（从非 VERIFY 阶段）

```bash
ivy archive --change add-user-auth --force
```

### 跳过知识提取

```bash
ivy archive --change add-user-auth --no-extract
```

### 清理工作树

```bash
ivy archive --change add-user-auth --cleanup-worktree
```

## 知识提取内容

| 类型 | 说明 | 示例 |
|------|------|------|
| decision | 架构决策 | "使用 JWT 进行身份验证" |
| constraint | 约束条件 | "必须兼容 Node.js 20+" |
| risk | 风险项 | "第三方 API 可能不稳定" |
| fact | 项目事实 | "使用 PostgreSQL 数据库" |

## 使用案例

### 案例 1：标准归档流程

```bash
# 1. 先运行质量门禁
ivy verify --change add-user-auth

# 2. 归档并提取知识
ivy archive --change add-user-auth --adr

# 3. 推送 PR
ivy archive --change add-user-auth --action push-pr --message "feat: add user authentication"
```

### 案例 2：紧急归档

```bash
ivy archive --change hotfix-crash --force --action archive-local
```

### 案例 3：归档并清理

```bash
ivy archive --change add-payment --cleanup-worktree --adr
```

## 相关命令

- `ivy verify` — 质量门禁
- `ivy release` — 发布打包
- `ivy workflow archive` — 工作流归档

# ivy dispatch — 多 Agent 任务分发

## 功能介绍

`ivy dispatch` 从 tasks.md 中读取任务列表，分发给多个 AI Agent 并行执行，支持任务状态同步。

### 子命令

| 子命令 | 说明 |
|--------|------|
| `dispatch run` | 分发执行任务 |
| `dispatch status` | 查看任务执行状态（默认） |
| `dispatch sync-status` | 同步任务状态到 tasks.md |

## 操作步骤

### 查看任务状态

```bash
ivy dispatch
ivy dispatch status
```

### 分发执行任务

```bash
# 基本分发
ivy dispatch run

# 指定任务文件
ivy dispatch run --tasks ./openspec/changes/add-auth/tasks.md

# 设置并行度
ivy dispatch run --parallel 2

# 推荐可运行任务（不执行）
ivy dispatch run --recommend

# 分发后推荐下一阶段
ivy dispatch run --recommend-phase
```

### 同步任务状态

```bash
# 预览变更
ivy dispatch sync-status

# 应用变更到 tasks.md
ivy dispatch sync-status --apply
```

## 使用案例

### 案例 1：并行执行任务

```bash
# 将 tasks.md 中的任务分发给 4 个 Agent 并行执行
ivy dispatch run --parallel 4
```

### 案例 2：预览任务

```bash
ivy dispatch run --recommend
# 查看哪些任务可以并行执行，哪些有依赖
```

### 案例 3：同步状态

```bash
ivy dispatch status
# 查看任务执行进度
ivy dispatch sync-status --apply
# 将完成状态写回 tasks.md
```

## 相关命令

- `ivy propose` — 提案驱动开发
- `ivy apply` — 实施入口

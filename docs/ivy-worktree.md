# ivy worktree — Git 工作树管理

## 功能介绍

`ivy worktree` 自动管理 Git 工作树（worktree），为每个 Change 创建隔离的开发环境，避免分支切换和文件冲突。

### 子命令

| 子命令 | 说明 |
|--------|------|
| `worktree create` | 为 Change 创建工作树 |
| `worktree list` | 列出所有 IvyFlow 管理的工作树 |
| `worktree cleanup` | 清理指定工作树 |
| `worktree cleanup-all` | 清理所有已完成的工作树 |
| `worktree merge` | 合并工作树分支 |
| `worktree status` | 工作树状态概览 |

## 操作步骤

### 创建工作树

```bash
ivy worktree create add-user-auth
ivy worktree create add-user-auth --branch feature/user-auth
```

### 列出工作树

```bash
ivy worktree list
```

### 查看状态

```bash
ivy worktree status
```

### 合并工作树

```bash
ivy worktree merge add-user-auth
ivy worktree merge add-user-auth --strategy squash
```

### 清理工作树

```bash
# 清理单个
ivy worktree cleanup add-user-auth

# 清理所有已完成
ivy worktree cleanup-all
```

## 使用案例

### 案例 1：隔离开发

```bash
# 创建工作树，不干扰主分支
ivy worktree create add-payment
# 在新工作树中开发，主分支保持干净
```

### 案例 2：并行开发多个功能

```bash
ivy worktree create feature-a
ivy worktree create feature-b
ivy worktree list
# 两个功能并行开发，互不影响
```

### 案例 3：开发完成合并

```bash
ivy worktree merge feature-a
ivy worktree cleanup feature-a
```

### 案例 4：清理所有已完成工作树

```bash
ivy worktree cleanup-all
# 批量清理已归档 Change 的工作树
```

## 相关命令

- `ivy workflow start --isolate` — 启动工作流时自动创建隔离
- `ivy archive --cleanup-worktree` — 归档时清理工作树

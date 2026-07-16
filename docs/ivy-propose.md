# ivy propose — 提案驱动开发

## 功能介绍

`ivy propose` 启动提案驱动的开发流程，自动创建工作树并生成提案文档，推荐进入 DESIGN 阶段。

## 操作步骤

### 基本提案

```bash
ivy propose add-user-auth
```

### 并行生成

```bash
ivy propose add-user-auth --parallel
```

## 工作流程

1. 创建工作树（隔离环境）
2. 生成 OpenSpec change 结构（proposal/design/tasks）
3. 推荐进入 DESIGN 阶段

## 使用案例

### 案例 1：开始新功能

```bash
ivy propose user-dashboard
# 自动创建提案结构和工作树
```

### 案例 2：并行生成提案文档

```bash
ivy propose payment-system --parallel
# 并行生成 proposal.md、design.md、tasks.md
```

## 相关命令

- `ivy apply` — 实施入口
- `ivy dispatch` — 任务分发

# ivy apply — 实施入口

## 功能介绍

`ivy apply` 是实施阶段的入口命令，读取已有的提案和设计文档，推荐进入 VERIFY 阶段。

## 操作步骤

```bash
ivy apply add-user-auth
```

## 工作流程

1. 读取 proposal.md 和 design.md
2. 检查 tasks.md 任务完成状态
3. 推荐进入 VERIFY 阶段

## 使用案例

### 案例 1：提案完成后开始实施

```bash
# 1. 创建提案
ivy propose add-auth

# 2. 完成设计后开始实施
ivy apply add-auth
```

### 案例 2：继续已有 Change 的实施

```bash
ivy apply existing-feature
```

## 相关命令

- `ivy propose` — 提案驱动开发
- `ivy verify` — 质量门禁

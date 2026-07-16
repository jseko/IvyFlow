# ivy handoff — 上下文交接

## 功能介绍

`ivy handoff` 在阶段转换时生成上下文交接包，确保下一阶段的 Agent 能获取完整的上下文信息。

## 操作步骤

### 生成交接包

```bash
# 预览交接包（不写入文件）
ivy handoff add-user-auth design

# 写入交接文件
ivy handoff add-user-auth design --write

# 包含完整文件内容
ivy handoff add-user-auth design --write --full

# 仅计算上下文哈希
ivy handoff add-user-auth design --hash-only
```

## 交接内容

- 当前阶段状态
- 已完成的文档和决策
- 待处理的任务
- 关键上下文信息

## 使用案例

### 案例 1：DESIGN → BUILD 交接

```bash
ivy handoff add-auth design --write
# 生成设计到构建阶段的交接包
```

### 案例 2：验证上下文完整性

```bash
ivy handoff add-auth design --hash-only
# 计算哈希，用于验证上下文是否一致
```

### 案例 3：详细交接

```bash
ivy handoff add-auth design --write --full
# 包含完整文件内容，确保下阶段 Agent 有全部信息
```

## 相关命令

- `ivy next` — 下一技能解析
- `ivy state set` — 阶段转换

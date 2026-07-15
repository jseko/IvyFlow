# ivy review — 交互式建议审查

## 功能介绍

`ivy review` 提供交互式建议审查界面，支持接受、驳回、暂缓和忽略建议。可批量处理或逐条处理。

### 操作类型

| 操作 | 说明 |
|------|------|
| `accept` | 接受建议 |
| `dismiss` | 驳回建议 |
| `snooze` | 暂缓建议（可设置天数） |
| `ignore` | 忽略建议 |

## 操作步骤

### 交互式审查

```bash
ivy review
```

### 按类型过滤

```bash
ivy review --type stuck
ivy review --type phase_review
ivy review --type rollback_warning
```

### 指定 Change

```bash
ivy review --change add-user-auth
```

### 批量模式

```bash
# 批量接受
ivy review --auto accept

# 批量暂缓 14 天
ivy review --auto snooze --snooze-days 14
```

### JSON 输出

```bash
ivy review --json
```

## 使用案例

### 案例 1：每周建议清理

```bash
ivy review
# 交互式逐条处理建议
```

### 案例 2：批量暂缓非紧急建议

```bash
ivy review --type rollback_warning --auto snooze --snooze-days 7
```

### 案例 3：快速接受所有卡住建议

```bash
ivy review --type stuck --auto accept
```

## 相关命令

- `ivy suggest` — 工作流建议
- `ivy explain` — 建议溯源

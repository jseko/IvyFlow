# ivy suggest — 工作流建议

## 功能介绍

`ivy suggest` 提供工作流建议，帮助检测卡住、建议阶段回退和阶段审查。所有建议均为建议性质，不会自动执行。

### 建议类型

| 类型 | 说明 |
|------|------|
| `stuck` | 检测长时间未推进的阶段 |
| `phase_review` | 建议审查当前阶段产出 |
| `rollback_warning` | 建议回退到前一阶段 |

## 操作步骤

### 查看所有建议

```bash
ivy suggest
```

### 仅查看卡住检测

```bash
ivy suggest --stuck
```

### 指定 Change

```bash
ivy suggest --change add-user-auth
```

### JSON 输出（含质量指标）

```bash
ivy suggest --json
```

### 标记建议为已处理

```bash
ivy suggest --mark-resolved <suggestion-id>
```

### 反馈动作

```bash
ivy suggest --mark-resolved <id> --action accepted
ivy suggest --mark-resolved <id> --action dismissed
ivy suggest --mark-resolved <id> --action ignored
```

### 校准卡住阈值

```bash
ivy suggest --calibrate
```

### 质量仪表盘

```bash
ivy suggest --quality
```

### 显示过期建议

```bash
ivy suggest --show-expired
```

### 显示所有级别建议

```bash
ivy suggest --show-all
```

### 附加溯源说明

```bash
ivy suggest --explain
```

## 使用案例

### 案例 1：检查是否卡在某个阶段

```bash
ivy suggest --stuck
# 输出：BUILD 阶段已持续 5 天，建议审查或回退
```

### 案例 2：每日工作前检查

```bash
ivy suggest
# 了解当前工作流有哪些待处理建议
```

### 案例 3：校准团队阈值

```bash
ivy suggest --calibrate
# 根据团队历史数据调整卡住检测阈值
```

### 案例 4：CI 集成

```bash
ivy suggest --json --stuck | jq '.suggestions | length'
# 如果卡住建议 > 0，发送告警
```

## 相关命令

- `ivy review` — 交互式建议处理
- `ivy explain` — 建议溯源
- `ivy check` — CI 健康检查

# ivy audit — 证据审计

## 功能介绍

`ivy audit` 对记忆记录进行证据覆盖率审计，检测孤立决策、缺失证据链接和覆盖率缺口。

## 操作步骤

### 审计指定 Change

```bash
ivy audit --change add-user-auth
```

### JSON 输出

```bash
ivy audit --change add-user-auth --json
```

### 管道友好输出

```bash
ivy audit --change add-user-auth --pipe
```

## 审计维度

| 维度 | 说明 |
|------|------|
| orphaned decisions | 无证据链接的决策 |
| missing evidence | 缺失的证据记录 |
| coverage gaps | 覆盖率缺口 |

## 使用案例

### 案例 1：归档前审计

```bash
ivy audit --change add-user-auth
# 确认所有决策都有对应证据
```

### 案例 2：管道处理

```bash
ivy audit --change add-user-auth --pipe | jq '.coverage_rate'
```

## 相关命令

- `ivy verify` — 质量门禁
- `ivy trace` — 知识链接追溯

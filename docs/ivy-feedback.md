# ivy feedback — 反馈分析

## 功能介绍

`ivy feedback` 分析运行时信号统计和规则使用洞察，帮助了解工作流中规则的实际触发情况。

### 子命令

| 子命令 | 说明 |
|--------|------|
| `feedback stats` | 运行时信号统计（默认） |
| `feedback history` | 历史信号记录 |
| `feedback cleanup` | 清理过期信号数据 |

## 操作步骤

### 查看统计

```bash
ivy feedback
ivy feedback stats
```

### 指定分析窗口

```bash
ivy feedback stats --days 30
```

### JSON 输出

```bash
ivy feedback --format json
```

### 查看历史

```bash
ivy feedback history
ivy feedback history --days 60
```

### 清理数据

```bash
ivy feedback cleanup
```

## 使用案例

### 案例 1：了解规则触发频率

```bash
ivy feedback stats
# 查看哪些规则最常被触发
```

### 案例 2：月度报告

```bash
ivy feedback stats --days 30 --format json > feedback-monthly.json
```

### 案例 3：清理旧数据

```bash
ivy feedback cleanup
```

## 相关命令

- `ivy rules audit` — 规则审计
- `ivy analytics` — 采纳率分析

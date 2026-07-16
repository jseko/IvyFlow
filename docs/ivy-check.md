# ivy check — CI 健康检查

## 功能介绍

`ivy check` 是面向 CI 环境的工作流健康检查命令。非阻塞式执行，支持多种输出格式和退出码策略。

### 执行模式

| 模式 | 说明 |
|------|------|
| `quick` | 快速检查，仅核心指标 |
| `standard` | 标准检查（默认） |
| `full` | 全面检查，含深度分析 |

### 输出格式

| 格式 | 说明 |
|------|------|
| `cli` | 终端友好格式（默认） |
| `markdown` | Markdown 报告 |
| `json` | JSON 格式 |

## 操作步骤

### 基本检查

```bash
ivy check
```

### 指定 Change

```bash
ivy check --change add-user-auth
```

### 快速模式

```bash
ivy check --mode quick
```

### 全面模式

```bash
ivy check --mode full
```

### Markdown 输出

```bash
ivy check --output markdown > check-report.md
```

### JSON 输出

```bash
ivy check --output json
```

### 环境检测

```bash
ivy check --env
```

### 退出码策略

```bash
# 遇到关键卡住时退出码非零
ivy check --exit-code --fail-on stuck_critical

# 遇到任何关键问题时退出码非零
ivy check --exit-code --fail-on any_critical
```

## 使用案例

### 案例 1：GitHub Actions 集成

```yaml
- name: IvyFlow Health Check
  run: ivy check --mode quick --output markdown >> $GITHUB_STEP_SUMMARY
```

### 案例 2：CI 阻断检查

```bash
ivy check --exit-code --fail-on stuck_critical
# 卡住时返回非零退出码，阻断 CI
```

### 案例 3：生成团队报告

```bash
ivy check --mode full --output markdown > weekly-health.md
```

## 相关命令

- `ivy suggest` — 工作流建议
- `ivy doctor` — 健康检查

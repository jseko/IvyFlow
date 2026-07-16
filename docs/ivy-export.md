# ivy export — 数据导出

## 功能介绍

`ivy export` 将项目数据导出为标准 JSON 格式。纯只读操作，支持按维度筛选导出。

### 导出维度

| 维度 | 说明 |
|------|------|
| `changes` | 变更列表和阶段历史 |
| `metrics` | 指标数据 |
| `knowledge` | 知识记录 |
| `workflow-evidence` | 工作流证据 |

## 操作步骤

### 完整导出

```bash
ivy export
```

### 管道输出

```bash
ivy export --pipe
```

### 按维度导出

```bash
ivy export --dimension changes
ivy export --dimension metrics
ivy export --dimension knowledge
ivy export --dimension workflow-evidence
```

### 包含额外项目

```bash
ivy export --project /path/to/other-project
```

## 使用案例

### 案例 1：数据备份

```bash
ivy export --pipe > ivyflow-backup.json
```

### 案例 2：BI 分析

```bash
ivy export --dimension metrics --pipe | jq '.metrics'
```

### 案例 3：跨项目聚合

```bash
ivy export --project ~/proj-a ~/proj-b --pipe > multi-project.json
```

## 相关命令

- `ivy analytics` — 采纳率分析
- `ivy dashboard` — 仪表盘

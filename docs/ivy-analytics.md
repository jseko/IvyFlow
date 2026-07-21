# ivy analytics — 采纳率分析

> 版本：v0.32 | 基于 Phase 0+1+2A+2B 实际交付

## 功能介绍

`ivy analytics` 展示 AI 代码采纳率指标，支持双数据源（sessions 和 provenance），覆盖从代码生成到工程价值的完整链路。所有指标标注置信度。

### 数据源

| 数据源 | flag | 说明 |
|--------|------|------|
| Sessions（默认） | — | 基于 git commits + phase transitions |
| Provenance | `--provenance` | 基于 Phase 0 Origin Entity + Event Store |

### 指标矩阵

| 指标 | 阶段 | flag | 说明 |
|------|:--:|------|------|
| Adoption Funnel | Phase 1+2A | 默认 | 提交数、变更数、完成率 |
| Retention Ratio | Phase 1+2A | `--provenance` | AI 代码在 N 次 commit 后的存活率 |
| Rework Cost | Phase 1+2A | `--provenance` | AI 代码被人工修改的比例 |
| Abandonment Rate | Phase 1+2A | `--provenance` | AI 代码废弃率（8 类原因） |
| Failure Intelligence | Phase 1+2A | `--provenance` | 按阶段失败分布 + Top 3 模式 |
| Code Lineage L1-L3 | Phase 1+2A | `--provenance` | 文件/AST/语义三级血缘追踪 |
| **Value Index** | Phase 2B | `--value` | 工程价值指数（Retention × Quality × Business Impact） |
| **Context Intelligence** | Phase 2B | `--csi` | 上下文充分性指数 + Outcome Correlation |
| **Feedback Loop** | Phase 2B | `--feedback` | 隐式反馈推断（kept/modified/deleted/rejected） |

## 操作步骤

### 基本采纳率

```bash
ivy analytics
```

### 项目级汇总

```bash
ivy analytics --project
```

### Provenance 数据源

```bash
# 使用 Phase 0 provenance 数据
ivy analytics --project --provenance
```

### 指定时间窗口

```bash
ivy analytics --project --period 30d
ivy analytics --project --period 90d
```

### 查看特定 Change

```bash
ivy analytics --change add-user-auth
```

### 置信度详情

```bash
ivy analytics --project --confidence
```

### JSON 输出

```bash
ivy analytics --project --json
```

### 演示模式

```bash
ivy analytics --demo
```

### 趋势分析

```bash
ivy analytics --trend
```

### 数据溯源

```bash
ivy analytics --project --explain
```

### Phase 2B 工程价值指标

```bash
# Value Index
ivy analytics --provenance --value

# Context Intelligence
ivy analytics --provenance --csi

# Feedback Loop
ivy analytics --provenance --feedback

# 组合指标 + JSON 输出
ivy analytics --provenance --value --csi --feedback --json
```

### 开关控制

```bash
# 启用采纳率追踪
ivy analytics --enable

# 禁用采纳率追踪
ivy analytics --disable
```

## 使用案例

### 案例 1：查看本周 AI 贡献

```bash
ivy analytics --project --period 7d
# AI contributed ~1,200 lines
```

### 案例 2：月度团队报告

```bash
ivy analytics --project --period 30d --json > monthly-report.json
```

### 案例 3：AI 工程价值评估

```bash
ivy analytics --provenance --value --csi --feedback --json > ai-value.json
# 包含 Value Index、CSI、Feedback Loop 完整数据
```

### 案例 4：演示和评估

```bash
# 先用演示数据了解功能
ivy analytics --demo --confidence
```

### 案例 5：CI 中检查采纳率

```bash
ivy analytics --project --json | jq '.adoption_rate'
```

## 相关命令

- `ivy dashboard` — 仪表盘
- `ivy status` — 状态查询
- `ivy export` — 数据导出

# ivy analytics — 采纳率分析

## 功能介绍

`ivy analytics` 展示 AI 代码采纳率指标，采用四层归因模型，每层标注置信度。提供透明、可量化的 AI 贡献数据。

### 四层归因模型

| 层级 | 数据源 | 置信度 | 说明 |
|------|--------|--------|------|
| **L1 会话边界** | 会话开始/结束的 git diff | >90% | 最可靠 |
| **L2 Git Notes** | 基于注解的行级归因 | 70-85% | 较可靠 |
| **L3 文件估算** | 基于会话覆盖率的文件级估算 | 60-80% | 参考值 |
| **L4 代码特征** | 模式识别 | <60% | 仅参考，不纳入统计 |

### 核心能力

- 项目级和变更级采纳率统计
- 多时间窗口（7 天 / 30 天 / 90 天）
- 置信度透明标注
- 演示数据模式
- 趋势分析
- 数据溯源

## 操作步骤

### 基本采纳率

```bash
ivy analytics
```

### 项目级汇总

```bash
ivy analytics --project
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
# AI contributed ~1,200 lines (L1: 85%, L2: 10%, L3: 5%)
```

### 案例 2：月度团队报告

```bash
ivy analytics --project --period 30d --json > monthly-report.json
```

### 案例 3：演示和评估

```bash
# 先用演示数据了解功能
ivy analytics --demo --confidence
```

### 案例 4：CI 中检查采纳率

```bash
ivy analytics --project --json | jq '.adoption_rate'
```

## 相关命令

- `ivy dashboard` — 仪表盘
- `ivy status` — 状态查询
- `ivy export` — 数据导出

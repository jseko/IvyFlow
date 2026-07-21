# ivy dashboard — 交互式仪表盘

> 版本：v0.32 | 基于 Phase 0+1+2A+2B 实际交付

## 功能介绍

`ivy dashboard` 提供 ASCII 交互式仪表盘（终端）和静态 HTML 报告（浏览器），集中展示工作流洞察、AI 代码采纳率、工程价值指标等。支持多格式输出、自动刷新和多维度视图。

### 输出格式

| 格式 | flag | 说明 |
|------|------|------|
| 终端 ASCII | 默认 | 纯文本终端输出，零依赖 |
| HTML | `--format html` 或 `--html` | 单文件 HTML，浏览器直接打开 |

### 视图类型

| 视图 | flag | 说明 |
|------|------|------|
| 默认视图 | — | 工作流概览（sessions 数据源） |
| 质量面板 | `--quality` | 建议质量面板 |
| 团队视图 | `--team` | 团队级概览（跨 Change 聚合） |
| ADR 索引 | `--adr` | ADR 索引（决策记忆视图） |
| 记忆概览 | `--memory` | 记忆概览和类型计数 |
| 知识图谱 | `--knowledge` | 知识图谱概览 |
| 组织洞察 | `--org` | 组织洞察（跨项目聚合） |
| **Phase 2B 面板** | | |
| Value Index | `--value` | AI 工程价值指数面板 |
| Context Intelligence | `--csi` | 上下文充分性指数面板 |
| Feedback Loop | `--feedback` | 隐式反馈推断面板 |

## 操作步骤

### 基本仪表盘

```bash
ivy dashboard
```

### 输出格式

```bash
# 终端 ASCII（默认）
ivy dashboard --format terminal

# HTML 报告（--html 为 alias）
ivy dashboard --format html
ivy dashboard --html

# 指定 HTML 输出路径
ivy dashboard --format html --output ./reports/dashboard.html
```

### 自动刷新

```bash
ivy dashboard --watch
# 每 30 秒自动刷新
```

### 指定时间窗口

```bash
ivy dashboard --period 30d
ivy dashboard --period 90d
```

### 质量面板

```bash
ivy dashboard --quality
```

### 团队视图

```bash
ivy dashboard --team
```

### ADR 索引

```bash
ivy dashboard --adr
```

### 记忆概览

```bash
ivy dashboard --memory
```

### 知识图谱

```bash
ivy dashboard --knowledge
```

### 组织洞察

```bash
ivy dashboard --org /path/to/project-a /path/to/project-b
ivy dashboard --org /path/to/project --metrics changes,adoption
ivy dashboard --org /path/to/project --format json
```

### 演示模式

```bash
ivy dashboard --demo
```

### Phase 2B 工程价值面板

```bash
# Value Index 面板
ivy dashboard --value

# Context Intelligence 面板
ivy dashboard --csi

# Feedback Loop 面板
ivy dashboard --feedback

# 组合面板 + HTML 输出
ivy dashboard --value --csi --feedback --format html --output report.html
```

## 使用案例

### 案例 1：日常开发仪表盘

```bash
ivy dashboard
# 查看当前 Change 进度、采纳率、守卫状态
```

### 案例 2：团队周会报告

```bash
ivy dashboard --team --period 7d --format html --output weekly-report.html
```

### 案例 3：AI 工程价值评估

```bash
ivy dashboard --value --csi --feedback --format html --output ai-value-report.html
# 包含 Value Index、CSI、Feedback Loop 三个面板
```

### 案例 4：监控多项目

```bash
ivy dashboard --watch --org ~/project-a ~/project-b
```

### 案例 5：决策回顾

```bash
ivy dashboard --adr
# 查看所有架构决策记录
```

## 相关命令

- `ivy analytics` — 采纳率分析
- `ivy status` — 状态查询
- `ivy export` — 数据导出

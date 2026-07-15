# ivy dashboard — 交互式仪表盘

## 功能介绍

`ivy dashboard` 提供 ASCII 交互式仪表盘，集中展示工作流洞察、采纳率、质量指标等。支持 HTML 导出、自动刷新和多维度视图。

### 视图类型

| 视图 | 说明 |
|------|------|
| 默认视图 | 工作流概览和采纳率 |
| `--quality` | 建议质量面板 |
| `--team` | 团队级概览（跨 Change 聚合） |
| `--adr` | ADR 索引（决策记忆视图） |
| `--memory` | 记忆概览和类型计数 |
| `--knowledge` | 知识图谱概览 |
| `--org` | 组织洞察（跨项目聚合） |

## 操作步骤

### 基本仪表盘

```bash
ivy dashboard
```

### 自动刷新

```bash
ivy dashboard --watch
# 每 30 秒自动刷新
```

### HTML 导出

```bash
ivy dashboard --html
```

### 指定时间窗口

```bash
ivy dashboard --period 30d
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

## 使用案例

### 案例 1：日常开发仪表盘

```bash
ivy dashboard
# 查看当前 Change 进度、采纳率、守卫状态
```

### 案例 2：团队周会报告

```bash
ivy dashboard --team --period 7d --html > weekly-report.html
```

### 案例 3：监控多项目

```bash
ivy dashboard --watch --org ~/project-a ~/project-b
```

### 案例 4：决策回顾

```bash
ivy dashboard --adr
# 查看所有架构决策记录
```

## 相关命令

- `ivy analytics` — 采纳率分析
- `ivy status` — 状态查询
- `ivy export` — 数据导出

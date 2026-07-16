# ivy pipeline — 多角色流水线

## 功能介绍

`ivy pipeline` 编排多角色协作流水线（PM → Developer → QA → DevOps），支持 DAG 阶段图、条件分支和自动角色切换。

### 流水线阶段

```
PM (需求收集 → 分析 → PRD → 审查 → 验收)
  ↓
Developer (开发 → 构建 → 验证 → 归档)
  ↓
QA (用例设计 → 执行 → Bug跟踪 → 报告 → 回归)
  ↓
DevOps (环境 → CI/CD → 部署 → 监控 → 告警)
```

## 操作步骤

### 创建流水线

```bash
ivy pipeline start my-feature
```

### 查看状态

```bash
ivy pipeline status
```

### 完成阶段

```bash
ivy pipeline complete pm-analyze
```

### 条件分支选择

```bash
ivy pipeline complete qa-test --choice all_pass
ivy pipeline complete qa-test --choice bugs_found
```

### 阻塞阶段

```bash
ivy pipeline block dev-build --reason "Waiting for API key"
```

### 重试阶段

```bash
ivy pipeline retry qa-test
```

## 使用案例

### 案例 1：启动完整功能流水线

```bash
ivy pipeline start user-dashboard
ivy pipeline status
# 查看当前阶段和下一步
```

### 案例 2：逐步推进流水线

```bash
ivy pipeline complete pm-collect
ivy pipeline complete pm-analyze
ivy pipeline complete pm-prd
ivy pipeline complete pm-review
ivy pipeline complete pm-accept
# PM 阶段完成，自动切换到 Developer 角色
```

### 案例 3：处理阻塞

```bash
ivy pipeline block devops-deploy --reason "Waiting for production approval"
# 稍后重试
ivy pipeline retry devops-deploy
```

## 相关命令

- `ivy role` — 角色管理
- `ivy workflow` — 工作流管理

# ivy verify — 质量门禁

## 功能介绍

`ivy verify` 对指定 Change 运行质量门禁，生成结构化证据报告。支持编译检查、测试运行、任务完成检查、覆盖率检查和证据覆盖检查。

### 质量门禁类型

| 门禁 | 说明 |
|------|------|
| `compile` | 编译/类型检查 |
| `test` | 运行测试套件 |
| `tasks` | 检查 tasks.md 中任务是否全部完成 |
| `coverage` | 测试覆盖率检查（可配置最低阈值） |
| `evidence` | 证据覆盖率检查（可配置最低阈值） |

## 操作步骤

### 运行所有门禁

```bash
ivy verify --change add-user-auth
```

### 指定单个门禁

```bash
ivy verify --change add-user-auth --gate compile
ivy verify --change add-user-auth --gate test
ivy verify --change add-user-auth --gate tasks
```

### 跳过门禁

```bash
ivy verify --change add-user-auth --skip coverage
```

### 证据覆盖率

```bash
# 设置最低证据覆盖率 70%
ivy verify --change add-user-auth --gate evidence --min-evidence 70
```

## 输出产物

验证通过后在 `.ivy/evidence/<change-name>.yaml` 生成证据报告：

```yaml
changeName: add-user-auth
results:
  - gate: compile
    passed: true
    skipped: false
    durationMs: 1234
  - gate: test
    passed: true
    skipped: false
    durationMs: 5678
passedCount: 2
failedCount: 0
skippedCount: 0
overall: passed
timestamp: "2026-07-15T10:30:00Z"
writtenTo: .ivy/evidence/add-user-auth.yaml
```

## 使用案例

### 案例 1：BUILD 完成后运行全部门禁

```bash
ivy verify --change add-user-auth
# 所有门禁通过后进入 VERIFY 阶段
```

### 案例 2：CI 流水线中只跑编译和测试

```bash
ivy verify --change add-user-auth --gate compile
ivy verify --change add-user-auth --gate test
```

### 案例 3：快速检查证据覆盖

```bash
ivy verify --change add-user-auth --gate evidence --min-evidence 50
```

## 相关命令

- `ivy archive` — 归档 Change
- `ivy audit` — 证据审计
- `ivy state set verify` — 进入 VERIFY 阶段

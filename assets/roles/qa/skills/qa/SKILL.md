---
name: qa-dispatcher
description: QA 工作流调度器 — 根据当前阶段路由到对应阶段技能
---

# QA 工作流调度器

## 阶段路由

| 当前阶段 | 技能 | 描述 |
|---------|------|------|
| testcase | qa-testcase | 用例设计 |
| execute | qa-execute | 测试执行 |
| bug | qa-bug | 缺陷跟踪 |
| report | qa-report | 测试报告 |
| regression | qa-regression | 回归验证 |

## 工作流链

```
testcase → execute → bug → report → regression
```

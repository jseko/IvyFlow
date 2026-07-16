QA 工作流调度器 — 根据当前阶段路由到对应阶段技能。

## 用法

```
/qaflow "测试用户登录模块"
```

## 工作流阶段

| 阶段 | 技能 | 描述 |
|------|------|------|
| testcase | qa-testcase | 用例设计 |
| execute | qa-execute | 测试执行 |
| bug | qa-bug | 缺陷跟踪 |
| report | qa-report | 测试报告 |
| regression | qa-regression | 回归验证 |

## 相关命令

- `/qaflow-bug` — 快速提交 Bug
- `/qaflow-report` — 生成测试报告

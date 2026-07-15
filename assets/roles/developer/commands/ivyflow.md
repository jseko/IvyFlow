IvyFlow 工作流调度器 — 根据当前阶段路由到对应阶段技能。

## 用法

```
/ivyflow "实现用户登录功能"
/ivyflow "修复登录页面的报错"
```

## 工作流阶段

IvyFlow 自动检测当前阶段并路由：

| 阶段 | 技能 | 描述 |
|------|------|------|
| open | ivy-open | 创建变更结构（proposal → design → tasks） |
| design | ivy-design | 深度设计（brainstorming → 设计文档） |
| build | ivy-build | 实现代码（TDD → 编码 → 审查） |
| verify | ivy-verify | 质量门控（编译 → 测试 → 覆盖率） |
| archive | ivy-archive | 归档变更 + 知识提取 |

## 相关命令

- `/ivyflow-status` — 查看当前任务状态
- `/ivyflow-quick` — 快速修复（跳过 brainstorming 和 plan）

PM 工作流调度器 — 根据当前阶段路由到对应阶段技能。

## 用法

```
/pmflow "分析用户反馈中的登录问题"
/pmflow "设计用户权限管理系统"
```

## 工作流阶段

| 阶段 | 技能 | 描述 |
|------|------|------|
| collect | pm-collect | 需求收集 |
| analyze | pm-analyze | 需求分析（竞品/用户故事/优先级） |
| prd | pm-prd | PRD 撰写 |
| review | pm-review | 评审 + 验收用例 |
| accept | pm-accept | 验收 |

## 相关命令

- `/pmflow-prd` — 快速生成 PRD
- `/pmflow-review` — 启动需求评审

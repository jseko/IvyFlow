---
name: pm-dispatcher
description: PM 工作流调度器 — 根据当前阶段路由到对应阶段技能
---

# PM 工作流调度器

## 阶段检测

```bash
ivy state show
```

## 阶段路由

| 当前阶段 | 技能 | 描述 |
|---------|------|------|
| collect | pm-collect | 需求收集 |
| analyze | pm-analyze | 需求分析 |
| prd | pm-prd | PRD 撰写 |
| review | pm-review | 评审 |
| accept | pm-accept | 验收 |

## 工作流链

```
collect → analyze → prd → review → accept
```

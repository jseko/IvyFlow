---
name: devops-dispatcher
description: DevOps 工作流调度器
---

# DevOps 工作流调度器

## 阶段路由

| 当前阶段 | 技能 | 描述 |
|---------|------|------|
| env | devops-env | 环境规划 |
| cicd | devops-cicd | CI/CD 搭建 |
| deploy | devops-deploy | 部署 |
| monitor | devops-monitor | 监控 |
| alert | devops-alert | 告警 |

## 工作流链

```
env → cicd → deploy → monitor → alert
```

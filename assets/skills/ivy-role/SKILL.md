---
name: ivy-role
description: IvyFlow 角色调度器 — 读取 project.yaml 确定当前角色并路由到对应 skill
---

# IvyFlow 角色调度器

读取 `.ivy/project.yaml` 中的 `role` 字段确定当前角色，路由到对应角色的工作流。

## 角色检测

```bash
cat .ivy/project.yaml | grep "role:"
```

## 角色路由

| role | 入口 Skill | 工作流 |
|------|-----------|--------|
| `developer` | `ivy/SKILL.md` | open → design → build → verify → archive |
| `pm` | `pm/SKILL.md` | collect → analyze → prd → review → accept |
| `qa` | `qa/SKILL.md` | testcase → execute → bug → report → regression |
| `architect` | `architect/SKILL.md` | research → design → review → guide |
| `devops` | `devops/SKILL.md` | env → cicd → deploy → monitor → alert |

## 命令映射

| 命令 | 角色 | 说明 |
|------|------|------|
| `/ivyflow` | developer | 启动开发工作流 |
| `/ivyflow-quick` | developer | 快速修复 |
| `/ivyflow-hotfix` | developer | Bug 修复 |
| `/ivyflow-tweak` | developer | 小改动 |
| `/ivyflow-status` | developer | 查看状态 |
| `/pmflow` | pm | 启动产品工作流 |
| `/pmflow-prd` | pm | 快速 PRD |
| `/pmflow-review` | pm | 需求评审 |
| `/qaflow` | qa | 启动测试工作流 |
| `/qaflow-bug` | qa | 快速 Bug |
| `/qaflow-report` | qa | 测试报告 |
| `/archflow` | architect | 启动架构工作流 |
| `/archflow-research` | architect | 技术调研 |
| `/archflow-review` | architect | 架构评审 |
| `/devopsflow` | devops | 启动 DevOps 工作流 |
| `/devopsflow-deploy` | devops | 快速部署 |
| `/devopsflow-monitor` | devops | 监控状态 |

## 切换角色

```bash
ivy role set pm       # 切换到产品经理
ivy role show         # 查看当前角色
ivy role list         # 列出所有可用角色
```

## 默认角色

如果 `.ivy/project.yaml` 中没有 `role` 字段，默认使用 `developer` 角色。

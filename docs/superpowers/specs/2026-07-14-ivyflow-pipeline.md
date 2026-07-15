# IvyFlow Pipeline 系统实施设计

> 日期：2026-07-14 | 状态：待实施 | 版本：v1.0
> 基于：docs/ivyflow-multi-agent-pipeline-design.md (v2)

---

## 一、设计目标

让 5 个角色通过 Pipeline 协作起来。Pipeline 编排跨角色的 Stage，每个 Stage 内部由 Workflow 管理单角色的 Phase。Edges 从 role.yaml 推导，条件分支由用户手动判定。`ivy pipeline complete` 自动切换 project.yaml 的 role 字段，Claude Code 重启后即可继续下一阶段。

---

## 二、架构

```
Pipeline（跨角色编排）
  ├── Stage: requirements (role: pm)
  │     └── Workflow: collect → analyze → prd → review → accept
  ├── Stage: coding (role: developer)
  │     └── Workflow: open → design → build → verify → archive
  ├── Stage: testing (role: qa)
  │     └── Workflow: testcase → execute → bug → report → regression
  └── Stage: deployment (role: devops)
        └── Workflow: env → cicd → deploy → monitor → alert

Edges（从 role.yaml pipeline_downstream 推导）
  requirements → coding
  coding → testing
  testing → coding (condition: bugs_found)
  testing → deployment (condition: all_pass)
```

---

## 三、数据模型

### 3.1 role.yaml 新增字段

```yaml
# assets/roles/developer/role.yaml
pipeline_downstream:
  - role: qa
    stage: testing

# assets/roles/qa/role.yaml
pipeline_downstream:
  - role: developer
    stage: coding
    condition: bugs_found
  - role: devops
    stage: deployment
    condition: all_pass
```

### 3.2 pipeline.yaml

```yaml
# .ivy/runtime/pipeline.yaml
id: user-auth
name: "用户登录功能"
created_at: 2026-07-14T10:00:00Z
stages:
  - id: requirements
    role: pm
    status: completed
    started_at: 2026-07-14T10:00:00Z
    completed_at: 2026-07-14T12:00:00Z
  - id: coding
    role: developer
    status: in_progress
    started_at: 2026-07-14T12:30:00Z
  - id: testing
    role: qa
    status: pending
  - id: deployment
    role: devops
    status: pending

edges:
  - from: requirements
    to: coding
  - from: coding
    to: testing
  - from: testing
    to: coding
    condition: bugs_found
  - from: testing
    to: deployment
    condition: all_pass
```

---

## 四、命令设计

### 命令列表

```bash
ivy pipeline start <name>        # 创建流水线
ivy pipeline status              # 查看状态
ivy pipeline complete --stage <id>  # 标记完成（触发分支选择）
ivy pipeline block --stage <id> --reason <text>  # 标记阻塞
ivy pipeline retry --stage <id>  # 回退重试
```

### 交互流程

```
$ ivy pipeline start "用户登录功能"
📋 Pipeline 已创建: user-auth
   阶段: requirements → coding → testing → deployment
   当前角色: pm（使用 /pmflow 开始需求分析）

$ ivy pipeline complete --stage requirements
? requirements 已完成，下一步:
❯ coding (Developer 编码)
  跳过 coding (直接 testing)

$ ivy pipeline complete --stage coding
? coding 已完成，下一步:
❯ testing (QA 测试)
  跳过 testing (直接 deployment)

$ ivy pipeline complete --stage testing
? 测试结果:
❯ 全部通过 → deployment
  有 Bug → 回退 coding

$ ivy pipeline status
📋 requirements  ✅ completed (PM)
💻 coding        ✅ completed (Developer)
🧪 testing       ✅ completed (QA)
🚀 deployment    🔄 in_progress (DevOps)
```

### Claude Code 集成

`ivy pipeline complete` 自动更新 `project.yaml` 的 `role` 字段为下一 stage 的角色。Claude Code 重启后 `ivy-role/SKILL.md` 读取新角色，用户输入对应命令即可继续。

---

## 五、文件变更

### 新增文件

| 文件 | 内容 |
|------|------|
| `src/commands/pipeline.ts` | pipeline 命令实现 |
| `src/core/pipeline.ts` | pipeline 状态管理（读/写 pipeline.yaml，推导 edges） |

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/cli/index.ts` | 注册 `pipeline` 命令 |
| `src/core/role-registry.ts` | RoleConfig 新增 `pipeline_downstream` 字段 |
| `assets/roles/*/role.yaml` | 5 个角色新增 `pipeline_downstream` |

---

## 六、实施计划

| 阶段 | 内容 | 工作量 |
|------|------|--------|
| M1 | `src/core/pipeline.ts` — 读写 pipeline.yaml，推导 edges | 1 天 |
| M2 | `src/commands/pipeline.ts` — start/status/complete/block/retry | 1 天 |
| M3 | role.yaml 新增 pipeline_downstream（5 个角色） | 0.5 天 |
| M4 | CLI 注册 + role 自动切换 | 0.5 天 |
| M5 | 测试 | 0.5 天 |

**总计**：约 3.5 天。

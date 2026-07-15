# IvyFlow 多 Agent 团队协作设计方案 v2

> 日期：2026-07-14 | 版本：v2.0
> 参考：OpenSwarm + 架构评审

---

## 一、设计定位

IvyFlow 的角色系统已经实现了 5 个角色的独立工作流。本方案的目标是**让角色之间可以协作**，而非引入新的 Agent 编排引擎。

**核心原则**：不重复发明轮子。复用现有的 role / workflow / worktree / topology / guard，不做 pipeline role、pipeline dispatch 等冗余抽象。

---

## 二、核心设计：DAG 阶段图

### 2.1 从线性到 DAG

v1 的线性流水线：
```
PM → Architect → Developer → QA → DevOps
```

v2 的 DAG 阶段图：
```
        PM (PRD)
           │
    ┌──────┴──────┐
    ▼             ▼
Architect      Developer
(架构设计)    (直接开发，小需求)
    │             │
    └──────┬──────┘
           ▼
          QA
           │
      ┌────┴────┐
      ▼         ▼
   DevOps     Developer
  (部署)     (修复Bug)
```

### 2.2 阶段状态

每个阶段支持以下状态：

| 状态 | 含义 | 触发 |
|------|------|------|
| `pending` | 等待开始 | 上游阶段完成 |
| `in_progress` | 执行中 | 角色开始工作 |
| `completed` | 已完成 | 产出物就绪 |
| `blocked` | 被阻塞 | 需要上游变更/澄清 |
| `failed` | 失败 | 质量门控未通过 |
| `skipped` | 跳过 | 不需要此阶段 |

### 2.3 回退与重试

```
QA 发现 Bug
  ↓
Developer (failed → in_progress)  ← 回退到 Developer 修复
  ↓
QA (pending → in_progress)        ← 重新测试
```

---

## 三、Runtime 状态分离

### 3.1 配置 vs 运行时

```
.ivy/
├── project.yaml           # 静态配置（role, language, capabilities）
└── runtime/
    └── pipeline.yaml      # 动态运行时（阶段状态、产物引用）
```

### 3.2 pipeline.yaml

```yaml
# .ivy/runtime/pipeline.yaml
id: user-auth
stages:
  - id: requirements
    role: pm
    status: completed
    artifact: docs/prd/user-auth.md
    started_at: 2026-07-14T10:00:00Z
    completed_at: 2026-07-14T12:00:00Z

  - id: architecture
    role: architect
    status: skipped
    reason: small_change

  - id: coding
    role: developer
    status: in_progress
    worktree: /tmp/ivyflow-wt-user-auth
    started_at: 2026-07-14T12:30:00Z

  - id: testing
    role: qa
    status: pending
    depends_on: [coding]

  - id: deployment
    role: devops
    status: pending
    depends_on: [testing]

edges:
  - from: requirements
    to: architecture
    condition: needs_architecture
  - from: requirements
    to: coding
    condition: small_change
  - from: architecture
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

## 四、命令

```bash
# 创建流水线
ivy pipeline start "用户登录功能"

# 查看状态（带阶段图）
ivy pipeline status
# 输出：
#   📋 requirements  ✅ completed  (PM)
#   🏗️ architecture  ⏭ skipped
#   💻 coding        🔄 in_progress (Developer)
#   🧪 testing       ⏳ pending     (QA)
#   🚀 deployment    ⏳ pending     (DevOps)

# 标记阶段完成
ivy pipeline complete --stage coding

# 标记阶段阻塞
ivy pipeline block --stage coding --reason "等待架构澄清"

# 回退阶段
ivy pipeline retry --stage coding
```

---

## 五、实施计划

| 阶段 | 内容 | 工作量 |
|------|------|--------|
| M1 | `ivy pipeline start/status/complete` 命令 | 1 天 |
| M2 | pipeline.yaml 读写 + DAG 阶段图 | 1 天 |
| M3 | blocked/failed/skipped 状态支持 | 0.5 天 |
| M4 | 回退/重试（edges 中的 condition） | 0.5 天 |
| M5 | 测试 | 0.5 天 |

**总计**：约 3.5 天。

---

## 六、后续迭代（不阻塞 MVP）

| 优先级 | 能力 | 说明 |
|--------|------|------|
| P1 | EventBus 驱动 | 替代手动 `pipeline status` 轮询 |
| P1 | Artifact Registry | 统一管理阶段产物 |
| P2 | Agent Feedback/Reject | Developer 向 Architect 发起设计澄清 |
| P2 | Coordinator Runtime | 自动调度和冲突检测 |
| P3 | Supervisor Agent | 多 Developer 并行时的任务分配 |

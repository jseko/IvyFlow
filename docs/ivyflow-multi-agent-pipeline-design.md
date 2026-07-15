# IvyFlow 多 Agent 团队协作设计方案

> 日期：2026-07-14 | 版本：v1.0
> 参考：OpenSwarm 多 Agent 团队实践 + IvyFlow 角色系统 v3.3

---

## 一、OpenSwarm 可借鉴内容评估

### 直接可借鉴

| OpenSwarm 特性 | IvyFlow 现状 | 借鉴方式 |
|---------------|-------------|---------|
| **Worker → Reviewer → Test 流水线** | Developer + QA 角色已定义 | 将 Developer 的 build 阶段和 QA 的 execute 阶段串联为自动化流水线 |
| **Git Worktree 隔离并行** | `ivy worktree` + `dispatch` 已有 | 激活现有基础设施，每个角色 Agent 分配独立 Worktree |
| **Issue → PR 自动闭环** | 无 | 新增 Issue 触发机制，PM 创建 Issue → Developer 自动编码 → QA 自动测试 |
| **角色间通信协议** | topology 字段已定义 | 用 topology 控制角色间协作模式（serial/parallel/supervisor） |

### 暂不借鉴

| OpenSwarm 特性 | 理由 |
|---------------|------|
| Linear Issue 集成 | 需要第三方服务依赖，MVP 阶段用 `/pmflow` 命令替代 |
| Discord 指令通道 | IvyFlow 用 Claude Code 斜杠命令即可 |
| LanceDB 长期记忆 | IvyFlow 已有 Memory 系统 |

---

## 二、核心设计：角色流水线

### 2.1 完整流水线

```
PM 创建需求 → Architect 设计架构 → Developer 编码 → QA 测试 → DevOps 部署
     │               │                   │              │            │
   Issue        架构设计文档           PR + 代码      测试报告     部署上线
```

### 2.2 流水线阶段

| 阶段 | 角色 | 触发条件 | 产出 | 下游 |
|------|------|---------|------|------|
| 1. 需求 | PM | 用户 `/pmflow` | PRD 文档 | Architect |
| 2. 设计 | Architect | PRD 完成 | 架构设计文档 | Developer |
| 3. 编码 | Developer | 架构设计完成 | PR + 代码 | QA |
| 4. 测试 | QA | PR 创建 | 测试报告 | DevOps |
| 5. 部署 | DevOps | 测试通过 | 部署上线 | — |

### 2.3 对标 OpenSwarm

```
OpenSwarm:           Issue → Worker → Reviewer → Test → PR Merge
IvyFlow:    PM(Issue) → Developer(Worker) → QA(Reviewer+Test) → DevOps(Deploy)
```

IvyFlow 的优势：
- **PM 角色**：OpenSwarm 没有需求分析环节
- **Architect 角色**：OpenSwarm 没有架构设计环节
- **QA 角色**：合并了 Reviewer + Test，一人双责
- **DevOps 角色**：OpenSwarm 没有部署环节

---

## 三、Worktree 隔离并行

### 3.1 并行模式

```
                    ┌─ Worktree-A: Developer (Change A)
PM (主 Worktree) ──┼─ Worktree-B: Developer (Change B)
                    └─ Worktree-C: QA (Review All)
```

### 3.2 topology 配置

```yaml
# .ivy/project.yaml
role: developer
default_topology: parallel
topology_config:
  developer:
    mode: parallel          # 多个 Developer 并行编码
    max_workers: 3
  qa:
    mode: supervisor        # QA 审查所有 Developer 的 PR
  devops:
    mode: serial            # 部署必须串行
```

### 3.3 Worktree 生命周期

```bash
# PM 创建需求后，自动为 Developer 创建 worktree
ivy workflow start <change-name> --preset full --isolate

# Developer 在自己的 worktree 中编码
cd /tmp/ivyflow-worktree-<change-name>
/ivyflow "实现用户登录功能"

# QA 在主 worktree 中审查所有 PR
/qaflow "审查 PR #42"

# 完成后清理
ivy worktree cleanup <change-name>
```

---

## 四、角色间通信协议

### 4.1 状态传递

每个角色完成阶段后，通过 `.ivy/project.yaml` 传递状态：

```yaml
pipeline:
  current_stage: build
  stages:
    requirements:
      status: completed
      artifact: docs/prd/user-auth.md
      completed_by: pm
      completed_at: 2026-07-14T10:00:00Z
    architecture:
      status: completed
      artifact: docs/architecture/design/auth-system.md
      completed_by: architect
      completed_at: 2026-07-14T12:00:00Z
    coding:
      status: in_progress
      assigned_to: developer
    testing:
      status: pending
    deployment:
      status: pending
```

### 4.2 触发机制

| 触发条件 | 动作 |
|---------|------|
| PM 完成 PRD | 通知 Architect 开始架构设计 |
| Architect 完成设计 | 为 Developer 创建 Worktree，自动启动编码 |
| Developer 提交 PR | 自动通知 QA 开始测试 |
| QA 测试通过 | 自动通知 DevOps 开始部署 |

### 4.3 通知方式（MVP 阶段）

MVP 阶段使用文件轮询 + Claude Code 对话通知：

```bash
# Developer 提交 PR 后
ivy pipeline notify --stage coding --status completed

# QA 检测到 coding 完成
ivy pipeline status  # 查看当前流水线状态
# → coding: completed → 自动触发 QA workflow
```

---

## 五、Issue 驱动（对标 OpenSwarm Linear）

### 5.1 简化版 Issue

```bash
# PM 创建需求（自动创建 Issue 文件）
/pmflow "用户需要手机号注册登录功能"

# 产出
.ivy/pipeline/issues/
└── ISSUE-001.md    # 需求描述 + 验收标准
```

### 5.2 Issue 生命周期

```
ISSUE-001 (open)
  ↓ PM 完成 PRD
ISSUE-001 (ready-for-design)
  ↓ Architect 完成设计
ISSUE-001 (ready-for-dev)
  ↓ Developer 开始编码
ISSUE-001 (in-progress)
  ↓ Developer 提交 PR
ISSUE-001 (in-review)
  ↓ QA 测试通过
ISSUE-001 (done)
```

### 5.3 命令

```bash
ivy pipeline create "用户登录功能"     # PM 创建 Issue
ivy pipeline status                    # 查看流水线状态
ivy pipeline next                      # 触发下一阶段
ivy pipeline notify --stage <stage>    # 通知下游角色
```

---

## 六、实施计划

### 优先级

| 优先级 | 内容 | 工作量 | 依赖 |
|--------|------|--------|------|
| P0 | `ivy pipeline` 命令（create/status/next/notify） | 2 天 | 无 |
| P0 | pipeline 状态写入 project.yaml | 1 天 | 无 |
| P1 | Worktree 自动创建（`ivy workflow start --isolate`） | 1 天 | 现有 worktree 命令 |
| P1 | QA 自动触发（Developer PR → QA Review） | 2 天 | pipeline 状态 |
| P2 | 多 Developer 并行（topology: parallel） | 2 天 | Worktree 隔离 |
| P2 | Issue 文件管理 | 1 天 | pipeline 命令 |
| P3 | 自动通知（文件轮询） | 2 天 | pipeline 状态 |

**总计**：约 11 天，分 3 批交付。

---

## 七、与现有系统的集成

| 现有系统 | 集成方式 |
|---------|---------|
| `ivy role` | pipeline 阶段绑定角色 |
| `ivy workflow` | workflow start 自动创建 pipeline |
| `ivy worktree` | pipeline 阶段自动分配 Worktree |
| `ivy dispatch` | pipeline 阶段自动派发任务 |
| `ivy guard` | pipeline 阶段守卫检查 |
| `topology` 字段 | 控制角色间协作模式 |

---

## 八、MVP 最小可行版本

第一期只做核心流水线：

```
PM 创建需求 → Developer 编码 → QA 测试
```

命令：
```bash
ivy pipeline create "需求描述"     # 创建流水线
ivy pipeline status                # 查看状态
ivy pipeline next                  # 推进到下一阶段
```

暂不做：
- Worktree 自动创建（手动 `ivy workflow start --isolate` 替代）
- 自动通知（手动 `ivy pipeline status` 轮询替代）
- Architect 和 DevOps 角色集成（后续迭代）

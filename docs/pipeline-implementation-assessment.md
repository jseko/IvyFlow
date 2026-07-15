# IvyFlow 多 Agent 流水线 — 实现评估

> 评估日期：2026-07-15 | 设计参考：`specs/ivyflow-multi-agent-pipeline-design.md` (v2) + `specs/old/ivyflow-role-system-design-v3.3.md`

---

## 一、评估总览

### 1.1 多 Agent 流水线设计 (v2) 实现度：**约 85%**

| 设计模块 | 设计要求 | 实现状态 |
|----------|----------|----------|
| DAG 阶段图 | PM → Architect/Developer → QA → DevOps/Developer | ✅ 已实现 |
| 6 种阶段状态 | pending / in_progress / completed / blocked / failed / skipped | ✅ 已实现（failed/skipped 仅声明，无触发路径） |
| 条件分支 | QA → all_pass(DevOps) / bugs_found(Developer) | ✅ 已实现 |
| 回退与重试 | `pipeline block` / `pipeline retry` | ✅ 已实现 |
| Runtime 状态分离 | `.ivy/runtime/pipeline.yaml` | ✅ 已实现 |
| CLI 命令 | start / status / complete / block / retry | ✅ 已实现 |
| 自动角色切换 | 阶段完成时更新 `project.yaml` role | ✅ 已实现 |
| 后续迭代 P1 | EventBus / Artifact Registry / Agent Feedback | ❌ 未实现 |
| 后续迭代 P2 | Coordinator Runtime | ❌ 未实现 |
| 后续迭代 P3 | Supervisor Agent | ❌ 未实现 |

### 1.2 角色系统设计 (v3.3) 实现度：**约 75%**

| 设计模块 | 设计要求 | 实现状态 |
|----------|----------|----------|
| RoleRegistry 配置化 | 从 `assets/roles/*/role.yaml` 加载 | ✅ 已实现 |
| Capability → Implementation 映射 | `implementation` 字段支持 Skill/MCP/Agent/Workflow | ✅ 已声明，仅 Skill 路径实际可用 |
| Workflow transitions（状态机） | `assets/workflows/*.yaml` 定义转换 | ✅ 已声明，未接入运行时 |
| Workflow artifacts | 每个 phase 声明产出物 | ✅ 已声明，未接入运行时 |
| Role CLI | `ivy role show/list/set` | ✅ 已实现 |
| Role Dispatcher | 根据 `project.yaml` role 路由技能 | ✅ 已实现 |
| Init 角色选择 | 交互式向导选择角色 | ❌ 未实现（init 不再有角色选择） |
| Role-based 资产安装 | 按角色安装不同 skills/rules | ❌ 未实现（所有角色全部安装） |
| Session Config | `ivy session set` 覆盖能力 | ❌ 未实现 |
| Workflow Engine | 运行时驱动状态机 | ❌ 未实现（workflow YAML 仅为声明式文档） |
| Pipeline ↔ Lifecycle 集成 | 流水线与 Change 生命周期联动 | ❌ 未实现（两套独立状态机） |

### 1.3 核心架构差距

**最大差距**：`assets/workflows/*.yaml` 定义了完整的阶段状态机（transitions、forbidden_transitions、guards、artifacts），但 `src/core/pipeline.ts` 完全不读取这些文件。Pipeline 仅使用 `role.yaml` 中的 `pipeline_downstream` 构建 DAG，workflow YAML 目前是**纯声明式文档**，未接入运行时。

**次要差距**：Pipeline 状态机（`.ivy/runtime/pipeline.yaml`）与 Change 生命周期状态机（`.ivy/state.yaml`）是两套独立系统，没有互操作。例如：Pipeline 的 `coding` 阶段完成时，不会自动触发 Change 的 `verify` → `archive` 流程。

---

## 二、当前实现的 DAG 流水线

```
        PM (requirements)
              │
              ▼
       Developer (coding)
              │
              ▼
          QA (testing)
         ╱          ╲
    all_pass     bugs_found
       ╱              ╲
      ▼                ▼
  DevOps           Developer
 (deployment)      (coding)
```

**特点**：
- PM 硬编码为入口点
- Architect 阶段未出现在 DAG 中（虽然 `role.yaml` 定义了 `pipeline_downstream → developer`，但 BFS 从 PM 开始遍历，不经过 Architect）
- 条件分支仅在 QA 阶段（`all_pass` / `bugs_found`）

---

## 三、推荐改进优先级

| 优先级 | 改进项 | 影响 |
|--------|--------|------|
| **P0** | Pipeline 读取 workflow YAML 的 transitions/guards | 阶段转换获得真正的状态机约束 |
| **P0** | Architect 阶段接入 DAG（PM → Architect → Developer） | 补全 DAG 路径 |
| **P1** | Pipeline ↔ Lifecycle 状态联动 | 流水线阶段完成时自动触发 Change 生命周期 |
| **P1** | `failed`/`skipped` 状态的触发路径 | 补全 6 种状态的完整生命周期 |
| **P2** | Workflow artifacts 校验 | 阶段完成时检查产出物是否存在 |
| **P2** | EventBus 驱动 | 替代手动 `pipeline status` 轮询 |
| **P3** | Coordinator Runtime | 自动调度和冲突检测 |
| **P3** | Supervisor Agent | 多 Developer 并行任务分配 |

---

## 四、总结

IvyFlow 的多 Agent 流水线系统**核心骨架已就绪**：DAG 构建、6 种状态、条件分支、回退重试、CLI 命令均已实现。当前版本可以支撑基本的 PM → Developer → QA → DevOps 协作流程。

主要缺失是**声明式配置与运行时的连接**——workflow YAML 中精心设计的 transitions/guards/artifacts 尚未接入运行时引擎，这是下一阶段的核心工作。

# 在 AI Agent 中使用 IvyFlow

## 概述

IvyFlow 在 AI 编码 Agent 内部以**斜杠命令（Slash Commands）**和**技能（Skills）**的形式运行。你在 Agent 对话框中输入命令，AI Agent 会按照 IvyFlow 的结构化工作流一步步执行，在关键决策点暂停等待你的确认。

---

## 支持的 Agent 平台

| 层级 | 平台 | 命令格式 |
|------|------|----------|
| **Tier 1** | Claude Code, Cursor, GitHub Copilot | `/ivyflow` `/pmflow` 等 |
| **Tier 2** | Windsurf, Gemini CLI, Cline, Amazon Q, Continue, RooCode | 同上 |
| **Tier 3** | CodeBuddy, Trae, Qoder, OpenCode, Kilo Code, Auggie, Kimi Code, Lingma | 同上 |

---

## 快速开始

### 1. 安装

```bash
npm install -g ivyflow-cli
cd your-project
ivy init
```

### 2. 在 Agent 中开始使用

重启你的 AI 编码工具，然后在对话框中输入：

```
/ivyflow "实现用户登录功能"
```

Agent 会自动进入 OPEN 阶段，创建提案、设计和任务文档。

---

## 五大角色体系

IvyFlow 提供 5 个角色，每个角色有独立的工作流和命令：

| 角色 | 入口命令 | 工作流 | 说明 |
|------|----------|--------|------|
| 💻 **Developer** | `/ivyflow` | open → design → build → verify → archive | 全栈开发 |
| 📋 **PM** | `/pmflow` | collect → analyze → prd → review → accept | 产品需求 |
| 🧪 **QA** | `/qaflow` | testcase → execute → bug → report → regression | 测试质量 |
| 🏗️ **Architect** | `/archflow` | research → design → review → guide | 架构设计 |
| 🚀 **DevOps** | `/devopsflow` | env → cicd → deploy → monitor → alert | 运维部署 |

### 切换角色

在终端中切换（不是在 Agent 中）：

```bash
ivy role set pm        # 切换到产品经理
ivy role set qa        # 切换到 QA
ivy role set architect # 切换到架构师
ivy role set devops    # 切换到运维
ivy role show          # 查看当前角色
```

---

## 全部斜杠命令

### 通用命令（所有角色可用）

| 命令 | 说明 |
|------|------|
| `/help` | 显示可用命令、工作流阶段说明、快速参考 |
| `/status` | 显示当前 Change 名称、当前阶段、阶段历史、工作目录 |
| `/phase` | 显示当前阶段和可用的下一阶段 |

### Developer 命令

| 命令 | 说明 | 使用场景 |
|------|------|----------|
| `/ivyflow "描述"` | **主入口** — 自动检测当前阶段，路由到对应阶段技能 | 标准功能开发 |
| `/ivyflow-quick "描述"` | **快速修复** — 跳过头脑风暴和计划，直接构建 | Bug 修复、文案修改、小代码调整 |
| `/ivyflow-hotfix "描述"` | **Bug 修复** — 跳过头脑风暴，直接构建，≤2 文件 | 紧急 Bug 修复 |
| `/ivyflow-tweak "描述"` | **小改动** — 跳过头脑风暴，轻量级构建+验证，≤3 任务 | 配置调整、文档更新 |
| `/ivyflow-status` | 查看当前任务状态 | 查看进度 |

### PM 命令

| 命令 | 说明 |
|------|------|
| `/pmflow "描述"` | **PM 主入口** — 路由到 PM 阶段：collect → analyze → prd → review → accept |
| `/pmflow-prd "描述"` | 快速生成 PRD 文档 |
| `/pmflow-review` | 启动需求审查 |

### Architect 命令

| 命令 | 说明 |
|------|------|
| `/archflow "描述"` | **架构师主入口** — 路由到架构阶段：research → design → review → guide |
| `/archflow-research "描述"` | 快速技术调研，生成对比报告 |
| `/archflow-review` | 启动架构审查 |

### QA 命令

| 命令 | 说明 |
|------|------|
| `/qaflow "描述"` | **QA 主入口** — 路由到 QA 阶段：testcase → execute → bug → report → regression |
| `/qaflow-bug "描述"` | 快速生成 Bug 报告 |
| `/qaflow-report` | 生成测试总结报告 |

### DevOps 命令

| 命令 | 说明 |
|------|------|
| `/devopsflow "描述"` | **DevOps 主入口** — 路由到 DevOps 阶段：env → cicd → deploy → monitor → alert |
| `/devopsflow-deploy` | 快速部署 |
| `/devopsflow-monitor` | 查看监控状态 |

---

## Developer 角色详细使用

### 完整标准工作流

#### 第一步：启动工作流

在 Agent 中输入：

```
/ivyflow "实现用户邮箱密码登录功能，支持 JWT Token 认证"
```

#### 第二步：OPEN 阶段（提案）

Agent 会：
1. 创建 OpenSpec 变更结构（`proposal.md`、`design.md`、`tasks.md`）
2. 运行 10 项规格质量检查清单
3. **暂停等待你确认**："这是提案摘要，确认还是需要调整？"

你可以回复：
- "确认" — 进入下一阶段
- "需要调整：XXX" — Agent 根据反馈修改

#### 第三步：DESIGN 阶段（深度设计）

Agent 会：
1. 生成上下文交接文件
2. 运行头脑风暴（加载 Superpowers brainstorming 技能）
3. 运行 Delta Spec 完整性检查清单
4. 创建详细设计文档
5. **暂停等待你确认**："这是技术方案，确认吗？"

#### 第四步：BUILD 阶段（构建）

Agent 会：
1. **询问你选择执行模式**：
   - `executing-plans`（推荐）：主会话内联执行
   - `subagent-driven-development`：主会话仅协调，每个子 Agent 最多 5 个上下文项
   - `direct`：直接执行（仅 hotfix/tweak）
2. 生成实施计划
3. 逐个执行任务（如果启用 TDD，先写测试）
4. 每个任务执行两阶段审查（规格合规 + 代码质量）
5. 最多 3 轮修复；3 轮后阻塞

#### 第五步：VERIFY 阶段（验证）

Agent 会：
1. 运行所有质量门禁（编译、测试、Lint、覆盖率）
2. 如果有失败 → **暂停询问**："修复问题"或"接受偏差"
3. 处理分支（合并/创建 PR/推送）

#### 第六步：ARCHIVE 阶段（归档）

Agent 会：
1. 显示最终摘要
2. **暂停询问**："确认归档"或"取消"
3. 归档并清理

---

### 快速路径（预设）

#### Hotfix（Bug 修复）

```
/ivyflow-hotfix "修复登录页面 Token 刷新失败的问题"
```

**特点**：
- 跳过头脑风暴和完整计划
- 直接构建，不启用 TDD
- 包含调试门禁：必须先找到根因再修复
- 包含根因消除检查：验证没有类似问题
- 限制 ≤2 个文件

**自动升级触发**（任一条件满足 → 建议改用 `/ivyflow`）：
- 改动超过 3 个文件
- 涉及架构变更（新模块、新接口、新依赖）
- 数据库 Schema 变更
- 引入新的公开 API
- 超出单个函数/模块范围

#### Tweak（小改动）

```
/ivyflow-tweak "更新 README 中的安装说明"
```

**特点**：
- 跳过头脑风暴和完整计划
- 轻量级构建（direct 模式）
- 轻量级验证（≤3 任务、≤4 文件、简化审查）

**自动升级触发**（任一条件满足 → 建议改用 `/ivyflow`）：
- 改动超过 5 个文件
- 需要跨模块协调
- 需要 5 个以上新测试用例
- 新增/删除配置项（非值变更）
- 需要新能力或 Delta Spec

#### Quick（快速修复）

```
/ivyflow-quick "给按钮加个 loading 状态"
```

最简单的快速路径，跳过头脑风暴和计划，直接构建。

---

### 常用 Agent 内命令

```
/status    — 查看当前进度（Change 名称、阶段、历史）
/phase     — 查看当前阶段和可用下一阶段
/help      — 显示所有可用命令和说明
```

---

## 多角色协作使用

### 场景：从需求到上线

#### 1. PM 阶段（产品需求）

```bash
# 终端切换角色
ivy role set pm
```

在 Agent 中：

```
/pmflow "设计用户权限管理系统"
```

Agent 依次执行：收集需求 → 分析 → 编写 PRD → 审查 → 验收

#### 2. Architect 阶段（架构设计）

```bash
ivy role set architect
```

在 Agent 中：

```
/archflow "设计用户权限管理系统的技术架构"
```

Agent 依次执行：技术调研 → 架构设计 → 审查 → 指导

#### 3. Developer 阶段（开发实现）

```bash
ivy role set developer
```

在 Agent 中：

```
/ivyflow "实现用户权限管理系统"
```

Agent 依次执行：提案 → 设计 → 构建 → 验证 → 归档

#### 4. QA 阶段（测试）

```bash
ivy role set qa
```

在 Agent 中：

```
/qaflow "测试用户权限管理系统"
```

Agent 依次执行：用例设计 → 执行 → Bug 跟踪 → 报告 → 回归

#### 5. DevOps 阶段（部署）

```bash
ivy role set devops
```

在 Agent 中：

```
/devopsflow "部署权限管理系统到预发布环境"
```

Agent 依次执行：环境准备 → CI/CD → 部署 → 监控 → 告警

---

## 阶段权限规则

Agent 在不同阶段有不同的操作权限，IvyFlow 会自动拦截违规操作：

| 阶段 | 允许 | 禁止 |
|------|------|------|
| **OPEN** | 读文件、编辑 .md（提案） | ❌ 写代码（.ts、.js、.py 等） |
| **DESIGN** | 读文件、编辑 .md（设计） | ❌ 写实现代码 |
| **BUILD** | ✅ 写代码、编辑测试 | ❌ 修改提案/设计文档 |
| **VERIFY** | 跑测试、修编译错误 | ❌ 添加新功能 |
| **ARCHIVE** | 读文件、运行报告 | ❌ 写任何代码或文档 |

如果 Agent 在 OPEN 阶段尝试写 `.ts` 文件，你会看到：

```
❌ IvyFlow 规则拦截（OPEN 阶段只允许编辑 .md）
```

---

## 关键决策点（需要你确认）

IvyFlow 在以下节点会暂停，等待你的确认：

| 阶段 | 决策点 | 选项 |
|------|--------|------|
| **OPEN** | 提案内容确认 | 确认 / 需要调整 |
| **DESIGN** | 技术方案确认 | 确认 / 需要调整 |
| **BUILD** | 选择执行模式 | executing-plans / subagent / direct |
| **VERIFY** | 验证失败处理 | 修复问题 / 接受偏差 |
| **ARCHIVE** | 最终归档确认 | 确认归档 / 取消 |

---

## 使用技巧

### 1. 描述越详细越好

```
❌ 不好的描述：/ivyflow "登录"
✅ 好的描述：/ivyflow "实现邮箱密码登录，支持 JWT Token 认证，包含注册、登录、Token 刷新、登出功能"
```

### 2. 善用预设加速

- 小 Bug → `/ivyflow-hotfix`
- 文案/配置 → `/ivyflow-tweak`
- 快速改动 → `/ivyflow-quick`
- 新功能 → `/ivyflow`

### 3. 随时查看状态

```
/status    — 看进度
/phase     — 看当前阶段
/help      — 看可用命令
```

### 4. 多角色协作

不用一个角色从头做到尾。先 PM 写需求，再 Architect 设计架构，再 Developer 实现，再 QA 测试，最后 DevOps 部署。

---

## 相关文档

- [ivy-init.md](./ivy-init.md) — CLI 安装初始化
- [ivy-role.md](./ivy-role.md) — 角色管理
- [ivy-guard.md](./ivy-guard.md) — 三重守卫
- [ivy-workflow.md](./ivy-workflow.md) — 工作流管理
- [ivy-pipeline.md](./ivy-pipeline.md) — 多角色流水线

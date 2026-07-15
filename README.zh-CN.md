# IvyFlow

> **AI 编码 Agent 的工作流强约束器。** 阻止 AI Agent 在不该写代码的时候写代码，量化它的实际贡献。

[English](./README.md) | [更新日志](./CHANGELOG.md) | [白皮书](./docs/whitepaper.md)

---

## 谁适合用 IvyFlow

### 用户 A：个人 AI 辅助开发者
> **需求**：看清 AI 写了多少代码、质量如何，让它别跳过必要步骤。

你用 Claude Code 或 Cursor 做日常开发。你需要 AI 代码的量化可见性，以及对 Agent 工作流的基本约束。

**入口路径**：README → [5 分钟上手](#5-分钟上手) → `npm install -g ivyflow-cli && ivy init`

### 用户 B：小团队技术负责人
> **需求**：统一团队工作流标准，实施阶段门禁，量化采纳率。

团队成员都用 AI 编码工具，但每个人的 Agent 行为都不一样。你需要一致的工作流约束、归档前的质量门禁、以及跨成员的采纳率统计。

**入口路径**：README → [三重守卫](#三重阶段守卫体系) → [采纳率分析](#采纳率分析) → `ivy init --standard`

### 用户 C：企业级平台工程团队
> **需求**：多项目治理、跨团队洞察、变更影响分析。

你的组织运行着几十个 AI 辅助开发项目。你需要 Org Intelligence 做跨项目聚合、Council 做视角分析、Digital Twin 做变更影响评估。

**入口路径**：README → [白皮书](./docs/whitepaper.md)（组织智能、智囊团、数字孪生）

---

## 你面对的问题

AI Agent 会漂移。没有外部约束时，它们的行为不可控：

1. **Agent 跳过需求阶段。** 上来就写代码，边写边设计。应当结构化的流程变成了随意生成。
2. **没有标准化工作流。** 团队每个人的 Agent 行为都不一样——没有一致的阶段约束、没有质量基线、没有共享流程。
3. **AI 贡献无法量化。** "AI 写了多少代码？质量如何？省了多少时间？"——全靠猜测，没有数据。

---

## IvyFlow 的核心能力

### 🛡️ 三重阶段守卫

三层独立防线阻止 AI Agent 在不该写代码的时候写代码：

| 层级 | 机制 | 拦截什么 |
|------|------|----------|
| **PreToolUse Hook** | 文件写入前的实时拦截 | OPEN、DESIGN、ARCHIVE 阶段的代码编辑 |
| **Rule 文件** | AI 平台加载的阶段感知规则 | Agent 侧的全局约束（平台原生） |
| **Git Pre-Push Hook** | 阻止非 ARCHIVE 的推送 | Git 层的绕过防护 |

三层形成纵深防御——从 Agent 本身到代码仓库，每个层面都能捕获违规行为。

### 📊 采纳率分析

透明量化 AI 的代码贡献，每一层都标注置信度：

- **L1 会话边界**（>90% 置信度）：会话开始/结束的 git diff
- **L2 Git Notes**（70-85%）：基于注解的行级归因
- **L3 文件估算**（60-80%）：基于会话覆盖率的文件级估算
- **L4 代码特征**（<60%）：模式识别（仅参考，不纳入统计）

没有黑盒。每个数字都附置信度等级和可能误差来源。

[完整文档 →](./docs/ANALYTICS-CALIBRATION.md)

### 🔄 9 步工作流（5 阶段）

每个 Change 按结构化流程推进：

```
open → design → build → verify → archive
```

每个阶段有明确的权限、流转规则和质量门禁。Agent 不能跳过或重排阶段。TypeScript 状态机是唯一真理来源——构建阶段从 enum 自动同步到 markdown rule，两边不会漂移。

完整 9 步分解见[白皮书](./docs/whitepaper.md#4-9-步开发工作流)。

---

## 5 分钟上手

```bash
# 1. 全局安装
npm install -g ivyflow-cli

# 2. 在项目中初始化
cd your-project
ivy init

# 3. 查看当前状态
ivy status

# 4. 创建一个新 Change
openspec new change add-login

# 5. 体验守卫拦截
# 在 OPEN 阶段尝试写 .ts 文件：
# → ❌ IvyFlow 规则拦截（OPEN 阶段只允许编辑 .md）
```

完成。IvyFlow 现在正在为你的项目强制执行工作流。

---

## 核心功能

### 阶段权限

| 阶段 | 允许的操作 | 禁止的操作 |
|------|-----------|-----------|
| **OPEN** | 读文件、编辑 .md（方案） | 写代码（.ts、.js、.py 等） |
| **DESIGN** | 读文件、编辑 .md（设计） | 写实现代码 |
| **BUILD** | 写代码、编辑测试 | 修改方案/设计文档 |
| **VERIFY** | 跑测试、修编译错误 | 添加新功能 |
| **ARCHIVE** | 读文件、运行报告 | 写任何代码或文档 |

### 质量门禁

```bash
ivy verify --change add-user-auth               # 运行所有门禁
ivy verify --change add-user-auth --gate compile  # 仅编译
ivy verify --change add-user-auth --gate evidence # 检查证据覆盖率
ivy verify --change add-user-auth --skip coverage # 跳过覆盖率
```

### Delta Spec（偏差记录）

当 Agent 检测到实现偏离了已批准的设计，它会在设计文档末尾追加一条 Delta 记录。确保设计与代码的对齐始终可视、可审计。

[完整文档 →](./docs/DELTA-SPEC.md)

### 知识提取

归档 Change 时，IvyFlow 自动从设计文档中提取决策、约束、风险和事实——在每次迭代中持续构建项目知识库。

```bash
ivy archive --change add-user-auth --adr
# 提取知识到 .ivy/memory/<change>/
```

### 记忆系统

三层记忆架构，随项目成长而扩展：

| 层级 | 安装方式 | 功能 |
|------|----------|------|
| **核心（Core）** | 默认安装 | 事件时间线、项目事实、全文检索 |
| **扩展（Extended）** | 可选启用 | 向量搜索、记忆关联、知识图谱 |
| **插件（Plugin）** | 独立安装 | Council、Digital Twin、Org Intelligence |

[完整文档 →](./docs/MEMORY.md)

### 平台支持

IvyFlow 向各 AI 编码平台分发规则、Skill 和 Hook：

| 层级 | 平台 |
|------|------|
| **Tier 1**（官方维护） | Claude Code、Cursor、GitHub Copilot |
| **Tier 2**（社区维护） | Windsurf、Gemini CLI、Cline、Amazon Q、Continue、RooCode |
| **Tier 3**（实验性） | CodeBuddy、Trae、Qoder、Kilo Code、Auggie/Augment、Kimi Code、Lingma |

[完整平台矩阵 →](./docs/PLATFORMS.md)

### 命令概览

```bash
# 安装与维护
ivy init [--quick|--standard|--enterprise]     # 安装 IvyFlow
ivy uninstall [--dry-run]                       # 安全移除
ivy update [--check]                            # 检查更新

# 工作流
ivy status [--change <名称>]                    # 查看当前阶段
ivy validate [--security]                       # 验证阶段流转
ivy doctor [--fix]                              # 健康检查（纯离线）
ivy state [set|recover]                         # 生命周期检查点管理
ivy workflow [preset|archive]                   # 工作流预设和证据

# 质量
ivy verify --change <名称> [--gate <类型>]      # 质量门禁
ivy audit evidence --change <名称>              # 证据覆盖率审计
ivy trace <id>                                  # 知识链接追溯

# 分析
ivy analytics [--confidence]                    # 采纳率指标
ivy dashboard [--html]                          # 交互式仪表盘

# 变更管理
ivy archive --change <名称> [--adr]             # 归档含知识提取
ivy release --change <名称>                     # 打包已完成制品
ivy fingerprint [--refresh]                     # 技术栈检测

# 知识
ivy memory search <关键词>                      # 记忆搜索
ivy knowledge link|traverse|unlink              # 知识图谱管理
ivy suggest [--calibrate]                       # 工作流建议

# 能力（v0.14+）
ivy capability detect [--refresh]               # 技术栈检测
ivy capability health [--gaps-only]             # 能力健康评估
ivy rules generate [--format json]              # 从技术栈生成规则

# 探索
ivy explore                                     # 只读探索模式
ivy explain --id <id>                           # 建议可追溯性
```

---

## 同类工具对比

| 维度 | IvyFlow | Comet | 原生 AI 编码 |
|------|---------|-------|-------------|
| 工作流约束 | **三层守卫**（Hook + Rule + Git） | 单层 Hook | 无 |
| 阶段机 | **5 阶段**，enum 自动同步 | 阶段追踪 | 无 |
| 采纳率分析 | **4 层归因**，逐层置信度 | 无 | 无 |
| 记忆系统 | **3 层架构**（核心/扩展/插件） | 无 | 无 |
| 平台支持 | **16 平台**（3 级分层） | 30+ | 不适用 |
| 变更影响分析 | **数字孪生** | 无 | 不适用 |
| 多项目治理 | **组织智能** | 无 | 不适用 |

---

## 项目状态

**当前版本**：v0.14.0 | **722 个测试** | **94.2% 覆盖率** | **16 个平台**

- [更新日志](./CHANGELOG.md)
- [白皮书](./docs/whitepaper.md)
- [v0.15 路线图](./docs/roadmap-v0.15.md)

---

## 开发

```bash
npm install
npm run build       # tsc + sync-phases + check-manifest + check-skill-blocks
npm test            # vitest（覆盖率目标：≥ 80%）
npm run lint        # eslint flat config
```

---

## 许可证

MIT。详见 [LICENSE](./LICENSE)。

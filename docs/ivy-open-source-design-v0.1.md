# IvyFlow 开源工具详细设计文档 v0.1

> 版本：v0.1.1 | 日期：2026-06-16 | 状态：Draft（吸收"极简方案"反馈优化）
>
> **重大变更**：相对 v1，本版本**大幅降低工程复杂度**，从"平台级系统"回归"CLI 工具"定位。
> 核心思想：**v0.1 必须能活下来；v1.0 才追求完整性；v2.0+ 才做生态。**
>
> **本次更新（v0.1.1）**：吸收"极简方案"的克制感，做了 3 处关键修改：
> 1. 引入显式 TS 状态机（`phase-machine.ts`），让 phase 不仅是 YAML 字段
> 2. v0.1 命令收紧到 3 个（init / status / validate），砍掉 doctor / uninstall
> 3. 定位语精准化为 "Workflow Enforcer for AI Coding Agents"
>
> **同时澄清**：IvyFlow 与 Comet 是**平行同类产品**（都是 Skill 分发器），不是 Comet 的状态机插件层。Comet 自身不是 LLM runtime，无 `comet.execute()` API。

---

## 0. 设计变更摘要（v1 → v2）

### 0.1 评估反馈采纳清单

| 编号 | 评估建议 | 采纳情况 | 处理方式 |
|------|---------|---------|---------|
| **P0-1** | 系统过度分层，整体复杂度过高 | ✅ 全盘采纳 | 重构为 4 层架构，v0.1 仅实现 Layer 1+2 |
| **P0-2** | Hook + Rule + Git Hook 三重防御冗余 | ✅ 采纳 | 改为"Rule 主，Git Hook 辅，Hook 增强"的渐进增强模型 |
| **P0-3** | 采纳率系统过早复杂化 | ✅ 采纳 | v0.1 砍到只剩 commit diff 估算；四层归因延后到 v1.0+ |
| **P0-4** | OpenSpec/GitNexus 强依赖 | ⚠️ 部分采纳 | v0.1 保留 OpenSpec 强依赖（事实标准），但抽取 `SpecAdapter` 接口；GitNexus 直接降级为 v1.0+ 可选插件 |
| **P0-5** | Skill 系统过度设计 | ✅ 采纳 | v0.1 仅 ivy 单一 Skill；阶段拆分延后到 v0.2 |
| **P0-6** | CLI UX 过重 | ✅ 采纳 | 引入 `--quick` / `--standard` / `--enterprise` 三档；默认 quick |
| **P1-1** | Skill 系统改为 plugin registry | ⚠️ 部分采纳 | v0.1 不做 registry，仅约定 plugin 接口；v1.1+ 落地 npm 包形式 plugin |
| **P1-2** | 采纳率改为 plugin | ✅ 采纳 | `@ivyflow/analytics` 独立子包，主 CLI 不依赖 |
| **P1-3** | 技术栈推荐延迟引入 | ✅ 采纳 | v0.1 不做；v0.2 可选展示，v1.0+ 才精细化 |
| **P2-1** | analytics dashboard | ✅ 采纳 | v1.0 实现，v0.x 不做 |
| **P2-2** | skill marketplace | ✅ 采纳 | v2.0+ 才考虑 |

### 0.2 不予采纳的反馈

| 编号 | 评估建议 | 不采纳理由 |
|------|---------|----------|
| N-1 | "OpenSpec 也应抽象掉" | OpenSpec 是 Comet 等同类产品的事实依赖，强行抽象增加复杂度而无实际价值。仅约定 `SpecAdapter` 接口预留扩展点，默认实现写死 OpenSpec |
| N-2 | "Hook 完全降级为 logging" | Hook 在 Claude Code 这种主流平台是真实有效的拦截手段，完全弃用过于保守。采用"可选增强"折衷 |
| N-3 | "采纳率全部延后到 v2" | 采纳率是 IvyFlow 的核心差异化卖点之一，完全延后会丢失叙事。v0.1 保留最简版（commit diff），v1.0 完善 |

### 0.3 关键架构变化对比

| 维度 | v1 设计 | v2 设计 |
|------|--------|--------|
| 模块数量（v0.1） | 11 个核心模块 | **4 个核心模块** |
| 平台数量（v0.1） | 2 个 | **1 个（Claude Code）** |
| Skill 数量（v0.1） | 5 个（ivy + 4 子 Skill） | **1 个（ivy）** |
| 阶段守卫 | Hook + Rule + Git Hook | **Rule 优先 + Git Hook 兜底**（Hook 为可选增强） |
| 采纳率 | 4 层归因 + 事件流 | **commit diff 估算**（单层） |
| 技术栈推荐 | v0.1 必备 | **v1.0 才引入** |
| GitNexus | v0.1 可选集成 | **v1.0+ 插件形式** |
| CLI 模式 | 单一交互式 | **quick / standard / enterprise 三档** |
| v0.1 预估代码量 | ~3000 行 | **~800 行** |

---

## 1. 项目定位（重新校准）

### 1.1 一句话定义

> **IvyFlow — A Workflow Enforcer for AI Coding Agents.**
>
> 中文：**IvyFlow 是一个面向 AI 编码助手的工作流强约束器**。它通过 Skill 分发 + 阶段状态机 + Git Hook 兜底，让 AI Agent 在 Claude Code 等平台上严格遵循"9 步规范驱动开发"流程，而非随意跳跃。

### 1.2 与 Comet 的关系（澄清）

**IvyFlow 与 Comet 是平行同类产品，不是 Comet 的插件层**：

- 两者都是 **Skill 分发器**：把 SKILL.md 文件复制到 `.claude/skills/` 等目录，由 AI 助手自行加载执行
- Comet 自身**不是 LLM runtime**，不存在 `comet.execute(skill)` 这种 API
- IvyFlow 不调用 Comet，而是**借鉴 Comet 的 CLI 实现**（npm 包结构、commander 模式、manifest.json 驱动），并在此基础上做差异化

### 1.3 与 Comet 的差异化（务实版）

不再追求"全面碾压 Comet"，而是聚焦**两个核心差异点**：

| 差异点 | Comet | IvyFlow |
|-------|-------|---------|
| **工作流方法论深度** | OpenSpec + Superpowers 双星 | **9 步工作流 + Delta Spec + TDD 纪律 + 显式 TS 状态机** |
| **采纳率量化** | 无 | **基础采纳率（v0.1）→ 多层归因（v1.0）** |

其他维度（平台广度、CLI 成熟度）**接受落后于 Comet**，不正面竞争。

### 1.4 IvyFlow 不做的事（强化版）

- ❌ 不做平台广度竞争（v1.0 之前不超过 5 个平台）
- ❌ 不做插件生态市场（v2.0+ 才考虑）
- ❌ 不做实时 Hook 强拦截作为唯一防线
- ❌ 不做精确采纳率（接受估算误差，透明标注置信度）
- ❌ 不做技术栈智能推荐（v0.1 砍掉）
- ❌ 不做 SaaS / 远程上报
- ❌ **不做 LLM runtime**（不实现 `ivy run "task"` 这种直接驱动 Agent 的命令；任务执行交给 Claude Code/Cursor 等 AI 助手）

---

## 2. 4 层架构（核心重构）

### 2.1 架构总览

```
┌──────────────────────────────────────────────────────────┐
│ Layer 4: Plugins (optional)                              │
│   @ivyflow/analytics  │  @ivyflow/gitnexus  │  ...       │
│   ▲ 独立 npm 包，不影响主 CLI 启动                         │
├──────────────────────────────────────────────────────────┤
│ Layer 3: Extensions                                      │
│   skills/  │  rules/  │  hooks/  (assets, 静态资源)       │
├──────────────────────────────────────────────────────────┤
│ Layer 2: Platform Adapter                                │
│   PlatformRegistry → write skills/rules/hooks            │
│   SpecAdapter (default: OpenSpecAdapter)                 │
├──────────────────────────────────────────────────────────┤
│ Layer 1: Core Workflow Engine (CLI)                      │
│   commander + @inquirer/prompts                          │
│   commands: init / status / doctor / uninstall           │
└──────────────────────────────────────────────────────────┘
```

### 2.2 各 Layer 职责与版本归属

| Layer | 职责 | v0.1 | v0.2 | v1.0 | v1.1+ |
|-------|------|------|------|------|-------|
| L1 Core | CLI 注册、命令分派、配置读写 | ✅ 必须 | — | — | — |
| L2 Adapter | 平台抽象、Skill/Rule 分发、SpecAdapter | ✅ 1 个平台 | + 4 平台 | + 8 平台 | + 15+ |
| L3 Extensions | 静态资源（Skills/Rules/Hooks） | ✅ 1 个 Skill | + 阶段拆分 | + 安全规则 | — |
| L4 Plugins | 可选插件（analytics、gitnexus） | ❌ 不做 | ❌ | ✅ analytics | + gitnexus |

### 2.3 目录结构（v0.1 实际）

```
ivyflow/
├── bin/
│   └── ivy.js
├── src/
│   ├── cli/
│   │   └── index.ts              # commander 入口
│   ├── commands/
│   │   ├── init.ts               # 含 quick/standard/enterprise 模式
│   │   ├── status.ts             # 显示当前 change 的 phase + adoption
│   │   └── validate.ts           # 校验 .ivy.yaml 的 phase 合法性（基于状态机）
│   ├── core/
│   │   ├── platforms.ts          # 平台定义（v0.1: Claude Code）
│   │   ├── skills.ts             # Skill 分发（基于 manifest.json）
│   │   ├── openspec.ts           # OpenSpec CLI 封装
│   │   ├── spec-adapter.ts       # SpecAdapter 接口（默认 OpenSpecAdapter）
│   │   ├── phase-machine.ts      # ✨ v0.1.1 新增：显式阶段状态机
│   │   ├── adoption-lite.ts      # commit diff 采纳率估算（极简）
│   │   └── types.ts
│   └── utils/
│       ├── fs.ts
│       ├── git.ts
│       └── logger.ts
├── assets/
│   ├── manifest.json             # 资源清单
│   ├── skills/
│   │   └── ivy/
│   │       ├── SKILL.md          # 单一主 Skill（包含完整 9 步流程）
│   │       └── references/       # 渐进加载的参考文档
│   ├── rules/
│   │   └── ivy-phase-guard.md    # 阶段守卫规则（主防线）
│   └── hooks/
│       └── ivy-git-prepush.sh    # Git pre-push hook（兜底防线）
├── package.json
├── tsconfig.json
└── README.md
```

**v0.1 不包含**：
- `tech-stack.ts`、`security.ts`、`adoption.ts`（完整版）、`gitnexus.ts`、`analytics.ts`、`dashboard.ts`
- `doctor.ts`、`uninstall.ts`（v0.1.1 砍掉，延后到 v0.2）
- `ivy-open/` `ivy-build/` `ivy-verify/` `ivy-archive/` 子 Skill
- `assets/skill-recommendations.json`
- PreToolUse Hook（v0.2 增强）

---

## 3. CLI 设计（三档模式）

### 3.1 命令清单

**v0.1 收紧到 3 个命令**（吸收"极简方案"的克制感）。doctor/uninstall 延后到 v0.2，避免 v0.1 表面积过大。

| 命令 | v0.1 | v0.2 | v1.0 | 作用 |
|------|------|------|------|------|
| `ivy init` | ✅ | ✅ | ✅ | 安装 Skill / Rule / Git Hook，初始化 OpenSpec |
| `ivy status` | ✅ | ✅ | ✅ | 显示 change 当前 phase + 采纳率快照 |
| `ivy validate` | ✅ | ✅ | ✅ | **校验 `.ivy.yaml` 的 phase 是否合法**（走状态机） |
| `ivy doctor` | — | ✅ | ✅ | 环境健康检查（v0.2 移植 Comet 实现） |
| `ivy uninstall` | — | ✅ | ✅ | 卸载 Skill / Rule / Hook（v0.2） |
| `ivy update` | — | ✅ | ✅ | 升级 Skill / 资源 |
| `ivy analytics` | — | — | ✅ | 通过 `@ivyflow/analytics` plugin 注册 |

**`ivy validate` 行为**：

```bash
$ ivy validate
✅ openspec/changes/add-dark-theme/.ivy.yaml: phase=build (valid)
❌ openspec/changes/refactor-auth/.ivy.yaml: phase="implementing" — not a known IvyPhase

可用 phase: open | design | build | verify | archive
```

它只做两件事：
1. 解析 `.ivy.yaml` 的 `phase` 字段，与 `IvyPhase` enum 对齐
2. 如果 YAML 里有 `phase_history` 字段，逐对调用 `canTransition()` 校验流转合法

不做：跑测试、推 commit、调用 OpenSpec —— 这些由 Skill 引导 Agent 做。

### 3.2 ivy init 三档模式

**核心改进**：CLI UX 不再"企业级一刀切"，而是按用户场景分档。

```bash
# 默认：快速模式（90% 用户场景）
ivy init                 # 等价于 ivy init --quick

# 标准模式：交互式选择
ivy init --standard

# 企业模式：完整功能（含可选插件）
ivy init --enterprise
```

#### Quick 模式流程（默认）

```
ivy init
  ├─ 1. 检测当前目录是否为 Claude Code 项目（.claude/ 存在）
  ├─ 2. 安装 OpenSpec CLI（如未装）
  ├─ 3. 复制 ivy Skill 到 .claude/skills/ivy/
  ├─ 4. 复制 phase-guard rule 到 .claude/rules/
  ├─ 5. 安装 git pre-push hook（如是 git 仓库）
  └─ 6. 打印一句话提示：用 /ivy 开始
```

**约束**：
- ≤ 5 个步骤
- ≤ 1 个交互提示（仅在检测失败时让用户选平台）
- 全程 < 30 秒（OpenSpec 安装除外）

#### Standard 模式流程

保留原 v1 的交互式向导（平台多选、范围选择、覆盖确认），适合多平台用户。

#### Enterprise 模式流程

在 Standard 基础上：
- 询问是否安装 `@ivyflow/analytics` 插件
- 询问是否安装 `@ivyflow/gitnexus` 插件
- 询问是否启用 PreToolUse Hook（仅 Claude Code/Windsurf）

### 3.3 输出风格

完全对标 Comet：
- 默认彩色文本
- `--json` 全命令支持
- 错误时打印 `printCommandErrorDetails`（直接复用 Comet 模式）

---

## 4. 核心模块（v0.1 极简版）

### 4.1 platforms.ts（仅 Claude Code）

```typescript
export interface Platform {
  id: string;
  name: string;
  skillsDir: string;
  globalSkillsDir?: string;
  openspecToolId: string;
  rulesDir?: string;
  rulesFormat?: 'md' | 'mdc' | 'copilot';
  supportsHooks?: boolean;
  hookFormat?: string;
}

export const PLATFORMS: Platform[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    skillsDir: '.claude',
    globalSkillsDir: '.claude',
    openspecToolId: 'claude',
    rulesDir: 'rules',
    rulesFormat: 'md',
    supportsHooks: true,
    hookFormat: 'claude-code',
  },
];
```

> v0.2 起按 Comet 模板批量复制平台定义（Cursor/Windsurf/Copilot/CodeBuddy）。

### 4.2 skills.ts（最简 manifest 分发）

直接借用 Comet 的 `copyCometSkillsForPlatform` 实现思路，重命名为 `copyIvySkillsForPlatform`：

```typescript
export async function copyIvySkillsForPlatform(
  baseDir: string,
  platform: Platform,
  overwrite: boolean,
  scope: InstallScope,
): Promise<{ copied: number; skipped: number }> {
  const manifest = await readManifest();
  // 遍历 manifest.skills，逐个复制到 platform.skillsDir/skills/
  // 实现完全对标 Comet src/core/skills.ts:42-110
}
```

### 4.3 spec-adapter.ts（轻量抽象层）

**目标**：避免 OpenSpec 强耦合的同时不增加复杂度。仅约定接口，默认实现写死 OpenSpec。

```typescript
export interface SpecAdapter {
  readonly name: string;
  ensureCli(scope: InstallScope, projectPath: string): Promise<boolean>;
  init(projectPath: string, toolIds: string[], scope: InstallScope): Promise<'installed' | 'failed'>;
}

export class OpenSpecAdapter implements SpecAdapter {
  readonly name = 'openspec';
  // 实现复用 Comet src/core/openspec.ts
}

// v0.1 写死
export const defaultSpecAdapter: SpecAdapter = new OpenSpecAdapter();
```

未来如需替换（v2.0+），通过环境变量 `IVY_SPEC_ADAPTER=custom` 注入即可。

### 4.4 adoption-lite.ts（极简采纳率）

**砍掉**：events.jsonl、session boundary、Git Notes、四层置信度、ASCII 仪表盘。

**保留**：

```typescript
export interface AdoptionSnapshot {
  change_name: string;
  base_commit: string;       // change 创建时的 HEAD
  head_commit: string;       // 当前 HEAD
  lines_added: number;       // git diff --shortstat
  lines_removed: number;
  estimated_ai_lines: number; // = lines_added（简单假设）
  confidence: 'low';          // v0.1 全部标 low
  collected_at: string;
}
```

实现：

```typescript
export async function snapshotAdoption(changeName: string): Promise<AdoptionSnapshot> {
  const baseCommit = await readChangeBaseCommit(changeName);
  const stat = await runGit(['diff', '--shortstat', `${baseCommit}..HEAD`]);
  // 解析 "X files changed, Y insertions(+), Z deletions(-)"
  return { ... };
}
```

`ivy status --change <name>` 输出一行：

```
adoption: ~420 lines (low confidence, commit diff)
```

> 完整版（多层归因、事件流、ASCII 仪表盘）作为 `@ivyflow/analytics` 插件在 v1.0 实现。

### 4.5 phase-machine.ts（v0.1.1 新增）

**动机**：v0.1 早期版本里 `phase` 仅作为 YAML 字段被 Rule/Hook 字符串比较，没有"非法流转"的概念。吸收"极简方案"反馈后，把阶段流转显式建模为 TS 状态机：

- 让 phase 成为 **类型安全的** enum，IDE 自动补全 + 编译期防错
- `ivy validate` 可基于状态机校验 `.ivy.yaml` 历史
- Git pre-push hook 之外多一层 **进程内** 防线（运行时校验）

```typescript
// src/core/phase-machine.ts

/** IvyFlow 9 步工作流的 5 个阶段（粗粒度归并）。 */
export enum IvyPhase {
  OPEN = 'open',         // 步骤 1-2：理解需求 + 创建 change
  DESIGN = 'design',     // 步骤 3-4：proposal + design
  BUILD = 'build',       // 步骤 5-6：tasks 拆分 + 实现
  VERIFY = 'verify',     // 步骤 7-8：测试 + verify
  ARCHIVE = 'archive',   // 步骤 9：archive + 采纳率快照
}

/** 合法流转表：from -> 允许的 to 集合。 */
const TRANSITIONS: Record<IvyPhase, IvyPhase[]> = {
  [IvyPhase.OPEN]:    [IvyPhase.DESIGN],
  [IvyPhase.DESIGN]:  [IvyPhase.BUILD, IvyPhase.OPEN],     // 允许回退到 OPEN 重新理解
  [IvyPhase.BUILD]:   [IvyPhase.VERIFY, IvyPhase.DESIGN],  // 允许回退到 DESIGN 调整方案
  [IvyPhase.VERIFY]:  [IvyPhase.ARCHIVE, IvyPhase.BUILD],  // verify 失败可回退到 BUILD
  [IvyPhase.ARCHIVE]: [],                                   // 终态
};

export function canTransition(from: IvyPhase, to: IvyPhase): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminalPhase(phase: IvyPhase): boolean {
  return TRANSITIONS[phase].length === 0;
}

/** 从字符串解析为 IvyPhase，未知值返回 null。 */
export function parsePhase(raw: string): IvyPhase | null {
  const allowed = Object.values(IvyPhase) as string[];
  return allowed.includes(raw) ? (raw as IvyPhase) : null;
}
```

**调用点**（v0.1）：
1. `commands/validate.ts` —— 解析 `.ivy.yaml` 后调 `parsePhase` + `canTransition`
2. `core/adoption-lite.ts` —— 仅在 `isTerminalPhase(phase) === true` 时才 snapshot
3. `assets/hooks/ivy-git-prepush.sh` —— bash 端只比较字符串 `archive`，但 Skill 文档 / Rule 引用 `IvyPhase` 来源以保证一致

**单元测试覆盖**（vitest）：
- 所有合法流转返回 true
- 跨阶段跳跃（如 `OPEN -> BUILD`）返回 false
- 终态再前进返回 false
- `parsePhase('implementing')` 返回 null

---

## 5. Skill 设计（v0.1 单一 Skill）

### 5.1 v0.1 manifest.json

```json
{
  "version": "0.1.0",
  "skills": [
    "ivy/SKILL.md",
    "ivy/references/phase-state-machine.md",
    "ivy/references/delta-spec.md",
    "ivy/references/tdd-discipline.md",
    "ivy/references/agent-dispatch.md",
    "ivy/references/context-recovery.md"
  ],
  "rules": [
    "ivy/rules/ivy-phase-guard.md"
  ],
  "hooks": {},
  "languages": [
    { "id": "en", "name": "English", "skillsDir": "skills" },
    { "id": "zh", "name": "中文", "skillsDir": "skills-zh" }
  ]
}
```

### 5.2 阶段拆分延后

v0.2 才把 `ivy/SKILL.md` 拆为：
- `ivy/SKILL.md`（路由器）
- `ivy-open/`、`ivy-build/`、`ivy-verify/`、`ivy-archive/`

**理由**：v0.1 的核心目标是验证"工作流方法论是否能跑通"，单 Skill 完整版本足够；过早拆分增加维护成本。

### 5.3 Skill 内容来源

直接从 `~/.claude/skills/ivy-dev-workflow/` 移植，按 9 步工作流梳理为：
- SKILL.md：入口（含阶段检测）
- references/：渐进式加载文档（每个文件 < 200 行）

---

## 6. 阶段守卫（渐进增强模型）

### 6.1 取消"三重防御"叙事

v1 的三层并列防御被替换为**"主-辅-增强"渐进模型**：

```
Primary (always-on, 全平台覆盖):
   📋 Rule 文件（注入 Agent 上下文）
        │
        ▼
Secondary (always-on, git 项目):
   🔒 Git pre-push Hook（提交时拦截）
        │
        ▼
Enhancement (opt-in, 仅 Claude/Windsurf 等):
   ⚡ PreToolUse Hook（实时拦截）
```

**关键差异**：
- v1 三层是"独立防线、互为备份"叙事 → 实际相互重叠且都不可靠
- v2 是"主防线 + 兜底 + 可选增强"，承认每层局限性，明确分工

### 6.2 各层职责（v2 修订版）

| 层级 | 启用条件 | 真实作用 | 失效场景 |
|------|---------|---------|---------|
| Rule | 默认安装 | 让 Agent 知道当前阶段约束 | Agent 主动违反 |
| Git pre-push | 默认安装（git 项目） | 阻止"phase != archive 的代码"被推送 | 用户用 `--no-verify` 绕过 |
| PreToolUse Hook | enterprise 模式或 `--enable-hook` | 拦截错误阶段的 Write/Edit | 平台不支持或 Agent 不执行 Hook |

### 6.3 v0.1 的真实交付

- ✅ Rule 文件（`assets/rules/ivy-phase-guard.md`）
- ✅ Git pre-push hook（`assets/hooks/ivy-git-prepush.sh`）
- ❌ PreToolUse Hook（v0.2 起作为可选增强）

### 6.4 Git pre-push 实现

```bash
#!/bin/bash
# assets/hooks/ivy-git-prepush.sh

CHANGE=$(git branch --show-current | sed -n 's|^ivy/||p')
[ -z "$CHANGE" ] && exit 0

YAML="openspec/changes/$CHANGE/.ivy.yaml"
[ ! -f "$YAML" ] && exit 0

PHASE=$(grep '^phase:' "$YAML" | head -1 | awk '{print $2}' | tr -d '"')
if [ "$PHASE" != "archive" ]; then
  echo "❌ Ivy: change '$CHANGE' is in '$PHASE' phase, push blocked."
  echo "   Run 'ivy status --change $CHANGE' to see what's pending."
  echo "   Bypass (use with caution): git push --no-verify"
  exit 1
fi
exit 0
```

依赖说明：仅用 grep/awk，不依赖 `yq`（避免额外二进制依赖）。

---

## 7. 采纳率（v0.1 极简，v1.0 完整）

### 7.1 v0.1：commit diff 单层估算

**实现**：归档时调用 `snapshotAdoption()`，结果写入 `.ivy.yaml`：

```yaml
# openspec/changes/<name>/.ivy.yaml
phase: archive
adoption:
  base_commit: a1b2c3d
  head_commit: f6e5d4c
  lines_added: 420
  lines_removed: 30
  estimated_ai_lines: 420
  confidence: low
  collected_at: 2026-06-16T12:00:00Z
```

**展示**：

```bash
$ ivy status --change add-dark-theme
Change: add-dark-theme
Phase:  archive
Adoption: ~420 lines (low confidence, based on commit diff)
```

**承认局限**：直接在 `confidence: low` 标注，README 也明示"此为粗略估算"。

### 7.2 v1.0：`@ivyflow/analytics` 插件

独立 npm 包，安装后才启用：

```bash
npm install -g @ivyflow/analytics
ivy analytics  # 此命令仅在插件安装后注册
```

插件提供：
- 多层归因（Session Boundary + Git Notes + File Mix）
- `events.jsonl` 事件流
- ASCII 仪表盘（`ivy dashboard`）
- 趋势分析（30d/90d）

**关键约束**：主 CLI 完全不依赖此插件，未安装时 `ivy analytics` 命令不存在。

### 7.3 v1 设计中砍掉/延后的内容

| v1 设计 | v2 处置 |
|--------|--------|
| Session Boundary 归因 | 延后到 v1.0 plugin |
| Git Notes 归因 | 延后到 v1.0 plugin |
| File-Level Mix | 延后到 v1.0 plugin |
| Code Features | **永久砍掉**（准确度 <60% 的方案不应放进产品） |
| events.jsonl | 延后到 v1.0 plugin |
| ASCII 仪表盘 | 延后到 v1.0 plugin |
| Token 效率统计 | 延后到 v1.0 plugin |

---

## 8. 安全机制（缩减版）

### 8.1 v0.1：仅 PII Rule 文件

`assets/rules/ivy-security.md` 内嵌简化版 PII 检测规则（中国身份证 / 手机号 / 通用 API Key 三类），随 ivy Skill 一起分发。

**明确不做**：
- ❌ Hook 层 PII 拦截
- ❌ SAST 集成
- ❌ 安全审查 Agent（v1.0+ 才做）
- ❌ "三层安全体系"叙事

### 8.2 v1.0+：可选 `@ivyflow/security` 插件

如果社区需求强，再做完整版（敏感文件黑名单、安全审查 Agent、SAST 集成）。

---

## 9. GitNexus（明确为可选插件）

### 9.1 v0.1：完全不集成

`ivy init` 不询问、不安装、不引用 GitNexus。

### 9.2 v1.0+：`@ivyflow/gitnexus` 插件

```bash
npm install -g @ivyflow/gitnexus
ivy init --enterprise   # 此模式才询问是否启用
```

插件功能：
- 自动 `gitnexus init -i`
- 在 `ivy status` 中展示索引健康度
- 在 Skill 中注入"使用 GitNexus 进行代码探索"指令

**架构隔离**：通过 `CodeIndexAdapter` 接口对接，未来可替换 CodeGraph、Sourcegraph 等。

---

## 10. 技术栈推荐（延后到 v1.0）

### 10.1 v0.1：完全砍掉

不检测 package.json/pom.xml/go.mod。`ivy init` 不展示推荐。

### 10.2 v0.2：仅展示提示语

只检测语言（JS/Python/Java/Go/Rust），打印一行：

```
检测到 TypeScript 项目。建议手动浏览 https://skills.sh 寻找匹配 Skill。
```

不维护映射表，不调用 `npx skills`。

### 10.3 v1.0：精选映射表

引入 `assets/skill-recommendations.json`，但明确：
- 仅维护 ≤ 20 个高质量映射
- 每月人工审核一次
- 不调用网络 API

---

## 11. 数据模型（极简）

### 11.1 v0.1 文件清单

```
项目根/
├── .ivy/
│   └── project.yaml           # 项目级配置（极简）
└── openspec/changes/<name>/
    └── .ivy.yaml              # 变更级元数据
```

### 11.2 .ivy/project.yaml（v0.1）

```yaml
version: 0.1.0
created_at: 2026-06-16T00:00:00Z
defaults:
  scope: project
  language: zh
```

**砍掉**：累计采纳率、趋势数据、active_changes（OpenSpec 自带）。

### 11.3 openspec/changes/<name>/.ivy.yaml（v0.1）

```yaml
phase: build              # open | design | build | verify | archive
phase_updated_at: 2026-06-16T10:00:00Z
adoption:                 # 仅在 archive 时生成
  base_commit: a1b2c3d
  lines_added: 420
  lines_removed: 30
  confidence: low
```

**砍掉**：execution_mode、implementation_strategy、enable_*、files_by_confidence、security 字段。这些都延后到对应 plugin 启用时再加。

---

## 12. 路线图（v2 修订版）

### 12.1 总体节奏

```
v0.1 (Month 1-2):  最小可活版本     —— 1 平台 + 1 Skill + Rule + Git Hook + 极简采纳率
v0.2 (Month 3):   平台 & Skill 扩展 —— 5 平台 + 阶段拆分 + 可选 PreToolUse Hook
v0.3 (Month 4):   质量打磨          —— update/uninstall/--json 等周边命令
v1.0 (Month 5-6): 插件化            —— @ivyflow/analytics 上线 + 8 平台
v1.1 (Month 7-8): 生态扩展          —— @ivyflow/gitnexus、@ivyflow/security
v2.0 (Month 9+):  marketplace        —— 社区插件登记中心
```

### 12.2 v0.1 详细任务（Month 1-2）

#### Sprint 1.1（Week 1-2）：项目骨架

- 搭建 TypeScript 项目（package.json/tsconfig/vitest/eslint，**直接复制 Comet 配置**）
- `bin/ivy.js` + `src/cli/index.ts`（commander 注册）
- `src/core/types.ts`、`src/utils/`（fs/git/logger）
- 移植 Comet 的 `command-error.ts`、`detect.ts`（精简到 1 平台）

#### Sprint 1.2（Week 3）：Skill 分发

- `core/platforms.ts`（仅 Claude Code）
- `core/skills.ts`（移植 Comet 同名文件，删除非必要逻辑）
- 编写 `assets/manifest.json` + `assets/skills/ivy/SKILL.md`（从 ivy-dev-workflow Skill 移植）

#### Sprint 1.3（Week 4）：OpenSpec 集成

- `core/openspec.ts`（直接复用 Comet 实现）
- `core/spec-adapter.ts`（接口定义 + OpenSpecAdapter 默认实现）

#### Sprint 1.4（Week 5）：阶段守卫 + 状态机

- `core/phase-machine.ts`（IvyPhase enum + TRANSITIONS + canTransition）
- 单元测试：合法/非法流转、parsePhase
- `assets/rules/ivy-phase-guard.md`（在 Rule 文本中嵌入 IvyPhase 列表，与 enum 同源）
- `assets/hooks/ivy-git-prepush.sh`
- `core/skills.ts` 中加入 git hook 安装逻辑

#### Sprint 1.5（Week 6）：CLI 命令（v0.1 仅 3 个）

- `commands/init.ts`（含 quick 模式）
- `commands/status.ts`（含 adoption-lite 输出）
- `commands/validate.ts`（基于 phase-machine 校验 `.ivy.yaml`）
- ⛔ 不实现 `doctor` / `uninstall`（延后到 v0.2）

#### Sprint 1.6（Week 7）：采纳率 lite + 测试

- `core/adoption-lite.ts`
- 单元测试（vitest）：skills 分发、adoption 计算、phase-machine 流转
- 集成测试：完整 init → status → validate 流程

#### Sprint 1.7（Week 8）：发布

- README.md（含 quickstart + 已知限制声明）
- npm publish v0.1.0（包名 `ivyflow-cli`）
- 在 GitHub 创建 Discussions 收集反馈

**v0.1 交付物清单**：

```
ivyflow-cli@0.1.0
├── ivy init [--quick|--standard|--enterprise]   ✅
├── ivy status [--change <name>]                 ✅
├── ivy validate                                 ✅ ✨ 新增
├── 1 平台（Claude Code）                         ✅
├── 1 Skill（ivy 单文件）                         ✅
├── 阶段守卫：Rule + Git Hook + 状态机           ✅
├── 极简采纳率：commit diff                      ✅
└── 单元测试 + 集成测试                          ✅

⛔ 不在 v0.1 范围：ivy doctor / ivy uninstall / ivy update（v0.2）

预估代码量：~850 行 TS + 4 个 asset 文件
```

### 12.3 后续版本要点

| 版本 | 主要交付 | 不再做 |
|------|---------|-------|
| v0.2 | + 4 平台、Skill 阶段拆分、PreToolUse Hook（可选）、技术栈语言检测（仅提示）、补齐 `ivy doctor` / `ivy uninstall` | 技术栈映射表、采纳率多层归因 |
| v0.3 | update/--json/version、CHANGELOG、ci 工作流 | 新功能 |
| v1.0 | `@ivyflow/analytics` 插件、+ 3 平台、文档站点 | 安全/技术栈映射 |
| v1.1 | `@ivyflow/gitnexus`、`@ivyflow/security` | — |
| v2.0+ | 插件 marketplace、社区贡献规范 | — |

### 12.4 风险与缓解（修订）

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 9 步工作流 Skill 内容过厚，Agent 加载困难 | 高 | 高 | references/ 渐进加载，每文件 < 200 行 |
| OpenSpec 上游 breaking change | 中 | 高 | SpecAdapter 接口预留，但接受短期阵痛 |
| Comet 也开始做采纳率 | 中 | 中 | 采纳率仅是差异化点之一，工作流深度仍是核心 |
| 用户认为"和 Comet 没差别" | 中 | 高 | README 首屏明确：IvyFlow = Comet 的工作流深化版 |
| 采纳率估算被质疑不准 | 高 | 低 | 透明标注 confidence；v0.1 接受批评，v1.0 plugin 解决 |

---

## 13. ADR 修订记录

| ID | 决策 | 与 v1 差异 | 理由 |
|----|------|----------|------|
| ADR-1 | TypeScript + npm | 不变 | 与 Comet 生态一致 |
| ADR-2 | commander + @inquirer/prompts | 不变 | 同上 |
| ADR-3 | OpenSpec 强依赖 + SpecAdapter 接口 | 新增接口层 | 既不重复造轮子也保留扩展性 |
| ADR-4 | **GitNexus 完全降级为 v1.0+ 插件** | v1: v0.1 可选 → v2: v0.1 不集成 | 减少 v0.1 表面积 |
| ADR-5 | **阶段守卫渐进增强模型** | v1: 三重并列 → v2: 主-辅-增强 | 承认每层局限，避免冗余叙事 |
| ADR-6 | PII 仅 Rule，且 v0.1 简化 | v1: 5 类规则 → v2: 3 类 | 不夸大安全能力 |
| ADR-7 | 文件系统采纳率存储 | 不变 | — |
| ADR-8 | manifest.json 驱动 | 不变 | 与 Comet 一致 |
| ADR-9 | **CLI 三档模式（quick/standard/enterprise）** | 新增 | 90% 用户用 quick，避免企业级 UX 拖累 |
| ADR-10 | **采纳率 v0.1 极简、v1.0 plugin 完整** | v1: v0.1 完整四层 → v2: v0.1 单层估算 | 避免过早复杂化 |
| ADR-11 | **v0.1 单 Skill，v0.2 才阶段拆分** | v1: v0.1 已 5 个 Skill → v2: 1 个 | 验证为先 |
| ADR-12 | **v0.1 仅 Claude Code 一个平台** | v1: 2 平台 → v2: 1 平台 | 极致聚焦 |
| ADR-13 | **显式 TS 状态机（`phase-machine.ts`）** | v0.1.1 新增 | 让 phase 不仅是 YAML 字段；类型安全 + 进程内校验，避免错误流转。状态机是源，Rule/Hook 文本均与之同源 |
| ADR-14 | **v0.1 收紧到 3 个命令（init/status/validate）** | v0.1.0: 4 个 → v0.1.1: 3 个 | 砍 doctor/uninstall 至 v0.2。MVP 阶段先验证"工作流是否能跑通"而非"运维体验是否完整" |
| ADR-15 | **定位语精准化为"Workflow Enforcer for AI Coding Agents"** | 新增 | 与 Comet 的"Skill marketplace 通用分发器"形成清晰差异；强调 enforcer（强约束）属性而非 toolkit |

---

## 14. 给开发者的实施建议

### 14.1 第一周做什么

1. **不要从设计文档开始写代码**。先 fork/clone Comet 仓库，把它跑起来。
2. 把 Comet 的 `src/cli/`、`src/core/platforms.ts`、`src/core/skills.ts`、`src/core/openspec.ts`、`src/utils/` 整个复制过来，重命名 `comet → ivy`。
3. 删除非 Claude Code 的平台定义。删除 Superpowers、CodeGraph 相关代码。
4. 此时你已有一个"ivy 版的 comet"，能跑通 `ivy init`。
5. 然后开始替换 `assets/skills/comet/` 为 `assets/skills/ivy/`。

### 14.2 不要做什么

- ❌ 不要先写"完美的 SpecAdapter 抽象"，先用直接调用，等真要替换时再抽
- ❌ 不要先做 dashboard，等 v1.0 plugin
- ❌ 不要先支持多平台，1 个跑通再说
- ❌ 不要先做技术栈检测，v0.2 只展示提示语
- ❌ 不要追求 `--json` 输出全覆盖，v0.3 再做
- ❌ **不要在 v0.1 实现 `doctor` / `uninstall`**（v0.1.1 已明确延后到 v0.2）
- ❌ **不要把 phase 当字符串到处 if-else 比较**，统一通过 `phase-machine.ts` 的 `parsePhase` / `canTransition` 入口

### 14.3 Comet 代码可直接复用的清单

| Comet 文件 | 复用方式 |
|-----------|---------|
| `src/cli/index.ts` | 直接复制改命令名 |
| `src/core/platforms.ts` | 仅保留 Claude Code 配置 |
| `src/core/skills.ts` | 全文复制，函数名 `Comet → Ivy` |
| `src/core/openspec.ts` | 全文复制 |
| `src/core/detect.ts` | 全文复制 |
| `src/core/command-error.ts` | 全文复制 |
| `src/utils/file-system.ts` | 全文复制 |
| `src/commands/init.ts` | 复制后删除 Superpowers/CodeGraph 部分；加入 quick 模式 |
| `src/commands/doctor.ts` | **v0.1 不复用**（延后到 v0.2 移植精简版） |
| `src/commands/uninstall.ts` | **v0.1 不复用**（延后到 v0.2 移植精简版） |
| `package.json` `tsconfig.json` `vitest.config.ts` `build.js` | 直接复制 |

预计**复用率 60%+**，可大幅压缩 v0.1 工期。

---

## 15. 一句话总结

> **v2 设计的核心改动是：把 v1 那个"想做平台"的雄心，拆成 v0.1 (CLI 工具) → v1.0 (插件化 CLI) → v2.0 (生态) 三步走，先活下来。**
>
> **v0.1.1 的进一步精炼**：把 phase 从 YAML 字段升级为显式 TS 状态机；把 v0.1 命令收紧到 3 个（init/status/validate）；把定位语锁定为 **Workflow Enforcer for AI Coding Agents**。三处都体现一个原则——**少即是多，但少必须有筋骨**。

**v0.1 的成功标准**：1 个开发者 8 周内能 ship；用户 30 秒内能跑起来；与 Comet 相比差异点清晰但不夸大。

---

> **文档维护者**：IvyFlow Team
> **最后更新**：2026-06-16
> **反馈渠道**：GitHub Discussions

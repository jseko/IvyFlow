# IvyFlow v0.2 设计文档

> 版本：v0.2.0 | 基于：docs/ivy-open-source-design.md | 日期：2026-06-16 | 状态：Draft

## 1. 概述

### 1.1 v0.2 定位

v0.2 是 IvyFlow 的 **多平台适配层** 版本。在 v0.1 单一平台（Claude Code）的基础上，扩展到 **7 个平台**，并为每个平台提供正确的 Skill/Rule/Hook 渲染。Skill 结构保持单体（不拆分），避免将状态机重新编码为文件系统结构。

### 1.2 与 v0.1 的核心差异

| 维度 | v0.1（已交付） | v0.2（目标） |
|------|---------------|-------------|
| 平台数 | 1（Claude Code） | **7**（+ CodeBuddy / Cursor / Copilot / Windsurf / Trae / Qoder） |
| Skill 结构 | 1 个 ivy-dev-workflow 单体 | **1 个**（维持单体，增加 phase router） |
| rules 格式 | 仅 md | **md + mdc + copilot instructions** per-platform 渲染 |
| Rule 文件写位置 | `.claude/rules/` | 各平台 rulesDir 动态决定 |
| PreToolUse Hook | 无 | **Windsurf 平台** 支持 |
| CLI 命令 | 3 个（init / status / validate） | **4 个**（+ doctor） |
| E2E 测试 | 仅 Claude Code | **7 平台 × init 流程** |

### 1.3 设计原则

- **优先平台扩展**：rules 格式转换和 Skill 分发依赖多平台验证，必须先做
- **不引入新外部依赖**：v0.2 所有功能基于现有依赖（commander / @inquirer / yaml / openspec）
- **不做平台抽象层**：各平台差异以 per-platform render 函数处理，不设统一 `Platform` 接口注册表
- **物理拆分代替逻辑抽象**：render 按平台拆为多个 ≤30 行小文件，但不引入 `Renderer` 接口或 transformer 注册表
- **向后兼容**：v0.1 生成的 .ivy/project.yaml 和 .ivy.yaml 可直接被 v0.2 读取
- **克制阈值**：任何设计如果感觉在"建平台"而不是"增强 v0.1"，立即收敛
- **doctor 边界**：仅做 local invariant check（文件存在/格式正确），不做 system state inference / telemetry / CI 替代

### 1.4 明确不做（v0.2）

- Skill 按阶段拆分（5 个独立 Skill）→ 维持 1 个 + phase router
- 技术栈检测与 Skill 推荐系统 → v0.3+
- `ivy uninstall` 命令 → v0.3
- `ivy update` 命令 → v0.3
- PreToolUse Hook（除 Windsurf 外 4 个平台）→ v0.3
- 采纳率 Session Boundary 追踪 → v0.3
- 安全 PII 扫描规则 → v0.3
- `ivy analytics` / `ivy dashboard` 命令 → v0.3
- Platform 抽象注册表（通用 Platform 接口）→ 不做
- rules 统一语义转换引擎 → 不做
- 多 Change 并行管理 → v0.3
- GitNexus 集成 → v0.4

---

## 2. 架构变更

### 2.1 目录结构变化（仅列 v0.2 新增/变更部分）

```
ivy/
├── src/
│   ├── commands/
│   │   └── doctor.ts              # 新增 — ivy doctor 命令
│   ├── core/
│   │   ├── platforms.ts           # 变更 — 7 平台配置常量（纯数据，无接口）
│   │   ├── detect.ts              # 变更 — 多平台自动检测
│   │   ├── skills.ts              # 变更 — manifest.json 扩展 + per-platform 渲染
│   │   ├── render/                # 新增 — 物理拆分（无框架，仅文件分隔，防止 render.ts 上帝化）
│   │   │   ├── index.ts           #   公共导出 + format 路由（≈20 行）
│   │   │   ├── rule-mdc.ts        #   Cursor mdc 渲染（≈25 行）
│   │   │   ├── rule-copilot.ts    #   Copilot instructions 渲染（≈30 行）
│   │   │   └── hook-windsurf.ts   #   Windsurf Hook 渲染（≈15 行）
│   │   └── types.ts               # 变更 — 仅扩展 HookFormat 字面量类型
│   └── utils/
├── assets/
│   ├── manifest.json              # 变更 — 1 个 Skill，4 个 rules（按平台扩展）
│   ├── skills/
│   │   └── ivy/
│   │       ├── SKILL.md           # 变更 — 增加 phase router 段落
│   │       └── references/
│   │           ├── phase-state-machine.md   # 新增
│   │           └── cross-cutting.md         # 新增
│   └── rules/
│       └── ivy-phase-guard.md     # 不变（VCS 中的权威版本）
```

### 2.2 v0.2 新增数据流

```
ivy init v0.2
  │
  ├─ 1. 多平台检测（detect.ts 增强版）
  │     └─ 检查 ~/.* + cwd 各平台的 detectionPath → [claude, codebuddy, cursor...]
  │
  ├─ 2. 依赖安装（保持不变）
  │     └─ OpenSpec CLI（openspec.ts）
  │
  ├─ 3. Skill 分发（skills.ts — per-platform render）
  │     ├─ 读取 ivy/SKILL.md + references/
  │     ├─ 对每个选中平台 render():
  │     │   ├─ skills → 写入 skills/ivy/SKILL.md（内容相同，路径不同）
  │     │   └─ rules → per-platform render 后写入 rulesDir
  │     └─ CLI 打印各平台安装位置
  │
  ├─ 4. Hook 安装（render.ts → renderHookForWindsurf）
  │     └─ Windsurf 平台 → render 成 windsurf 格式 Hook，写入 .windsurf/hooks/
  │
  └─ 5. 创建 .ivy/ 目录 + 写入 project.yaml（保持不变）
```

### 2.3 向后兼容策略

- `.ivy/project.yaml` v0.1 格式 → v0.2 直接读取，无 schema 破坏
- `.claude/skills/ivy-dev-workflow/` 旧目录 → v0.2 `ivy init` 保持覆盖写行为（与 v0.1 相同）
- `openspec/changes/*/.ivy.yaml` v0.1 phase 字段 → v0.2 兼容
- render.ts 不引入新的 yaml schema 字段，无迁移成本

---

## 3. Sprint 2.1：多平台扩展

### 3.1 平台配置常量

v0.2 不设 `Platform` 接口注册表。平台信息存储为纯配置常量，不实现统一抽象层：

```typescript
// src/core/platforms.ts（v0.2 — 纯数据，无 interface）
export type RuleFormat = 'md' | 'mdc' | 'copilot';
export type HookFormat = 'claude-code' | 'windsurf-json';

interface Platform {
  id: string;
  name: string;
  skillsDir: string;
  /** Tool id passed to `openspec init --tools <id>`. Empty string = skip openspec for this platform. */
  openspecToolId: string;
  rulesDir: string;
  rulesFormat: RuleFormat;
  /** Whether the platform supports PreToolUse hooks. */
  supportsHooks?: boolean;
  hookFormat?: HookFormat;
}

const PLATFORMS: Platform[] = [
  { id: 'claude',          name: 'Claude Code',      skillsDir: '.claude',
    openspecToolId: 'claude', rulesDir: 'rules',   rulesFormat: 'md',
    supportsHooks: true, hookFormat: 'claude-code' },
  { id: 'codebuddy',       name: 'CodeBuddy',        skillsDir: '.codebuddy',
    openspecToolId: '',     rulesDir: 'rules',   rulesFormat: 'md' },
  { id: 'cursor',          name: 'Cursor',           skillsDir: '.cursor',
    openspecToolId: '',     rulesDir: 'rules',   rulesFormat: 'mdc' },
  { id: 'github-copilot',  name: 'GitHub Copilot',   skillsDir: '.github',
    openspecToolId: '',     rulesDir: '',        rulesFormat: 'copilot' },
  { id: 'windsurf',        name: 'Windsurf',         skillsDir: '.windsurf',
    openspecToolId: '',     rulesDir: 'rules',   rulesFormat: 'md',
    supportsHooks: true,   hookFormat: 'windsurf-json',
    hookPath: 'hooks/ivy-phase-guard.json' },
  { id: 'trae',            name: 'Trae',             skillsDir: '.trae',
    openspecToolId: '',     rulesDir: 'rules',   rulesFormat: 'md' },
  { id: 'qoder',            name: 'Qoder',            skillsDir: '.qoder',
    openspecToolId: '',     rulesDir: 'rules',   rulesFormat: 'md' },
];
```

**设计要点**：
- 没有 `Platform` 接口 → 没有全局 PLATFORMS 数组注册表 → 没有 get/setPlatform 等方法
- `openspecToolId` 仅在 claude 上有值，其余平台为空字符串 → OpenSpec init 只在至少一个选中平台有非空 tool id 时执行
- `hookFormat` 仅在 `claude-code` 和 `windsurf-json` 上设置，其他平台不占位
- `detectionPath` 不放在 Platform 类型中，而是由独立的 `CONFIDENCE_BY_PATH` 多路径探测表管理

### 3.2 平台自动检测（detect.ts 增强）

引入轻量 confidence 评分（不引入策略注册表），用多路径优先级探测决定权重。每个平台有 2-4 条探测路径，按 1.0→0.8→0.6 顺序首次命中即停止：

```typescript
// src/core/detect.ts（v0.2 — 返回平台列表 + confidence + detected 布尔）
export type Confidence = 1.0 | 0.8 | 0.6;

export interface PlatformDetectResult {
  platform: Platform;
  detected: boolean;      // 至少有一条路径命中
  confidence: Confidence; // 命中最高的优先级值（未命中时默认 0.6）
  matchedPath: string;    // 命中的具体路径
}

// 多路径探测表（硬编码，不暴露；priority 顺序：1.0 → 0.8 → 0.6）
export const CONFIDENCE_BY_PATH: Record<string, PathCheck[]> = {
  claude: [
    { rel: '.claude/settings.json', confidence: 1.0 },
    { rel: '.claude/skills',        confidence: 0.8 },
    { rel: '.claude',               confidence: 0.6 },
  ],
  cursor: [
    { rel: '.cursor/settings.json', confidence: 1.0 },
    { rel: '.cursor/rules',         confidence: 0.8 },
    { rel: '.cursor',               confidence: 0.6 },
  ],
  // ...
};

export function detectPlatforms(projectPath: string): Promise<PlatformDetectResult[]> {
  // 遍历所有 7 平台，对每个平台按 CONFIDENCE_BY_PATH 优先级探测
  // 首次命中即返回该 confidence；全部未命中则 detected=false, confidence=0.6
}
```

**交互层规则**：
- `confidence === 1.0` → CLI 默认勾选
- `confidence === 0.8` → 默认勾选 + 黄色提示
- `confidence === 0.6` → **默认不勾选**，标注"低置信度，请手动确认"

### 3.3 render/ — 物理拆分（按平台分文件，无框架）

**核心约束**：不设 IR 中间层、不设 `Renderer` 接口、不设 transformer 注册表。每个平台一个文件，每个文件 ≤30 行。`index.ts` 仅做 switch 转发。

```typescript
// src/core/render/index.ts（≈26 行 — 唯一的入口，仅转发）
import { renderRuleAsMdc } from './rule-mdc';
import { renderRuleAsCopilot } from './rule-copilot';
export { renderHookForWindsurf } from './hook-windsurf';

export function renderRule(format: 'md' | 'mdc' | 'copilot', mdContent: string): string {
  if (format === 'md') return mdContent;
  if (format === 'mdc') return renderRuleAsMdc(mdContent);
  if (format === 'copilot') return renderRuleAsCopilot(mdContent);
  throw new Error(`unsupported ruleFormat: ${String(format)}`);
}
```

```typescript
// src/core/render/rule-mdc.ts（≈17 行）
const FRONTMATTER = [
  '---',
  'description: IvyFlow phase guard — enforces 9-step workflow per phase',
  'globs: ["**/*"]',
  'alwaysApply: true',
  '---',
  '',
].join('\n');

export function renderRuleAsMdc(mdContent: string): string {
  return FRONTMATTER + mdContent;
}
```

```typescript
// src/core/render/rule-copilot.ts（≈38 行）
// 按行级正则分类：✅/DO /MUST/SHALL→ DO 段；❌/DO NOT/MUST NOT/禁止→ DO NOT 段
export function renderRuleAsCopilot(content: string): string {
  const dos: string[] = [];
  const donts: string[] = [];
  for (const raw of content.split('\n')) {
    const kind = classify(raw);
    if (!kind) continue;
    (kind === 'do' ? dos : donts).push(`- ${raw.replace(/^[-*]\s*/, '').trim()}`);
  }
  return `# IvyFlow phase guard\n\n## DO\n${dos.join('\n')}\n\n## DO NOT\n${donts.join('\n')}\n`;
}
function classify(line: string): 'do' | 'dont' | null { /* 行级正则匹配 */ return null; }
```

```typescript
// src/core/render/hook-windsurf.ts（≈19 行）
export function renderHookForWindsurf(): string {
  const hook = {
    name: 'ivy-phase-guard',
    event: 'PreToolUse',
    match: { tools: ['Edit', 'Write', 'NotebookEdit'] },
    command: 'ivy validate',
    blockOnNonZeroExit: true,
    description: 'IvyFlow phase guard — blocks code edits in non-build phases',
  };
  return JSON.stringify(hook, null, 2) + '\n';
}
```

**为什么与 v0.2 设计初稿不同**：初稿假设 Windsurf Hook API 使用 `tool_events.before` + 内嵌脚本，实际基于 Windsurf 官方文档发现其 Hook 接口使用 `event: 'PreToolUse'` + `blockOnNonZeroExit` 模式。此差异是**设计稿修正**而非实现偏离。

**为什么物理拆分而非逻辑抽象**：
- 防止 `render.ts` 在 v0.3 演化为 `Platform abstraction core`
- 新增平台 = 新增一个 ≤30 行文件 + index.ts 加一个 case，不动其他文件
- 单文件职责单一 → diff/PR review 范围最小化
- 仍然零框架：没有接口、没有注册表、没有依赖注入

### 3.4 Windsurf Hook 安装（不设通用 hooks.ts）

不抽象 hooks.ts 为通用 Hook 引擎。Windsurf Hook 安装在 `skills.ts` 的 `installIvyHookForPlatform` 函数中，通过 `platform.hookFormat === 'windsurf-json'` 门控：

```typescript
// 在 skills.ts 中（而非内联在 init 命令中）：
export async function installIvyHookForPlatform(
  baseDir: string, platform: Platform, overwrite: boolean, scope: InstallScope,
): Promise<HookInstallResult> {
  if (platform.hookFormat !== 'windsurf-json' || !platform.hookPath) {
    return { installed: false, path: '', reason: 'platform-has-no-rendered-hook' };
  }
  const dest = path.join(baseDir, getPlatformSkillsDir(platform, scope), platform.hookPath);
  const content = renderHookForWindsurf();
  await ensureDir(path.dirname(dest));
  await writeFile(dest, content);
  return { installed: true, path: dest };
}
```

### 3.5 `ivy init` 多平台交互流程

```
$ ivy init --standard

  ╔════════════════════════════════╗
  ║  IvyFlow v0.2 — 初始化向导    ║
  ╚════════════════════════════════╝

  🔍 检测到的 AI 编码平台：
    ✅ Claude Code      (~/.claude/settings.json)         [conf 1.0]
    ✅ Cursor           (.cursor/rules/)                   [conf 0.8]
    ✅ Trae             (.trae/rules/)                     [conf 0.8]
    ❌ GitHub Copilot   (.github/ 未找到)
    ❌ Windsurf         (.windsurf/ 未找到)
    ❌ CodeBuddy        (.codebuddy/ 未找到)
    ❌ Qoder            (.qoder/ 未找到)

  选择要安装的平台：[空格多选；conf<0.8 默认不勾选]
  > ☑ Claude Code  ☑ Cursor  ☑ Trae

  📋 执行计划：
    ├─ 安装 Ivy Skill + Rules → 选定平台
    ├─ （格式随平台自动转换: md / mdc / copilot instructions）
    └─ 创建 .ivy/project.yaml

  确认执行？[Y/n]
```

---

## 4. Sprint 2.2：Skill 结构优化

### 4.1 设计决策

**不拆分 Skill**。基于审计结论：

> 状态机不应该被重新编码为文件系统结构。v0.1 的 `ivy-dev-workflow` 单体 Skill 已包含完整工作流。只需在单体入口增加 **phase router**，无需创建 4 个子 Skill。

### 4.2 ivy/SKILL.md — 单体 + phase router

**强制结构约束**：单文件按四个语义区块组织（不拆文件，但拆语义）。每个区块职责单一，防止逻辑互相污染：

```markdown
# Ivy — AI 编码 Agent 工作流强约束器

<!-- ============================================================ -->
<!-- BLOCK 1: ROUTER (only logic, no rules)                       -->
<!-- ============================================================ -->

## 阶段自动检测

读取 `.ivy/project.yaml` 或 `openspec/changes/*/.ivy.yaml` 获取当前阶段：

- `open`    → 进入 Open 模式（只允许文档操作）
- `design`  → 进入 Design 模式（只允许文档操作）
- `build`   → 进入 Build 模式（允许代码读写）
- `verify`  → 进入 Verify 模式（仅修复编译/测试错误）
- `archive` → 进入 Archive 模式（只读，仅生成报告）
- 无阶段信息 → 从 P0（前置条件检测）开始

<!-- ============================================================ -->
<!-- BLOCK 2: CONSTRAINTS (global rules, no routing)              -->
<!-- ============================================================ -->

## 阶段切换约束

| 当前阶段 | 允许切换到               |
|---------|-------------------------|
| open    | design, build           |
| design  | build, open             |
| build   | verify, design          |
| verify  | archive, build          |
| archive | （终态，不可继续修改）   |

<!-- ============================================================ -->
<!-- BLOCK 3: VARIABLES (runtime template, no logic)              -->
<!-- ============================================================ -->

## 核心变量模板

{PROJECT_TYPE}: backend | frontend | fullstack
{BACKEND_STACK}: spring-boot | express | django | go | rust
{BUILD_TOOL}: maven | gradle | npm | pnpm | go | cargo
{TEST_FRAMEWORK}: vitest | jest | pytest | junit | go-test

<!-- ============================================================ -->
<!-- BLOCK 4: REFERENCES (external links only)                    -->
<!-- ============================================================ -->

## 参考文档

- [阶段状态机与完整工作流](references/phase-state-machine.md)
- [安全护栏与可观测性](references/cross-cutting.md)
```

**区块边界规则**（防止 SKILL.md 演化为不可维护巨石）：
- 区块之间用 HTML 注释标记，不可省略
- 任何新规则必须明确归属一个区块；跨区块的内容拆出为新 reference 文件
- 单区块不超过 50 行；超出立即拆到 references/

**设计要点**：
- 删除所有子 Skill 拆分内容（ivy-open / ivy-build / ivy-verify / ivy-archive）
- 将 5 阶段别名层整合到 SKILL.md 的表中，不需要额外文件
- references/ 仅保留 2 个跨阶段共享文件，原 265 个 references 文件不纳入 v0.2 资产分发
- SKILL.md 预计 ~150 行（满足 ≤200 行约束）

### 4.3 manifest.json v2

```json
{
  "version": "0.2.0",
  "schemaVersion": 2,
  "skills": [
    "ivy/SKILL.md",
    "ivy/references/explore-fast-track.md",
    "ivy/references/step8-9-closure.md",
    "ivy/references/phase-state-machine.md",
    "ivy/references/cross-cutting.md"
  ],
  "rules": [
    "ivy-phase-guard.md"
  ],
  "hooks": {
    "claude-code": {
      "type": "static",
      "asset": "ivy-git-prepush.sh",
      "installPath": ".git/hooks/pre-push"
    },
    "windsurf": {
      "type": "rendered",
      "renderer": "windsurf-json",
      "installPathRelativeToSkillsDir": "hooks/ivy-phase-guard.json"
    }
  }
}
```

**与 v0.2 设计初稿的不同**：
- hooks 从简单字符串升级为结构化对象（`{type, asset/installPath/renderer}`），支持 static vs rendered 两种分发策略
- 新增 `schemaVersion: 2` 字段标识 manifest schema 版本
- 删除 `languages[]` 数组（YAGNI — 当前中英文 Skill 内容一致，不需要单独的 skillsDir）

---

## 5. Sprint 2.3：质量完善与发布

### 5.1 ivy doctor 命令

**职责边界**（防止 doctor 演化为隐性 CI / telemetry 子系统）：
- ✅ **只做 local invariant check**：文件存在 / 格式合法 / 版本字段匹配
- ❌ **不做 system state inference**：不推断"用户应该怎么做"，不追踪"上次操作"
- ❌ **不与 CI 重叠**：不跑测试、不跑构建、不调用任何 npm script
- ❌ **不与 telemetry 混合**：不上报、不写本地日志、不写 `.ivy/health.json` 之类状态文件
- ❌ **不与 install 冲突**：`--fix` 仅做"补齐缺失文件"，不做配置迁移、不重写已存在文件

**输出语义固定**：每条 check 必须落入 `passed | warning | failed` 三态之一，不引入 `info` / `skipped` 等中间态。
```typescript
// src/commands/doctor.ts — 新增
export async function runDoctor(options: { fix?: boolean }): Promise<number> {
  const checks: Array<{ name: string; status: 'passed' | 'warning' | 'failed'; detail: string }> = [];

  // 1. .ivy/project.yaml 存在 + schema 版本
  const yamlResult = await checkProjectYaml(cwd);
  checks.push(yamlResult.result);

  // 2. 从 project.yaml 读取已安装平台列表
  const installed = await resolveInstalledPlatforms(yaml);

  // 3-5. 为每个已安装平台检查 skills / rules / hooks 完整性
  for (const p of installed) {
    checks.push(await checkSkillsForPlatform(cwd, p, scope));
    checks.push(await checkRuleForPlatform(cwd, p, scope));
    checks.push(await checkHookForPlatform(cwd, p, scope));
  }

  // 6. Git Pre-push Hook（scope=project 时）
  checks.push(await checkGitPrePushHook(cwd, scope));

  // 输出报告
  summarize(checks);
  return aggregate(checks) === 'failed' ? 1 : 0;
}
```

**注意**：设计初稿将 OpenSpec CLI 检查列为第 1 项，但在实际实现中移除。理由：与 doctor 的"文件存在性"定位不一致——OpenSpec CLI 是否安装属于开发环境问题而非 IvyFlow 本地不变量。后续若有需要应归入 `openspec --version` 而非 doctor。

**输出格式**：
```
$ ivy doctor

✓ .ivy/project.yaml schema OK (v0.2.0)
✓ platforms recorded (claude, cursor, windsurf)
✓ Claude Code: skills present
✓ Claude Code: rule installed
✓ Claude Code: hook n/a
✓ Cursor: skills present
✓ Cursor: rule installed
✓ Cursor: hook n/a
✓ Windsurf: skills present
✓ Windsurf: rule installed
✓ Windsurf: hook installed
✓ git pre-push hook installed
✓ phase-guard source present
```

### 5.2 端到端测试策略

| 测试用例 | 覆盖范围 | 自动化程度 |
|---------|---------|-----------|
| TC-1 | Claude Code — `ivy init --quick` 完整流程 | 自动（vitest + tmp git repo） |
| TC-2 | Cursor — `ivy init` 识别 `.cursor/rules/` | 自动（模拟 detectionPaths） |
| TC-3 | GitHub Copilot — rules 格式转换为 copilot instructions | 自动（格式转换单元测试） |
| TC-4 | Windsurf — Hook 安装验证 | 自动（模拟 .windsurf 目录） |
| TC-5 | Trae — 识别 `.trae/rules/` 并写入 md 格式 | 自动（参数化测试） |
| TC-6 | Qoder — 识别 `.qoder/rules/` 并写入 md 格式 | 自动（参数化测试） |
| TC-7 | 多平台同时检测 + 选择安装（7 平台并集） | 自动 |
| TC-8 | `ivy doctor` 正常 / 警告 / 失败 三态 | 自动 |
| TC-9 | 向后兼容：v0.1 .ivy/project.yaml → v0.2 读取 | 自动 |

### 5.3 v0.2.0 发布清单

- [ ] 覆盖率 ≥ 80%（新增模块：render.ts / detect.ts / doctor.ts）
- [ ] 新版 `CHANGELOG.md` 记录 Sprint 2.1-2.3 所有变更
- [ ] `README.md` 更新：命令列表增加 `doctor`、平台列表扩展到 5 个
- [ ] `README.zh-CN.md` 同步更新
- [ ] CI 更新：Node 20/22 矩阵确认可以通过
- [ ] `npm publish` 发布 v0.2.0

---

## 6. v0.1 → v0.2 数据模型变更

### 6.1 .ivy/project.yaml（无破坏性变更）

v0.2 新增字段，旧文件可直接使用：

```yaml
# v0.2 新增字段
version: "0.2.0"
last_migration: "2026-06-16T00:00:00Z"
platforms: [claude, cursor]          # 安装时用户选择的平台

# 新增：检测结果（init 交互界面用）
detected_platforms:
  - id: claude
    confidence: 1.0
    matched: .claude/settings.json
  - id: cursor
    confidence: 0.8
    matched: .cursor/rules
```

**与 v0.2 设计初稿的不同**：
- `platforms: string[]` 是新增的核心安装字段，设计初稿遗漏。所有 check（doctor、status）以 `platforms` 为准
- `detected_platforms[]` 中每个条目简化为 `{id, confidence, matched}`：`matched` 是触发检测的 probe 相对路径；per-platform `scope` 删除（scope 由 project.yaml 顶层决定）

### 6.2 openspec/changes/*/.ivy.yaml（无变更）

v0.2 不修改 `openspec/changes/*/.ivy.yaml` 的 schema。phase 字段和 adoption-lite 字段保持不变。

### 6.3 assets/manifest.json（v1 → v2）

```diff
- "version": "0.1.0",
+ "version": "0.2.0",
+ "schemaVersion": 2,
- "skills": ["ivy/SKILL.md"],
+ "skills": [
+   "ivy/SKILL.md",
+   "ivy/references/explore-fast-track.md",
+   "ivy/references/step8-9-closure.md",
+   "ivy/references/phase-state-machine.md",
+   "ivy/references/cross-cutting.md"
+ ],
+ "rules": ["ivy-phase-guard.md"],
+ "hooks": {
+   "claude-code": {
+     "type": "static",
+     "asset": "ivy-git-prepush.sh",
+     "installPath": ".git/hooks/pre-push"
+   },
+   "windsurf": {
+     "type": "rendered",
+     "renderer": "windsurf-json",
+     "installPathRelativeToSkillsDir": "hooks/ivy-phase-guard.json"
+   }
+ }
```

**与 v0.2 设计初稿的不同**：hooks 从 `{windurf: "path.sh"}` 字符串升级为 `{type, asset/renderer}` 结构化对象，支持 static（直接复制资产文件）vs rendered（通过 render() 函数构建）两种分发策略。`schemaVersion` 字段帮助未来的 schema 迁移检测。

---

## 7. 工作量估算与执行建议

### 7.1 按 Sprint 估算

| Sprint | 功能数 | 新增文件 | 预估代码行 | 关键复杂度 | 建议耗时 |
|--------|--------|---------|-----------|-----------|---------|
| Sprint 2.1 平台扩展 | 5 | `render/` 4 文件 + detect 增强 | ~390 | rules 格式转换（md → mdc / copilot）+ confidence 评分 + 7 平台数据填充 | 3 周 |
| Sprint 2.2 Skill 优化 | 3 | 无（仅修订 SKILL.md + 区块约束） | ~150 | SKILL.md 编写 + phase router 段落 | 2 周 |
| Sprint 2.3 质量发布 | 3 | `doctor.ts` | ~200 | E2E 测试环境搭建 + doctor 边界守护 | 2 周 |
| **合计** | **11** | **~6 个文件** | **~740** | — | **7 周** |

### 7.2 建议执行顺序

```
Week 1-3  Sprint 2.1  平台扩展（7 平台 + render 函数 + 检测增强）
Week 4-5  Sprint 2.2  Skill 优化（phase router + manifest v2 + references）
Week 6-7  Sprint 2.3  质量门禁（doctor + E2E + 发布 v0.2.0）
```

**理由**：平台扩展是分发前提，Skill 优化是交付核心，质量完善最后做。

### 7.3 合规项（v0.2）

- 平台 Logo / 名称在使用时需确认商标合规
- GitHub Copilot 的 instructions 格式需要与 GitHub 官方文档一致

---

## 8. 附录：明确延期到 v0.3 的功能

> 设计稿中有但 v0.2 不做。保持焦点，避免范围蔓延。

| 功能 | 延期理由 | 目标版本 |
|------|---------|---------|
| PreToolUse Hook（非 Windsurf 平台） | Hook 接口稳定性待验证 | v0.3 |
| 技术栈检测 + Skill 推荐 | 生态未形成，无 usage data | v0.3+ |
| Skill 按阶段拆分（5 个子 Skill） | 状态机不应编码为文件系统 | 不做 |
| Platform 抽象注册表 | 过度设计，per-platform render 即可 | 不做 |
| `ivy uninstall` | v0.1 已说明不提供 | v0.3 |
| `ivy update` | 同上 | v0.3 |
| Session Boundary 采纳率 | 需要 PreToolUse Hook 配合 | v0.3 |
| `ivy analytics` / `ivy dashboard` | 采纳率数据不够 | v0.3 |
| PII 扫描规则 | 安全专项，独立版本 | v0.3 |
| GitNexus 集成 | 弱依赖，非核心 | v0.4 |

---

## 9. v0.2 → v0.3 演化约束层（防爆炸）

> v0.2 用"显式分支 + 单 Skill + 物理拆分"换取了短期工程稳定性，但延后了系统复杂度。本章是 v0.3 演化时必须遵守的硬性约束，违反任意一条都意味着 IvyFlow 在向"AI 编码 OS 层"漂移，需要立即停下评估。

### 9.1 render/ 演化红线

**触发评估**：当 `src/core/render/` 下文件数 ≥ 8，或单文件超过 50 行时。

| 红线 | 必须停下评估的理由 |
|------|------------------|
| 出现 `Renderer` interface / `BaseRenderer` 抽象类 | 已经在建抽象层，违反"per-platform render"原则 |
| 出现 `transformers.register(...)` 注册表 | 引入了 plugin system，复杂度爆炸前兆 |
| 出现统一 IR / AST 中间表示 | 立即推翻，回到字符串直接转换 |
| 多个平台共用一个文件超过 100 行 | 拆文件，不要拆类 |

**允许的演化**：新增平台 = 新增 `render/rule-<platform>.ts` 文件 + index.ts 加 case。仅此。

### 9.2 detect.ts 演化红线

| 红线 | 替代方案 |
|------|---------|
| confidence 评分超过 4 个层级（如 0.4/0.6/0.8/1.0/1.2） | 维持 3 层；要细分先质疑是否应该 |
| 出现 `DetectionStrategy` 接口 + 注册 | 改用硬编码 if/else 链，不引入 strategy pattern |
| 检测逻辑读取 git history / 进程状态 / 网络 | 仅读文件系统；越界即拒 |

### 9.3 SKILL.md 演化红线

| 红线 | 处理 |
|------|------|
| 任意区块超过 50 行 | 拆出到 `references/<topic>.md` |
| 出现第 5 个语义区块 | 评估是否已经在做"Skill OS"，需要倒推 |
| 出现条件分支嵌套深度 ≥ 3 | router 逻辑应该展平为查找表 |
| references/ 文件数 ≥ 10 | 重新审视是否应该回到 v0.1 单文件 |

### 9.4 doctor.ts 演化红线

| 红线 | 替代方案 |
|------|---------|
| 出现 `--telemetry` / `--report` / `--upload` 类参数 | 由独立 `ivy analytics` 命令承担（v0.3+） |
| check 项依赖网络 / 远程 API | 拒绝合并；doctor 必须可离线运行 |
| 输出新增 `info` / `skipped` 等中间态 | 强制压回 passed/warning/failed |
| `--fix` 修改已存在文件的内容 | 拒绝；只允许补齐缺失，不允许覆盖 |

### 9.5 Skill 推荐系统的演化前置条件（v0.3+）

v0.3 若要重启 Skill 推荐系统，必须先满足以下硬性前置条件，否则继续延期：

1. **真实 usage data ≥ 100 个项目**：从 v0.2 自愿上报的安装数据中获取，无数据不动
2. **明确的边际收益证据**：推荐 Skill 的采纳率比无推荐场景高 ≥ 30%
3. **不引入 SaaS 组件**：推荐数据库可下发为静态 JSON 文件，不依赖在线服务
4. **不与 OpenSpec 工作流耦合**：Skill 推荐独立于 phase machine，不影响主流程

### 9.6 Hook 系统的演化前置条件（v0.3+）

| 平台 | 启用前置条件 |
|------|-------------|
| Cursor PreToolUse Hook | 平台官方 Hook 接口 stable 标记，且 ≥ 6 个月无 breaking change |
| VSCode Extension Hook | 不做（与 IvyFlow 的"轻量分发"定位冲突，需要专项立项） |
| Git Hook 扩展（pre-commit / commit-msg） | 仅做兜底；主防线永远是 Rule 层，不是 Hook |

### 9.7 一句话约束

> **v0.3 的任何设计如果让你想起"做一个平台"，立即停下。IvyFlow 的定位永远是"分发器 + 强约束器"，不是 OS。**

---

> **文档维护者**：IvyFlow Team
> **最后更新**：2026-06-16
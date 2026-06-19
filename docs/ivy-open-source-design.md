# IvyFlow 开源工具详细设计文档

> 版本：v1.0 | 日期：2026-06-19 | 状态：Draft

---

## 目录

1. [项目概述与市场定位](#1-项目概述与市场定位)
2. [架构设计](#2-架构设计)
3. [CLI 命令设计](#3-cli-命令设计)
4. [核心模块设计](#4-核心模块设计)
5. [多平台支持策略](#5-多平台支持策略)
6. [Skill 拆分架构](#6-skill-拆分架构)
7. [依赖管理](#7-依赖管理)
8. [技术栈 Skill 推荐系统](#8-技术栈-skill-推荐系统)
9. [阶段守卫：三重防御体系](#9-阶段守卫三重防御体系)
10. [代码采纳率与分析系统](#10-代码采纳率与分析系统)
11. [安全架构](#11-安全架构)
12. [数据模型](#12-数据模型)
13. [多期多阶段研发路线图](#13-多期多阶段研发路线图)
14. [附录](#14-附录)

---

## 1. 项目概述与市场定位

### 1.1 项目定义

IvyFlow 是一个面向 AI 辅助开发的工作流 CLI 工具，将 `ivy-dev-workflow` Skill 中经过验证的 9 步开发方法论产品化为可分发、可安装的开源软件。

**核心价值主张**：为 AI 编码助手提供"企业级严谨工作流"，通过 OpenSpec 规范驱动开发 + 三重阶段守卫 + Advisor 建议闭环（Suggest→Feedback→Calibrate→Explain）+ 代码采纳率透明分析，解决 AI 辅助开发的随意性和不可追溯性问题。

### 1.2 与竞品的差异化

| 维度 | Comet | IvyFlow |
|------|-------|-----|
| 定位 | 快速启动，全平台覆盖 | 企业级严谨工作流 |
| 平台数量 | 30+ | 5-10 精选（初期） |
| 核心方法论 | OpenSpec + Superpowers | OpenSpec + 9步工作流 + 采纳率 |
| 阶段守卫 | PreToolUse Hook 单向 | 三重防御（AI Hook + Rule + Git Hook） |
| 采纳率 | 无 | 会话级四层归因 + CLI 分析面板 |
| 安全 | 无专项 | 三层安全（Pre/In/Post）+ PII 扫描 |
| 技术栈检测 | 无 | 自动检测 + Skill 推荐 |
| 技能拆分 | 无（comet + comet-open 仅两个） | 按阶段拆分（ivy-open/ivy-build/ivy-verify/ivy-archive） |

### 1.3 IvyFlow 不做的事

- **不做代码智能引擎**：依赖 OpenSpec（规范管理）+ GitNexus（代码分析），不自己实现
- **不做通用 AI Agent**：不替代 Devin/OpenHands/Copilot Workspace
- **不做 SaaS 平台**：纯 CLI 工具，本地运行，不上传数据
- **不重复造轮子**：Skill 分发借用 `npx skills` 生态，不创建独立包管理器

---

## 2. 架构设计

### 2.1 技术选型

| 层级 | 选择 | 理由 |
|------|------|------|
| 语言 | TypeScript | 与 Comet 一致的 npm 生态，类型安全 |
| CLI 框架 | commander | Comet 同款，成熟稳定 |
| 交互提示 | @inquirer/prompts | Comet 同款 |
| 包管理 | npm（全局安装） | 对标 `@rpamis/comet` |
| 构建 | tsc | 简单可靠 |
| 测试 | vitest | Comet 同款 |
| 代码规范 | eslint + prettier | 标准实践 |

### 2.2 目录结构

```
ivy/
├── bin/
│   └── ivy.js                  # CLI 入口（package.json bin 指向）
├── src/
│   ├── cli/
│   │   └── index.ts            # commander 命令注册
│   ├── commands/
│   │   ├── init.ts             # ivy init
│   │   ├── status.ts           # ivy status
│   │   ├── doctor.ts           # ivy doctor
│   │   ├── analytics.ts        # ivy analytics
│   │   ├── dashboard.ts        # ivy dashboard
│   │   ├── update.ts           # ivy update
│   │   └── uninstall.ts        # ivy uninstall
│   ├── core/
│   │   ├── platforms.ts        # 平台定义与检测
│   │   ├── skills.ts           # Skill 分发引擎
│   │   ├── openspec.ts         # OpenSpec 安装管理
│   │   ├── gitnexus.ts         # GitNexus 安装管理（可选）
│   │   ├── hooks.ts            # Hook 安装与合并
│   │   ├── rules.ts            # Rule 文件分发（含格式转换）
│   │   ├── tech-stack.ts       # 技术栈检测与 Skill 推荐
│   │   ├── adoption.ts         # 采纳率数据采集与聚合
│   │   ├── security.ts         # 安全规则生成
│   │   ├── phase-guard.ts      # 阶段守卫逻辑
│   │   └── types.ts            # 公共类型定义
│   └── utils/
│       ├── fs.ts               # 文件系统工具
│       ├── git.ts              # Git 操作封装
│       └── logger.ts           # 日志工具
├── assets/
│   ├── manifest.json           # 资源清单
│   ├── skills/                 # Ivy 技能文件
│   │   ├── ivy/
│   │   │   ├── SKILL.md        # 主 Skill（入口 + 自动阶段检测）
│   │   │   └── references/     # 渐进式加载的参考文件
│   │   ├── ivy-open/
│   │   │   └── SKILL.md        # Open 阶段 Skill
│   │   ├── ivy-build/
│   │   │   └── SKILL.md        # Build 阶段 Skill
│   │   ├── ivy-verify/
│   │   │   └── SKILL.md        # Verify 阶段 Skill
│   │   └── ivy-archive/
│   │       └── SKILL.md        # Archive 阶段 Skill
│   ├── rules/
│   │   ├── ivy-phase-guard.md  # 阶段守卫规则
│   │   ├── ivy-security.md     # 安全规则（PII 检测）
│   │   └── ivy-conventions.md  # 编码约定
│   ├── hooks/
│   │   └── ivy-hook-guard.sh   # PreToolUse Hook 脚本
│   └── skill-recommendations.json  # 技术栈→Skill 映射表
├── docs/
│   └── ivy-open-source-design.md   # 本文档
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

### 2.3 数据流架构

```
用户执行 ivy init
     │
     ├─ 1. 平台检测（platforms.ts）
     │     └─ 扫描 ~/.* 目录 → 识别已安装的 AI 编码工具
     │
     ├─ 2. 技术栈检测（tech-stack.ts）
     │     └─ 读取 package.json/pom.xml/go.mod/Cargo.toml → 推断技术栈
     │
     ├─ 3. 依赖安装
     │     ├─ OpenSpec CLI（openspec.ts）
     │     └─ GitNexus CLI（gitnexus.ts，可选）
     │
     ├─ 4. Skill 分发（skills.ts）
     │     ├─ 复制 assets/skills/ → 平台 skills 目录
     │     └─ 推荐技术栈匹配 Skill（tech-stack.ts → skill-recommendations.json）
     │
     ├─ 5. Rule 文件分发（rules.ts）
     │     └─ 按平台格式转换后复制到 rulesDir
     │
     ├─ 6. Hook 安装（hooks.ts）
     │     └─ 仅支持 Hooks 的平台，合并到已有配置
     │
     └─ 7. 工作目录初始化
           └─ 创建 .ivy/ + docs/superpowers/ 等目录
```

---

## 3. CLI 命令设计

### 3.1 命令清单

```
ivy init       [--scope global|project] [--platforms <ids>] [--ci-mode full|no]
ivy status     [--change <name>]
ivy doctor     [--fix]
ivy analytics  [--change <name>] [--project] [--period 7d|30d|90d]
ivy dashboard  [--change <name>]
ivy update     [--check]
ivy uninstall  [--scope global|project] [--platforms <ids>]
```

### 3.2 ivy init

核心初始化命令，对标 `comet init`，增加技术栈检测和 Skill 推荐环节。

**流程**：

```
┌─────────────────────────────────────────┐
│ 1. Banner 展示                          │
│ 2. 检测已安装的 AI 编码平台              │
│ 3. 选择安装范围（global / project）      │
│ 4. 确认目标平台（多选）                  │
│ 5. 技术栈检测 → 展示推荐 Skill           │
│ 6. 展示行动计划（Plan）                  │
│    ├─ 安装 OpenSpec CLI                 │
│    ├─ 安装 GitNexus CLI（可选）         │
│    ├─ 分发 Ivy Skills                   │
│    ├─ 分发 Rules                        │
│    ├─ 安装 Hooks（如平台支持）           │
│    └─ 创建工作目录                       │
│ 7. 用户确认后执行                        │
│ 8. 展示安装摘要                          │
└─────────────────────────────────────────┘
```

### 3.3 ivy analytics

采纳率分析面板，对标 `rtk gain` 的风格。

```
$ ivy analytics --project

📊 Ivy 项目采纳率分析
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

项目: pubTech/ai-code-tracker
统计周期: 最近 30 天
会话总数: 23

📈 采纳漏斗
  总生成代码:  12,450 行
  进入审查:    10,820 行 (86.9%)
  通过审查:     9,530 行 (76.5%)
  合并入主分支:  8,870 行 (71.2%)

📋 按置信度分层
  高置信度 (会话边界):   5,230 行 (58.9%)
  中置信度 (Git Notes):  2,410 行 (27.2%)
  低置信度 (文件估算):   1,230 行 (13.9%)

🏷️ 按模块分解
  src/core/        3,210 行 (36.2%)
  src/commands/    2,150 行 (24.2%)
  src/cli/          890 行 (10.0%)
  ...

⏱️ Token 效率
  平均 tokens/采纳行: 342
  节省 Token (vs 手写): ~68%
```

### 3.4 ivy dashboard

单变更的实时仪表盘。

```
$ ivy dashboard --change add-dark-theme

╔══════════════════════════════════════════╗
║  变更: add-dark-theme                   ║
║  阶段: Verify                            ║
╠══════════════════════════════════════════╣
║  采纳漏斗                                ║
║  ████████████░░░░ 生成   1,200 行       ║
║  ██████████░░░░░░ 审查   1,050 行 (87%) ║
║  ████████░░░░░░░░ 编译通过 980 行 (82%) ║
╚══════════════════════════════════════════╝
```

### 3.5 ivy doctor

系统健康检查，对标 `comet doctor`。

```
$ ivy doctor

🔍 Ivy 健康检查
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ OpenSpec CLI: 已安装 (v1.2.3)
✅ GitNexus CLI: 已安装 (v2.1.0)
✅ GitNexus Index: 新鲜 (更新于 10 分钟前)
⚠️  Git Hook: 未安装 (运行 ivy init --fix 修复)
✅ Ivy Skills: 已安装 (ivy, ivy-open, ivy-build, ivy-verify, ivy-archive)
✅ Ivy Rules: 已安装
✅ Ivy Hooks: 已安装 (Claude Code)
```

---

## 4. 核心模块设计

### 4.1 platforms.ts — 平台定义与检测

```typescript
// src/core/types.ts
export type InstallScope = 'global' | 'project';

// src/core/platforms.ts
export interface Platform {
  id: string;
  name: string;
  skillsDir: string;
  globalSkillsDir?: string;
  detectionPaths?: string[];
  openspecToolId: string;
  rulesDir?: string;
  rulesBaseDir?: string;
  rulesFormat?: 'md' | 'mdc' | 'copilot';
  supportsHooks?: boolean;
  hookFormat?: 'claude-code' | 'gemini' | 'windsurf' | 'copilot' | 'qwen' | 'kiro' | 'qoder';
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
  {
    id: 'codebuddy',
    name: 'CodeBuddy Code',
    skillsDir: '.codebuddy',
    openspecToolId: 'codebuddy',
    rulesDir: 'rules',
    rulesFormat: 'md',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    skillsDir: '.cursor',
    globalSkillsDir: '.cursor',
    openspecToolId: 'cursor',
    rulesDir: 'rules',
    rulesFormat: 'mdc',
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    skillsDir: '.github',
    globalSkillsDir: '.github',
    detectionPaths: ['.github/copilot-instructions.md'],
    openspecToolId: 'github-copilot',
    rulesDir: 'instructions',
    rulesFormat: 'copilot',
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    skillsDir: '.windsurf',
    globalSkillsDir: '.windsurf',
    openspecToolId: 'windsurf',
    rulesDir: 'rules',
    rulesFormat: 'md',
    supportsHooks: true,
    hookFormat: 'windsurf',
  },
  // 后续版本扩展: cline, gemini, amazon-q, qwen, roocode...
];

export function getPlatformSkillsDir(platform: Platform, scope: InstallScope): string {
  if (scope === 'global' && platform.globalSkillsDir) {
    return platform.globalSkillsDir;
  }
  return platform.skillsDir;
}
```

### 4.2 skills.ts — Skill 分发引擎

核心功能：
- `copyIvySkillsForPlatform()`：读取 manifest.json，将 skill 文件复制到目标平台 skills 目录
- `copyIvyRulesForPlatform()`：复制 rules 并转换为平台特定格式
- `installIvyHooksForPlatform()`：安装 PreToolUse Hook（仅支持 Hooks 的平台）
- `createWorkingDirs()`：创建 `.ivy/` + `docs/superpowers/` 等工作目录

```typescript
// src/core/skills.ts
export async function copyIvySkillsForPlatform(
  platform: Platform,
  scope: InstallScope,
  projectPath: string,
): Promise<void> {
  const manifest = await loadManifest();
  const targetDir = path.join(
    scope === 'global' ? os.homedir() : projectPath,
    getPlatformSkillsDir(platform, scope),
    'skills',
  );
  await mkdir(targetDir, { recursive: true });

  for (const skillPath of manifest.skills) {
    const src = path.join(ASSETS_DIR, 'skills', skillPath);
    const dest = path.join(targetDir, skillPath);
    await mkdir(path.dirname(dest), { recursive: true });
    await cp(src, dest, { force: true });
  }
}
```

### 4.3 openspec.ts — OpenSpec 安装管理

参考 Comet 的 `src/core/openspec.ts` 实现：

```typescript
// src/core/openspec.ts
export async function ensureOpenSpecCli(scope: InstallScope, projectPath: string): Promise<boolean> {
  const alreadyInstalled = isCommandAvailable('openspec');
  const npmArgs = scope === 'global'
    ? ['install', '-g', '@fission-ai/openspec@latest']
    : ['install', '@fission-ai/openspec@latest'];

  try {
    execFileSync(getNpmExecutable(), npmArgs, {
      cwd: projectPath,
      stdio: 'inherit',
      timeout: 120_000,
    });
    return isCommandAvailable('openspec');
  } catch (error) {
    if (alreadyInstalled) return true; // 降级：使用已有版本
    return false;
  }
}

export async function installOpenSpec(
  projectPath: string,
  toolIds: string[],
  scope: InstallScope,
): Promise<'installed' | 'failed'> {
  const cliReady = await ensureOpenSpecCli(scope, projectPath);
  if (!cliReady) return 'failed';

  // 生成临时配置（包含所有 workflow）
  const openspecEnv = createOpenSpecAllWorkflowsEnv();
  try {
    const invocation = buildOpenSpecInitInvocation(projectPath, toolIds, scope);
    execFileSync(invocation.command, invocation.args, {
      cwd: projectPath,
      env: openspecEnv.env,
      stdio: 'inherit',
      timeout: 120_000,
    });
    return 'installed';
  } catch (error) {
    console.error(`OpenSpec init failed: ${(error as Error).message}`);
    return 'failed';
  } finally {
    fs.rmSync(openspecEnv.configHome, { recursive: true, force: true });
  }
}
```

### 4.4 gitnexus.ts — GitNexus 可选安装

```typescript
// src/core/gitnexus.ts
export async function ensureGitNexusCli(): Promise<boolean> {
  try {
    execFileSync(getNpmExecutable(), ['install', '-g', '@colbymchenry/gitnexus@latest'], {
      stdio: 'inherit',
      timeout: 120_000,
    });
    return isCommandAvailable('gitnexus');
  } catch {
    return false;
  }
}

export async function installGitNexus(
  projectPath: string,
): Promise<'installed' | 'skipped' | 'failed'> {
  const cliReady = await ensureGitNexusCli();
  if (!cliReady) return 'failed';

  try {
    execFileSync('gitnexus', ['init', '-i'], {
      cwd: projectPath,
      stdio: 'inherit',
      timeout: 300_000, // 首次索引可能较慢
    });
    return 'installed';
  } catch (error) {
    console.error(`GitNexus init failed: ${(error as Error).message}`);
    return 'failed';
  }
}
```

### 4.5 tech-stack.ts — 技术栈检测与推荐

```typescript
// src/core/tech-stack.ts
export interface TechStackProfile {
  language: string;
  framework?: string;
  buildTool: string;
  testFramework?: string;
  frontendFramework?: string;
}

export function detectTechStack(projectPath: string): TechStackProfile {
  const files = fs.readdirSync(projectPath);

  // 检测后端
  if (files.includes('pom.xml')) {
    return detectMavenProject(projectPath);
  }
  if (files.includes('build.gradle') || files.includes('build.gradle.kts')) {
    return detectGradleProject(projectPath);
  }
  if (files.includes('package.json')) {
    return detectNodeProject(projectPath);
  }
  if (files.includes('go.mod')) {
    return detectGoProject(projectPath);
  }
  if (files.includes('Cargo.toml')) {
    return detectRustProject(projectPath);
  }

  return { language: 'unknown', buildTool: 'unknown' };
}

export function getSkillRecommendations(
  profile: TechStackProfile,
): Array<{ name: string; reason: string; installCmd: string }> {
  const mapping = loadSkillRecommendations();
  // 从 skill-recommendations.json 中查找匹配的 Skill
  // 过滤条件：≥1K 安装量，来自可信源（vercel-labs, anthropics, microsoft 等）
  return mapping
    .filter((s) => matchProfile(s, profile) && s.installs >= 1000 && TRUSTED_SOURCES.has(s.source))
    .map((s) => ({
      name: s.name,
      reason: s.reason,
      installCmd: `npx skills add ${s.package} -y`,
    }));
}
```

### 4.6 adoption.ts — 采纳率数据采集

```typescript
// src/core/adoption.ts
export interface SessionEvent {
  timestamp: string;
  event_type: 'file_change' | 'phase_transition' | 'review_result' | 'merge';
  file_path?: string;
  lines_added?: number;
  lines_removed?: number;
  attribution_confidence: 'high' | 'medium' | 'low';
  metadata?: Record<string, unknown>;
}

export interface SessionMetrics {
  total_lines_generated: number;
  lines_reviewed: number;
  lines_passed_review: number;
  lines_compiled: number;
  lines_merged: number;
  tokens_consumed: number;
  files_by_confidence: {
    high: string[];
    medium: string[];
    low: string[];
  };
}

export function initAdoptionTracking(changeDir: string): void {
  // 在 openspec/changes/<name>/.ivy.yaml 中初始化 metrics 字段
  const ivyYamlPath = path.join(changeDir, '.ivy.yaml');
  const existing = fs.existsSync(ivyYamlPath)
    ? yaml.parse(fs.readFileSync(ivyYamlPath, 'utf-8'))
    : {};
  existing.metrics = {
    total_lines_generated: 0,
    lines_reviewed: 0,
    lines_passed_review: 0,
    lines_compiled: 0,
    lines_merged: 0,
    tokens_consumed: 0,
    files_by_confidence: { high: [], medium: [], low: [] },
    updated_at: new Date().toISOString(),
  };
  fs.writeFileSync(ivyYamlPath, yaml.stringify(existing), 'utf-8');
}

export function aggregateProjectMetrics(projectPath: string): ProjectAdoptionMetrics {
  const changesDir = path.join(projectPath, 'openspec', 'changes');
  const sessionsDir = path.join(projectPath, '.ivy', 'sessions');
  // 遍历所有 change .ivy.yaml + session.yaml，聚合统计
  // ...
}
```

---

## 5. 多平台支持策略

### 5.1 分阶段平台覆盖

| 阶段 | 平台数量 | 包含平台 |
|------|----------|---------|
| Phase 1 (M1-M2) | 2 | Claude Code, CodeBuddy |
| Phase 2 (M3-M4) | 5 | + Cursor, GitHub Copilot, Windsurf |
| Phase 3 (M5-M6) | 8 | + Cline, Amazon Q, Gemini CLI |
| Phase 4 (M7+) | 15+ | 按社区需求扩展 |

**初期聚焦理由**：
- Claude Code 和 CodeBuddy 是 Ivy 的诞生平台，功能验证最充分
- 先做深做精 2-5 个平台，比覆盖 30+ 平台但体验粗糙更有价值
- Comet 的 30+ 平台覆盖是其主要卖点，Ivy 不应正面竞争，而应差异化

### 5.2 平台能力矩阵

| 平台 | Skills | Rules | Hooks | 规则格式 | Hook 格式 |
|------|--------|-------|-------|----------|-----------|
| Claude Code | ✅ | ✅ | ✅ | md | claude-code |
| CodeBuddy | ✅ | ✅ | ❌ | md | — |
| Cursor | ✅ | ✅ | ❌ | mdc | — |
| GitHub Copilot | ✅ | ✅ | ❌ | copilot | — |
| Windsurf | ✅ | ✅ | ✅ | md | windsurf |

Hook 不支持的平台，只能依赖 Rule 文件 + Git Hook 提供阶段守卫。

---

## 6. Skill 拆分架构

### 6.1 拆分原则

按 Ivy 工作流的五阶段别名拆分，每个阶段一个独立 Skill：

```
ivy (入口 + 自动阶段检测)
├── ivy-open     (P0/P1/P3 + 步骤一 + Brainstorming + 步骤二)
├── ivy-build    (步骤三：代码实现)
├── ivy-verify   (步骤四-七：质量门禁)
└── ivy-archive  (步骤八-九：收尾归档)
```

**额外 Skill（Phase 3+）**：
- `ivy-hotfix`：紧急修复热修复流程（简化版工作流）
- `ivy-tweak`：小修改快速通道（跳过文档阶段）

### 6.2 Skill 触发路由

`ivy/SKILL.md` 作为入口，自动检测当前所处阶段并加载对应子 Skill：

```markdown
## 阶段检测与路由

读取 `.ivy/project.yaml` 中的 `current_phase` 字段：
- `open` → 触发 ivy-open
- `build` → 触发 ivy-build
- `verify` → 触发 ivy-verify
- `archive` → 触发 ivy-archive
- 无状态 → 从 P0 开始完整流程
```

### 6.3 manifest.json 设计

```json
{
  "version": "0.1.0",
  "skills": [
    "ivy/SKILL.md",
    "ivy/references/phase-state-machine.md",
    "ivy/references/cross-cutting.md",
    "ivy-open/SKILL.md",
    "ivy-build/SKILL.md",
    "ivy-verify/SKILL.md",
    "ivy-archive/SKILL.md"
  ],
  "rules": [
    "ivy/rules/ivy-phase-guard.md",
    "ivy/rules/ivy-security.md"
  ],
  "hooks": {
    "ivy/hooks/ivy-hook-guard.sh": {
      "matcher": "Write|Edit",
      "description": "Block code writes in wrong Ivy phase"
    }
  },
  "languages": [
    { "id": "en", "name": "English", "skillsDir": "skills" },
    { "id": "zh", "name": "中文", "skillsDir": "skills-zh" }
  ]
}
```

---

## 7. 依赖管理

### 7.1 依赖策略总览

| 依赖 | 类型 | 安装方式 | 降级策略 |
|------|------|----------|----------|
| OpenSpec | 强依赖 | `ivy init` 自动安装 | 已有旧版本可降级使用 |
| GitNexus | 弱依赖 | `ivy init` 可选安装 | `CI_MODE=no` 跳过所有 GitNexus 调用 |
| npx skills | 间接依赖 | 用户手动执行推荐命令 | 不依赖 |

### 7.2 OpenSpec 集成

**为什么不自己实现**：
- OpenSpec 已是行业标准（Comet 同样依赖它）
- `@fission-ai/openspec` 提供了完整的 change/spec/artifact 生命周期管理
- 重复造轮子违反 YAGNI 原则

**长期抽象计划（Phase 4+）**：
- 定义 `SpecManager` 接口抽象 OpenSpec 操作
- 默认实现 `OpenSpecManager` 封装 `openspec` CLI 调用
- 未来可替换为其他实现（自定义 Spec 引擎 / 其他规范工具）

```typescript
interface SpecManager {
  createChange(name: string): Promise<void>;
  getStatus(name: string): Promise<ChangeStatus>;
  getInstructions(artifactId: string, changeName: string): Promise<Instructions>;
  listChanges(): Promise<Change[]>;
}
```

### 7.3 GitNexus 集成

**CI_MODE 三元状态**：

| CI_MODE | 含义 | GitNexus 行为 |
|---------|------|---------------|
| full | 索引健康，完整功能 | 所有 6 个 ci_* 接口可用 |
| stale | 索引存在但过期（>30min 未更新） | 降级使用，标记为 stale |
| no | 无索引/未安装 | 静默降级到 grep/rg |

**P0.5 索引健康复检**：
- 启动时检查 `.codegraph/last_index_time`
- >30min 过期 → 提示用户：(1) 重建索引 (2) 降级为 stale (3) 降级为 no
- 归档时触发 `gitnexus analyze` 更新索引

---

## 8. 技术栈 Skill 推荐系统

### 8.1 设计原则

- **不调用 find-skills**：网络调用不可靠，结果不稳定
- **内部映射表**：`assets/skill-recommendations.json` 维护精选推荐
- **质量过滤**：仅推荐 ≥1K 安装量 + 可信源头的 Skill
- **用户选择权**：展示推荐但不自动安装

### 8.2 skill-recommendations.json 结构

```json
{
  "mappings": [
    {
      "language": "java",
      "framework": "spring-boot",
      "skills": [
        {
          "name": "Spring Boot Best Practices",
          "package": "spring-projects/agent-skills@spring-boot",
          "reason": "Spring Boot 项目推荐，提供控制器/服务/仓库层最佳实践",
          "installs": 5000,
          "source": "spring-projects",
          "category": "backend"
        }
      ]
    },
    {
      "language": "typescript",
      "framework": "react",
      "skills": [
        {
          "name": "React Best Practices",
          "package": "vercel-labs/agent-skills@react-best-practices",
          "reason": "React 项目推荐，Vercel 官方出品，提供组件设计/状态管理/性能优化指导",
          "installs": 185000,
          "source": "vercel-labs",
          "category": "frontend"
        }
      ]
    },
    {
      "language": "python",
      "framework": "fastapi",
      "skills": [
        {
          "name": "FastAPI Best Practices",
          "package": "fastapi-community/agent-skills@fastapi",
          "reason": "FastAPI 项目推荐，提供路由/依赖注入/中间件最佳实践",
          "installs": 3200,
          "source": "fastapi-community",
          "category": "backend"
        }
      ]
    }
  ],
  "trustedSources": [
    "vercel-labs",
    "anthropics",
    "microsoft",
    "spring-projects",
    "fastapi-community"
  ]
}
```

### 8.3 推荐展示格式

```
$ ivy init

检测到技术栈: TypeScript + React + Vite
构建工具: npm
测试框架: vitest

📦 推荐安装以下技术栈匹配的 Skill：

  1. React Best Practices (185K 安装, Vercel 官方)
     → npx skills add vercel-labs/agent-skills@react-best-practices -y
  2. TypeScript Best Practices (45K 安装, Microsoft)
     → npx skills add microsoft/agent-skills@typescript -y
  3. Vite Plugin Development (2.1K 安装, 社区)
     → npx skills add vite-community/agent-skills@vite -y

是否执行安装？[Y/n/逐个选择]
```

---

## 9. 阶段守卫：三重防御体系

### 9.1 体系架构

```
Layer 1: AI Hook (PreToolUse)
  ├─ 适用平台: Claude Code, Windsurf 等
  ├─ 拦截: Write, Edit
  └─ 行为: 检查 phase，非 Build 阶段禁止写入代码
        ┌──────────┐
        │ AI Hook  │ ← 最内层，实时拦截
        └────┬─────┘
             │ 如果平台不支持 Hook → 降级到 Layer 2
             ▼
Layer 2: Rule 文件
  ├─ 适用平台: 所有平台
  ├─ 机制: Skill 加载时注入到 Agent 上下文
  └─ 行为: 约束 Agent 在当前阶段可执行的操作
        ┌──────────┐
        │ Rule 文件│ ← 中层，行为约束
        └────┬─────┘
             │ 如果 Agent 忽略 Rule → 降级到 Layer 3
             ▼
Layer 3: Git Hook (commit-msg / pre-push)
  ├─ 适用平台: 所有平台（标准 Git）
  ├─ 机制: .git/hooks/pre-push 检查 .ivy.yaml phase
  └─ 行为: 非 Archive 阶段不允许推送
        ┌──────────┐
        │ Git Hook │ ← 最外层，提交时拦截
        └──────────┘
```

### 9.2 AI Hook 实现

```bash
#!/bin/bash
# assets/hooks/ivy-hook-guard.sh
# Ivy PreToolUse Hook — 阶段守卫

# 读取 stdin JSON
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')

# 获取当前 phase
CHANGE_DIR=$(echo "$INPUT" | jq -r '.cwd // ""')
IVY_YAML="$CHANGE_DIR/openspec/changes/*/.ivy.yaml"
if [ ! -f "$IVY_YAML" ]; then
  exit 0  # 非 Ivy 管理项目，放行
fi

PHASE=$(yq eval '.phase' "$IVY_YAML" 2>/dev/null || echo "unknown")

# Phase-based 白名单
case "$PHASE" in
  "open"|"design")
    # open/design 阶段：仅允许文档写入
    if [[ "$TOOL_NAME" =~ ^(Write|Edit)$ ]] && [[ ! "$FILE_PATH" =~ \.md$ ]]; then
      echo '{"decision": "block", "reason": "当前为 Open/Design 阶段，禁止写入代码文件。请先通过步骤二文档确认。"}'
      exit 0
    fi
    ;;
  "archive")
    # 归档阶段：仅允许文档
    if [[ "$TOOL_NAME" =~ ^(Write|Edit)$ ]] && [[ ! "$FILE_PATH" =~ \.md$ ]]; then
      echo '{"decision": "block", "reason": "当前为 Archive 阶段，禁止修改任何文件和代码。如需修改请创建新 Change。"}'
      exit 0
    fi
    ;;
esac

# 放行
echo '{"decision": "allow"}'
```

### 9.3 Rule 文件

```markdown
# Ivy Phase Guard Rule

## 当前阶段感知

读取 `.ivy/project.yaml` 或 `openspec/changes/*/.ivy.yaml` 确认当前阶段。

## 阶段约束

### Open 阶段 (phase: open)
- ✅ 允许: 读取文件、修改 .md 文档、修改 openspec/changes/ 下的 artifacts
- ❌ 禁止: 创建或修改任何源代码文件

### Design 阶段 (phase: design)
- ✅ 允许: 读取文件、修改 .md 文档
- ❌ 禁止: 创建或修改任何源代码文件

### Build 阶段 (phase: build)
- ✅ 允许: 创建/修改源代码文件、测试文件
- ❌ 禁止: 修改 proposal.md / design.md（如有偏差应记录到 Delta Spec）

### Verify 阶段 (phase: verify)
- ✅ 允许: 修复编译错误和测试失败
- ❌ 禁止: 新增功能代码、修改 API 签名（如有需要应回到 Design 阶段）

### Archive 阶段 (phase: archive)
- ✅ 允许: 生成实现报告、执行归档操作
- ❌ 禁止: 任何代码修改
```

### 9.4 Git Hook

```bash
#!/bin/bash
# .git/hooks/pre-push (由 ivy init 安装)

# 检查当前是否在 Ivy 管理的 Change 分支上
CHANGE=$(git branch --show-current | grep -oP '(?<=ivy/).*' 2>/dev/null || echo "")
if [ -z "$CHANGE" ]; then
  exit 0
fi

IVY_YAML="openspec/changes/$CHANGE/.ivy.yaml"
if [ ! -f "$IVY_YAML" ]; then
  exit 0
fi

PHASE=$(yq eval '.phase' "$IVY_YAML" 2>/dev/null || echo "unknown")
if [ "$PHASE" != "archive" ]; then
  echo "❌ Ivy Guard: 当前 Change '$CHANGE' 处于 '$PHASE' 阶段，不允许推送。"
  echo "   请完成全部质量门禁并进入 Archive 阶段后再推送。"
  echo "   使用 'ivy status --change $CHANGE' 查看当前进度。"
  exit 1
fi
```

---

## 10. 代码采纳率与分析系统

### 10.1 数据采集架构

```
代码生成
   ├─ Agent 保存文件 → 记录到 events.jsonl
   │   └─ ivy-hook-guard.sh 放行时记录 file_path + lines + confidence
   │
   ├─ 步骤四代码审查 → 更新 .ivy.yaml metrics
   │   └─ 审查结果: passed / rejected / modified
   │
   ├─ 步骤五编译 → 更新编译通过行数
   │   └─ git diff --stat HEAD~1
   │
   ├─ 步骤九归档 → 聚合 session 数据
   │   └─ 写入 .ivy/project.yaml 累计统计
   │
   └─ 合并到主分支 → 最终采纳行数
       └─ git diff main...HEAD --stat
```

### 10.2 四层归因置信度

| 层级 | 方法 | 置信度 | 适用场景 |
|------|------|--------|----------|
| Session Boundary | Agent 会话开始时记录基线，结束时对比 | >90% | Hook 支持平台，单会话变更 |
| Git Notes | `git notes add -m "ai-generated" <commit>` | 70-85% | 多会话合并提交 |
| File-Level Mix | 按文件粒度估算 human vs AI 行比例 | 60-80% | 无 Hook / 无 Note 兜底 |
| Code Features | 模式识别（变量命名风格、注释密度等） | <60% | 仅参考，不纳入统计 |

### 10.3 存储结构

```
.ivy/
├── project.yaml              # 项目级聚合历史
├── sessions/
│   └── {session-name}/
│       ├── session.yaml      # 会话级详细指标
│       └── events.jsonl      # 追加式事件日志
│
openspec/changes/
└── {change-name}/
    └── .ivy.yaml             # 变更级指标（metrics 字段扩展）
```

### 10.4 session.yaml 数据模型

```yaml
session_name: "2026-06-16-add-dark-theme"
started_at: "2026-06-16T09:00:00Z"
ended_at: "2026-06-16T11:30:00Z"
phase: "archive"
ci_mode: "full"

adoption_funnel:
  total_lines_generated: 1200
  lines_entered_review: 1050
  lines_passed_review: 980
  lines_compiled: 950
  lines_merged: 920

files:
  high_confidence: ["src/theme/dark.css", "src/components/ThemeToggle.tsx"]
  medium_confidence: ["src/theme/colors.ts"]
  low_confidence: []

token_usage:
  total: 245000
  estimated_cost_usd: 1.23

timeline:
  - phase: "open"
    started: "09:00"
    ended: "09:45"
    events: 12
  - phase: "build"
    started: "09:50"
    ended: "10:50"
    events: 48
  - phase: "verify"
    started: "10:50"
    ended: "11:20"
    events: 16
  - phase: "archive"
    started: "11:20"
    ended: "11:30"
    events: 4
```

### 10.5 events.jsonl 格式

每行一个 JSON 对象，追加写入：

```jsonl
{"ts":"2026-06-16T09:30:00Z","event":"file_change","file":"src/theme/dark.css","lines_added":120,"lines_removed":0,"confidence":"high","tool":"Write"}
{"ts":"2026-06-16T09:35:00Z","event":"phase_transition","from":"open","to":"design"}
{"ts":"2026-06-16T10:00:00Z","event":"file_change","file":"src/theme/colors.ts","lines_added":45,"lines_removed":5,"confidence":"medium","tool":"Edit"}
{"ts":"2026-06-16T10:50:00Z","event":"review_result","file":"src/theme/dark.css","passed":true,"issues":0}
```

---

## 11. 安全架构

### 11.1 三层安全体系

```
Layer 1: Pre-execution（事前防御）
  ├─ PII 扫描规则（内嵌在 Rule 文件中）
  ├─ 安全编码规范（OWASP Top 10 覆盖）
  └─ 敏感文件黑名单检测（.env, credentials.json 等）

Layer 2: In-execution（事中控制）
  ├─ Agent prompt 中的安全约束
  ├─ 阶段守卫限制文件操作范围
  └─ Git Hook 阻止敏感文件提交

Layer 3: Post-review（事后审核）
  ├─ 步骤四代码审查（security-reviewer Agent）
  ├─ 步骤六安全测试（full 模式）
  └─ 步骤八安全风险评估（implementation-report.md）
```

### 11.2 为什么不在 Hook 层做 PII 拦截

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| Hook 拦截 | 实时、不可绕过 | 只有部分平台支持；增加写延迟；Hook 脚本权限要求高 | ❌ 不采用 |
| Rule 文件 | 全平台覆盖；零延迟 | 依赖 Agent 遵守；可被绕过 | ✅ 主方案 |
| Git Hook | 全平台覆盖；提交时检查 | 仅在 git commit 时触发 | ✅ 辅助方案 |
| 代码审查 | 深度分析；可检测复杂模式 | 事后发现 | ✅ 兜底方案 |

### 11.3 PII 扫描规则

内嵌在 `assets/rules/ivy-security.md` 中，作为 Rule 文件分发给所有平台：

```markdown
# Ivy Security Rules

## PII Detection (Pre-execution)

在写入或修改代码文件前，检查文件内容是否包含以下模式。
如果检测到，立即暂停并要求用户确认。

### 身份证号（中国）
- 模式: `/\b[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/`
- 处理: 使用 `MASKED_ID_${seq}` 替换

### 手机号（中国）
- 模式: `/\b1[3-9]\d{9}\b/`
- 处理: 使用 `MASKED_PHONE_${seq}` 替换

### 邮箱
- 模式: `/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/`
- 处理: 确认是否为测试邮箱，非测试邮箱使用 `test-${seq}@example.com` 替换

### API Key / Token
- 模式: `/(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|AKIA[A-Z0-9]{16})/`
- 处理: 使用环境变量替换，禁止硬编码

### 数据库连接串
- 模式: `/(jdbc|mongodb|mysql|postgresql):\/\/[^:]+:[^@]+@/`
- 处理: 使用环境变量替换

## 重要提示

以上 AI 扫描不等同于专业 SAST 工具（SonarQube、Checkmarx）。
生产环境部署前必须通过专业安全审查。
```

---

## 12. 数据模型

### 12.1 .ivy/project.yaml

```yaml
# 项目级 Ivy 配置
project: "pubTech/ai-code-tracker"
created_at: "2026-06-01T00:00:00Z"
updated_at: "2026-06-16T12:00:00Z"

# 当前活动变更
active_changes:
  - "add-dark-theme-support"
  - "fix-auth-token-refresh"

# 工作流默认配置
defaults:
  ci_mode: "full"         # full | stale | no
  scope: "project"
  language: "zh"

# 累计采纳率（所有变更的汇总）
cumulative_adoption:
  total_sessions: 47
  total_lines_generated: 52340
  total_lines_merged: 38920
  overall_adoption_rate: 0.744
  updated_at: "2026-06-16T11:30:00Z"

# 采纳率趋势（最近 90 天）
adoption_trend:
  - period: "2026-06-W2"
    sessions: 12
    lines_generated: 8450
    adoption_rate: 0.762
  - period: "2026-06-W1"
    sessions: 8
    lines_generated: 6230
    adoption_rate: 0.735
```

### 12.2 openspec/changes/{name}/.ivy.yaml

```yaml
# 变更级 Ivy 元数据（扩展 OpenSpec 的 .openspec.yaml）
phase: "verify"           # open | design | build | verify | archive
phase_updated_at: "2026-06-16T11:20:00Z"
ci_mode: "full"
index_updated_at: "2026-06-16T09:05:00Z"
index_rebuild: false

# 工作流开关
execution_mode: "standard"           # quick | standard | full
implementation_strategy: "parallel-agents"  # direct | parallel-agents | sdd
enable_code_review: true
enable_unit_test: true
enable_e2e_test: false
enable_security_review: false

# 采纳率指标
metrics:
  total_lines_generated: 1200
  lines_entered_review: 1050
  lines_passed_review: 980
  lines_compiled: 950
  lines_merged: 920
  tokens_consumed: 245000
  files_by_confidence:
    high: ["src/theme/dark.css", "src/components/ThemeToggle.tsx"]
    medium: ["src/theme/colors.ts"]
    low: []
  updated_at: "2026-06-16T11:30:00Z"

# 安全审查
security:
  pii_scan_passed: true
  security_review_passed: true
  sensitive_files_detected: []
```

### 12.3 事件总线 Schema

```typescript
// 所有事件类型
type IvyEvent =
  | FileChangeEvent
  | PhaseTransitionEvent
  | ReviewResultEvent
  | CompileResultEvent
  | TestResultEvent
  | MergeEvent;

interface FileChangeEvent {
  ts: string;
  event: 'file_change';
  file_path: string;
  lines_added: number;
  lines_removed: number;
  confidence: 'high' | 'medium' | 'low';
  tool: 'Write' | 'Edit' | 'NotebookEdit';
  phase: string;
  agent?: string;
}

interface PhaseTransitionEvent {
  ts: string;
  event: 'phase_transition';
  from: string;
  to: string;
  triggered_by: string;
}

interface ReviewResultEvent {
  ts: string;
  event: 'review_result';
  file_path: string;
  passed: boolean;
  issues: number;
  critical_issues: number;
  reviewer_agent: string;
}

interface CompileResultEvent {
  ts: string;
  event: 'compile_result';
  passed: boolean;
  errors: number;
  warnings: number;
  build_tool: string;
}

interface TestResultEvent {
  ts: string;
  event: 'test_result';
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  coverage_percent?: number;
}

interface MergeEvent {
  ts: string;
  event: 'merge';
  target_branch: string;
  total_lines: number;
  adoption_rate: number;
}
```

---

## 13. 多期多阶段研发路线图

### 13.1 总体时间线

```
Phase 1 (Month 1-2):   核心骨架 — CLI + 2 平台 + 基础技能分发
Phase 2 (Month 3-4):   技能拆分 — 5 平台 + 技能拆分架构 + 技术栈推荐
Phase 3 (Month 5-6):   守卫运营 — 三重防御 + 采纳率 0.1 + 安全规则
Phase 4 (Month 7-8):   v1.0 里程碑 — 8 平台 + 采纳率 1.0 + 文档完善
Phase 5 (Month 9+):    生态建设 — 15+ 平台 + 社区贡献 + CI/CD 集成
```

---

### Phase 1 — 核心骨架（Month 1-2）

**目标**：可安装、可分发的 CLI 工具，覆盖 Claude Code + CodeBuddy 两个平台。

**里程碑**：`ivy init` 可完成 OpenSpec + Ivy Skills 的全自动安装。

#### Sprint 1.1: 项目基础设施（Week 1-2）

| 任务 | 描述 | 产出 |
|------|------|------|
| 1.1.1 | 搭建 TypeScript 项目骨架 | `package.json`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.mjs` |
| 1.1.2 | 实现 CLI 入口 + commander 注册 | `bin/ivy.js`, `src/cli/index.ts` |
| 1.1.3 | 实现核心类型定义 | `src/core/types.ts` |
| 1.1.4 | 实现 2 平台定义（Claude Code + CodeBuddy） | `src/core/platforms.ts` |
| 1.1.5 | 实现日志工具 + 文件系统工具 | `src/utils/` |

#### Sprint 1.2: Skill 分发引擎（Week 3-4）

| 任务 | 描述 | 产出 |
|------|------|------|
| 1.2.1 | 实现 manifest.json 加载与解析 | `src/core/skills.ts` |
| 1.2.2 | 实现 `copyIvySkillsForPlatform()` | 支持按 manifest 复制 skill 文件到目标平台 |
| 1.2.3 | 实现 `copyIvyRulesForPlatform()` | 支持 md/mdc/copilot 格式转换 |
| 1.2.4 | 编写 assets/manifest.json | 初始包含 ivy 主 Skill |
| 1.2.5 | 单元测试：skills.ts | 覆盖 manifest 解析、平台目录计算、格式转换 |

#### Sprint 1.3: ivy init 命令（Week 5-6）

| 任务 | 描述 | 产出 |
|------|------|------|
| 1.3.1 | 实现 OpenSpec 安装管理 | `src/core/openspec.ts`（参考 Comet 实现） |
| 1.3.2 | 实现平台检测逻辑 | 扫描用户 home 目录检测已安装平台 |
| 1.3.3 | 实现 ivy init 命令 | `src/commands/init.ts` — 完整交互流程 |
| 1.3.4 | 集成测试：ivy init 完整流程 | 在 Claude Code + CodeBuddy 环境验证 |

#### Sprint 1.4: 基础命令 + 发布（Week 7-8）

| 任务 | 描述 | 产出 |
|------|------|------|
| 1.4.1 | 实现 ivy status 命令 | 读取 .ivy.yaml 展示当前阶段 |
| 1.4.2 | 实现 ivy uninstall 命令 | 移除 Ivy 文件 + 恢复配置 |
| 1.4.3 | 编写 README.md | 安装说明、快速开始、命令参考 |
| 1.4.4 | npm 发布 v0.1.0 | `npm publish` |

**Phase 1 交付物**：
```
ivy v0.1.0
├── ivy init       ✅ (2 platforms: Claude Code + CodeBuddy)
├── ivy status     ✅
├── ivy uninstall  ✅
├── README.md      ✅
└── npm package    ✅
```

---

### Phase 2 — 技能拆分（Month 3-4）

**目标**：5 平台覆盖 + ivy-open/ivy-build/ivy-verify/ivy-archive 四个子 Skill + 技术栈 Skill 推荐。

**里程碑**：`ivy init` 展示技术栈推荐，用户按推荐安装 Skill 后具备完整五阶段工作流。

#### Sprint 2.1: 平台扩展（Week 1-2）

| 任务 | 描述 |
|------|------|
| 2.1.1 | 添加 Cursor 平台支持（含 mdc 规则格式转换） |
| 2.1.2 | 添加 GitHub Copilot 平台支持（含 instructions 格式） |
| 2.1.3 | 添加 Windsurf 平台支持（含 Hook） |
| 2.1.4 | 平台自动检测逻辑增强（detectionPaths） |

#### Sprint 2.2: Skill 拆分（Week 3-5）

| 任务 | 描述 |
|------|------|
| 2.2.1 | ivy/SKILL.md — 入口 Skill（自动阶段检测 + 路由） |
| 2.2.2 | ivy-open/SKILL.md — Open 阶段（P0/P1/P3 + 步骤一 + Brainstorming + 步骤二） |
| 2.2.3 | ivy-build/SKILL.md — Build 阶段（步骤三：TDD 实现 + Agent 分派 + Delta Spec） |
| 2.2.4 | ivy-verify/SKILL.md — Verify 阶段（步骤四-七：审查 + 编译 + 测试 + Gate） |
| 2.2.5 | ivy-archive/SKILL.md — Archive 阶段（步骤八-九：报告 + 归档） |
| 2.2.6 | 更新 manifest.json 包含全部 5 个 Skill |

#### Sprint 2.3: 技术栈推荐（Week 6-7）

| 任务 | 描述 |
|------|------|
| 2.3.1 | 实现 `detectTechStack()`（package.json/pom.xml/go.mod/Cargo.toml） |
| 2.3.2 | 编写 `assets/skill-recommendations.json`（10+ 技术栈 → 30+ Skill 映射） |
| 2.3.3 | 实现 `getSkillRecommendations()` |
| 2.3.4 | 集成到 ivy init 流程（Step 5：技术栈检测 + 推荐展示） |
| 2.3.5 | 单元测试：tech-stack.ts |

#### Sprint 2.4: 质量完善 + 发布（Week 8）

| 任务 | 描述 |
|------|------|
| 2.4.1 | ivy doctor 命令 |
| 2.4.2 | 端到端测试（5 平台 × 完整工作流） |
| 2.4.3 | 发布 v0.2.0 |

**Phase 2 交付物**：
```
ivy v0.2.0
├── 5 平台支持 ✅
├── 5 个 Skill（ivy + 4 个子 Skill） ✅
├── 技术栈自动检测 + Skill 推荐 ✅
├── ivy doctor ✅
└── 端到端测试覆盖 ✅
```

---

### Phase 3 — 守卫与运营（Month 5-6）

**目标**：三重阶段守卫 + 代码采纳率 v0.1 + 安全规则体系。

**里程碑**：Ivy 托管项目的阶段越权风险降至零，采纳率数据可视化。

#### Sprint 3.1: 三重阶段守卫（Week 1-3）

| 任务 | 描述 |
|------|------|
| 3.1.1 | 实现 PreToolUse Hook 脚本（ivy-hook-guard.sh） |
| 3.1.2 | 实现 Hook 安装与合并逻辑（`hooks.ts`） |
| 3.1.3 | 编写阶段守卫 Rule 文件（ivy-phase-guard.md） |
| 3.1.4 | 实现 Git Hook 安装（pre-push + commit-msg） |
| 3.1.5 | 集成测试：跨阶段越权尝试 → 三层拦截验证 |

#### Sprint 3.2: 采纳率 v0.1（Week 4-6）

| 任务 | 描述 |
|------|------|
| 3.2.1 | 实现 `initAdoptionTracking()`（.ivy.yaml metrics 初始化） |
| 3.2.2 | 实现 Session Boundary 归因（events.jsonl 追加写入） |
| 3.2.3 | 实现 `aggregateProjectMetrics()`（跨 session 聚合） |
| 3.2.4 | 实现 `ivy analytics` 命令（ASCII 面板输出） |
| 3.2.5 | 单元测试：adoption.ts 所有函数 |

#### Sprint 3.3: 安全体系（Week 7）

| 任务 | 描述 |
|------|------|
| 3.3.1 | 编写 PII 扫描规则（ivy-security.md） |
| 3.3.2 | 实现敏感文件黑名单检查 |
| 3.3.3 | 集成到 ivy init 分发流程 |

#### Sprint 3.4: 发布 v0.3.0（Week 8）

| 任务 | 描述 |
|------|------|
| 3.4.1 | ivy analytics 命令完善 |
| 3.4.2 | 全平台回归测试 |
| 3.4.3 | 发布 v0.3.0 |

**Phase 3 交付物**：
```
ivy v0.3.0
├── 三重阶段守卫（Hook + Rule + Git Hook） ✅
├── 采纳率追踪（session events + 聚合） ✅
├── ivy analytics 命令 ✅
├── PII 扫描规则 ✅
└── 安全审计报告（每个 Change） ✅
```

---

### Phase 4 — v1.0 里程碑（Month 7-8）

**目标**：生产就绪的 v1.0，完善的文档和示例。

#### Sprint 4.1: 平台扩展至 8（Week 1-2）

| 任务 | 描述 |
|------|------|
| 4.1.1 | 添加 Cline 平台支持 |
| 4.1.2 | 添加 Amazon Q Developer 平台支持 |
| 4.1.3 | 添加 Gemini CLI 平台支持 |

#### Sprint 4.2: 采纳率 v1.0（Week 3-4）

| 任务 | 描述 |
|------|------|
| 4.2.1 | 实现 Git Notes 归因层（`git notes add -m "ai-generated"`） |
| 4.2.2 | 实现 File-Level Mix 归因（按文件粒度估算） |
| 4.2.3 | 实现 `ivy dashboard` 命令（单 Change ASCII 仪表盘） |
| 4.2.4 | 采纳率趋势分析（30d/90d 对比） |

#### Sprint 4.3: 文档与测试（Week 5-6）

| 任务 | 描述 |
|------|------|
| 4.3.1 | 用户文档（Getting Started / Command Reference / FAQ） |
| 4.3.2 | 开发者文档（Architecture / Contributing / Release Process） |
| 4.3.3 | 示例项目（Spring Boot + React 完整工作流演示） |
| 4.3.4 | 性能测试（大型项目初始化时间 < 60s） |

#### Sprint 4.4: v1.0 发布（Week 7-8）

| 任务 | 描述 |
|------|------|
| 4.4.1 | 安全审计（第三方） |
| 4.4.2 | CHANGELOG.md 编写 |
| 4.4.3 | 发布 v1.0.0 |
| 4.4.4 | DeepWiki 知识库搭建 |

---

### Phase 5 — 生态建设（Month 9+）

**目标**：社区驱动的生态扩展。

#### 5.1 平台扩展（15+）

- 按社区 PR 需求扩展：RooCode, Continue, KiloCode, Auggie, Kiro, Qwen Code 等
- 建立平台适配贡献指南

#### 5.2 高级工作流

- `ivy-hotfix` Skill（紧急修复简化流程）
- `ivy-tweak` Skill（小修改快速通道）
- 多 Change 并行管理

#### 5.3 CI/CD 集成

- GitHub Actions 集成（`ivy verify --ci`）
- GitLab CI 集成模板
- PR 评论自动展示 ivy analytics

#### 5.4 抽象层

- `SpecManager` 接口抽象（解耦 OpenSpec 依赖）
- 自定义 Backend 支持（替换 GitNexus 为其他代码分析工具）

#### 5.5 社区建设

- 中文 / 英文双语文档
- 贡献者指南（CONTRIBUTING.md）
- RFC 流程（重大变更提案）
- 每月社区会议

---

### 13.2 版本发布节奏

```
v0.1.0  (M2 末)  — 2 platforms, CLI skeleton, ivy init/status/uninstall
v0.2.0  (M4 末)  — 5 platforms, skill split, tech-stack recommendations
v0.3.0  (M6 末)  — triple defense, adoption v0.1, security rules
v0.11.0 (M8)     — Org Insights (Beta), Knowledge Linking, Ecosystem, Knowledge Sync
v0.12.0 (M8+)    — Evidence & Traceability: Evidence Audit, Traceability, Memory Health, Evidence Gate, Org Insights GA
v0.13.0 (M8++)   — Governed Execution: Lifecycle Projection, Decision Protocol, Preset Workflows, Workflow Evidence, Execution Isolation
v1.0.0  (M9+)    — 16 platforms, adoption v1.0, full docs, production-ready
v1.1.0  (M10)    — 15+ platforms, CI/CD integration
v1.2.0  (M12)    — abstraction layer, community contributions
```

### 13.3 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| OpenSpec API 不兼容升级 | 中 | 高 | 抽象层（Phase 4），自动化兼容性测试 |
| 平台 Hook 接口变更 | 低 | 中 | 多平台分散风险，降级到 Rule + Git Hook |
| 采纳率归因准确度争议 | 高 | 中 | 四层置信度透明标注，允许用户 review |
| 竞品（Comet）功能追赶 | 中 | 低 | 差异化定位，不做正面功能竞争 |
| 社区贡献不足 | 中 | 中 | 降低贡献门槛，提供中文文档，主动 outreach |

---

## 14. 附录

### A. 与 Comet 的详细对比

| 维度 | Comet | IvyFlow |
|------|-------|-----|
| **核心方法论** | OpenSpec + Superpowers（平行双星） | OpenSpec + 9步工作流（垂直深度） |
| **技能拆分** | 8 个（comet + open/design/build/verify/archive/hotfix/tweak） | 7 个（ivy + open/build/verify/archive/hotfix/tweak） |
| **平台数量** | 30+（广度优先） | 5-10 精选（深度优先） |
| **阶段守卫** | PreToolUse Hook 单向 | Hook + Rule + Git Hook 三重 |
| **采纳率** | 无 | 四层归因 + CLI 分析面板 |
| **技术栈推荐** | 无 | 自动检测 + 精选 Skill 映射表 |
| **安全** | 无专项 | 三层安全 + PII 扫描规则 |
| **规则格式** | md / mdc / copilot | md / mdc / copilot（与 Comet 一致） |
| **Hook 支持** | 7 种格式 | 2 种初期（claude-code + windsurf） |
| **国际化** | en / zh | en / zh |
| **包名** | `@rpamis/comet` | `ivyflow-cli`（建议） |
| **依赖** | commander + @inquirer/prompts | commander + @inquirer/prompts + js-yaml |
| **脚本工具** | 7 个 bash 脚本（env/guard/state/handoff/archive/validate/hook-guard） | 1 个（hook-guard.sh，Phase 3+ 扩展） |
| **CLI 命令** | 5 个（init/status/doctor/update/uninstall） | 7 个（init/status/doctor/analytics/dashboard/update/uninstall） |
| **代码智能** | CodeGraph 集成 | GitNexus 集成（可选安装） |
| **当前版本** | v0.3.8（已发布） | v0.13.0（已发布） |

---

### A.2 综合能力评分

**评分说明**：每项 0-10 分，0=不具备，5=基本具备但有明显缺陷，10=业界领先。权重按功能重要性分配。

#### 评分总览

| 类别 | Comet | IvyFlow | 差距 | 权重 |
|------|-------|---------|------|------|
| 平台覆盖 | **9.0** | 2.0 | +7.0 | 15% |
| 工作流深度 | 7.0 | **9.0** | -2.0 | 20% |
| 阶段守卫 | 6.0 | **9.0** | -3.0 | 15% |
| 初始化体验 | 8.5 | 3.0 | +5.5 | 10% |
| 代码采纳率 | 0 | **8.5** | -8.5 | 10% |
| 安全机制 | 2.0 | **7.0** | -5.0 | 8% |
| 技术栈生态 | 0 | **6.0** | -6.0 | 5% |
| CLI 工具链 | 7.0 | 2.5 | +4.5 | 7% |
| 文档与测试 | 3.0 | 1.0 | +2.0 | 5% |
| 成熟度 | 7.0 | 0.5 | +6.5 | 5% |
| **加权总分** | **5.85** | **5.03** | **+0.82** | 100% |

---

#### 详细分项评分

##### 1. 平台覆盖（权重 15%）

| 子项 | Comet | IvyFlow |
|------|-------|---------|
| 支持平台总数 | 30+ | 2（设计稿 5-10） |
| 自动平台检测 | ✅ detectionPaths | ✅ 计划支持 |
| 平台配置完整性 | ✅ rulesDir/rulesFormat/hookFormat | ✅ 同等设计 |
| 小众平台支持 | ✅ lingma/bob/forgecode 等 | ❌ 暂无计划 |
| 评分 | **9.0** | **2.0** |

**分析**：Comet 在平台广度上绝对领先，这是其核心卖点。IvyFlow 采取精选策略，初期仅覆盖验证最充分的 Claude Code + CodeBuddy，得分低但属于有意为之的战略取舍。

##### 2. 工作流深度（权重 20%）

| 子项 | Comet | IvyFlow |
|------|-------|---------|
| 工作流阶段数 | 6 阶段（open/design/build/verify/archive + hotfix/tweak） | 9 步 + 5 阶段别名层 |
| 文档生成 | comet-open — 基础 | ivy-open — proposal + design + specs + tasks + test-cases + brainstorming |
| TDD 纪律 | 无明确约束 | RED→GREEN→REFACTOR 强制纪律 |
| Agent 分派 | subagent-dispatch 参考文档 | agent-mapping.md 路由表 + agent-specs.md |
| Delta Spec | 无 | 双层检查 + 反写机制 |
| 质量门禁 | 审查+编译+测试 | 审查+编译+测试+规模评估+Gate验证+Anti-rationalization |
| 上下文管理 | context-recovery.md | 阶段状态机 + 断点恢复协议 + 5轮重读策略 |
| 评分 | **7.0** | **9.0** |

**分析**：IvyFlow 的核心优势领域。9 步工作流在文档生成、TDD 纪律、Agent 分派、Delta Spec 反写等方面比 Comet 更细致严谨。Comet 的工作流更实用主义，覆盖面够但不深。

##### 3. 阶段守卫（权重 15%）

| 子项 | Comet | IvyFlow |
|------|-------|---------|
| PreToolUse Hook | ✅ comet-hook-guard.sh（7 种 hook 格式） | ✅ ivy-hook-guard.sh（初期 2 种格式） |
| Rule 文件 | ✅ comet-phase-guard.md | ✅ ivy-phase-guard.md |
| Git Hook | ❌ 无 | ✅ pre-push + commit-msg |
| 不支持 Hook 的平台 | 降级到仅 Rule | 降级到 Rule + Git Hook |
| 阶段越权防护面 | 2 层（Hook + Rule） | 3 层（Hook + Rule + Git Hook） |
| Hook 脚本复杂 | 适中（仅检查 phase 白名单） | 适中（同等复杂度） |
| 评分 | **6.0** | **9.0** |

**分析**：IvyFlow 的三重防御设计更完备。Comet 缺少 Git Hook 层，意味着 Agent 如果忽略 Hook 和 Rule，代码可以被直接推送。IvyFlow 的 pre-push 检查是最后一道防线。但 IvyFlow 初期 Hook 格式覆盖面少，实际可用性打折。

##### 4. 初始化体验（权重 10%）

| 子项 | Comet | IvyFlow |
|------|-------|---------|
| 交互式安装向导 | ✅ 完整（banner→检测→确认→计划→安装→摘要） | ❌ 设计稿阶段 |
| 自动依赖安装 | ✅ OpenSpec + CodeGraph + Superpowers | ❌ 设计稿阶段 |
| 技术栈检测 | ❌ 无 | ✅ 设计稿（package.json/pom.xml/go.mod/Cargo.toml） |
| Skill 推荐 | ❌ 无 | ✅ 设计稿（精选映射表） |
| 安装范围选择 | ✅ global/project | ✅ 设计稿 |
| --yes 自动模式 | ✅ 支持 | ❌ 设计稿阶段 |
| --json 输出模式 | ✅ 全命令支持 | ❌ 设计稿阶段 |
| 评分 | **8.5** | **3.0** |

**分析**：Comet 已发布的 init 命令是完整产品，IvyFlow 仅在设计阶段。但 IvyFlow 设计中的技术栈检测 + Skill 推荐是差异化亮点，Comet 没有。

##### 5. 代码采纳率（权重 10%）

| 子项 | Comet | IvyFlow |
|------|-------|---------|
| 数据采集 | ❌ 无 | ✅ Session Boundary + Git Notes + File Mix + Code Features |
| 置信度分层 | ❌ 无 | ✅ 四层（>90% / 70-85% / 60-80% / <60%） |
| 存储架构 | ❌ 无 | ✅ .ivy/sessions/ + events.jsonl + project.yaml |
| CLI 分析面板 | ❌ 无 | ✅ ivy analytics（项目级）+ ivy dashboard（变更级） |
| 趋势分析 | ❌ 无 | ✅ 设计稿（30d/90d 对比） |
| 评分 | **0** | **8.5** |

**分析**：纯增量功能，Comet 完全没有采纳率相关能力。IvyFlow 设计已非常详尽，但归因准确度（尤其是低置信度层）在真实环境中仍需验证，所以不给满分。

##### 6. 安全机制（权重 8%）

| 子项 | Comet | IvyFlow |
|------|-------|---------|
| PII 扫描 | ❌ 无 | ✅ 身份证/手机号/邮箱/API Key/数据库连接串 |
| 敏感文件检测 | ❌ 无 | ✅ .env/credentials.json 黑名单 |
| 安全审查 Agent | ❌ 无 | ✅ security-reviewer（full 模式） |
| SAST 免责声明 | ❌ 无 | ✅ "AI 扫描不等同于专业 SAST 工具" |
| 评分 | **2.0** | **7.0** |

**分析**：安全是 IvyFlow 的另一纯增量。Comet 仅有基础的 Hook 守卫（防止错误阶段写代码），不涉及内容安全。IvyFlow 得分低于满分因为 Rule-based PII 扫描不是强制拦截，依赖 Agent 遵守。

##### 7. 技术栈生态（权重 5%）

| 子项 | Comet | IvyFlow |
|------|-------|---------|
| 技术栈自动检测 | ❌ 无 | ✅ 5 种构建工具自动识别 |
| Skill 推荐映射表 | ❌ 无 | ✅ 10+ 技术栈 → 30+ Skill 映射 |
| 质量过滤（≥1K installs） | ❌ 无 | ✅ 内置 |
| 可信源白名单 | ❌ 无 | ✅ vercel-labs/anthropics/microsoft 等 |
| 评分 | **0** | **6.0** |

**分析**：另一个纯增量功能。IvyFlow 得分不高是因为映射表数据质量依赖人工维护，且市场上实际可用的技术栈 Skill 覆盖率有限。

##### 8. CLI 工具链（权重 7%）

| 子项 | Comet | IvyFlow |
|------|-------|---------|
| 命令数量 | 5（init/status/doctor/update/uninstall） | 7（+ analytics/dashboard） |
| --json 输出 | ✅ 全命令覆盖 | ❌ 未实现 |
| 脚本工具链 | 7 个 bash 脚本 | 1 个（hook-guard.sh） |
| 版本管理 | ✅ version.ts + printVersionInfo | ❌ 未实现 |
| 更新机制 | ✅ npm self-update + skill update | ❌ 设计稿阶段 |
| 卸载清理 | ✅ 完整（uninstall.ts 535 行） | ❌ 设计稿阶段 |
| 错误处理 | ✅ command-error.ts | ❌ 未实现 |
| 评分 | **7.0** | **2.5** |

**分析**：Comet 作为已发布产品，CLI 成熟度远高于 IvyFlow。7 个 bash 脚本提供完整的环境管理/状态管理/移交/归档/验证工具链，IvyFlow 需要 Phase 3 才能补齐。

##### 9. 文档与测试（权重 5%）

| 子项 | Comet | IvyFlow |
|------|-------|---------|
| 用户文档 | 基础（README） | 设计文档（本文件） |
| API 文档 | ❌ 无 | ❌ 无 |
| 单元测试 | ✅ vitest | ❌ 未开始 |
| 集成测试 | ❌ 无 | ❌ 未开始 |
| 贡献指南 | ❌ 无 | ❌ 无 |
| 评分 | **3.0** | **1.0** |

**分析**：两个项目文档都比较薄弱。Comet 至少有可运行的测试，IvyFlow 仅有设计文档。

##### 10. 项目成熟度（权重 5%）

| 子项 | Comet | IvyFlow |
|------|-------|---------|
| 当前版本 | v0.3.8 | v0.12.0 |
| npm 发布 | ✅ 已发布 | ❌ 未发布 |
| 源码行数 | ~4,000 行 | 0 行 |
| 社区用户 | 少量（新项目） | 无 |
| 生产验证 | 基本验证 | 仅 Skill 原型验证 |
| 评分 | **7.0** | **0.5** |

**分析**：Comet 遥遥领先。IvyFlow 目前仅是完整设计文档，0.5 分来自已在 ivy-dev-workflow Skill 中验证了工作流可行性。

---

#### 综合雷达图数据

```
                    平台覆盖 (15%)
                       10
                        |
    成熟度(5%)  ---- 8  |  Comet(─)    IvyFlow(···)
                        |
  文档测试(5%)  ---- 6  |  ·····
                        | /      \
 CLI工具链(7%)  ---- 4  |/        \    工作流深度(20%)
                       /|          \
                     /  |    ····    \
                   2    |             \
                        |              \
 技术栈生态(5%)  ----   |               \   阶段守卫(15%)
                        |
      安全(8%)  ----    |        初始化体验(10%)
                        |
                    采纳率(10%)
```

---

#### 关键发现

**Comet 优势（当前领先）**：
1. **平台广度**：30+ vs 2，差距巨大且短期内难以追赶
2. **产品成熟度**：已发布 v0.3.8，有完整的 CLI 工具链和 bash 脚本生态
3. **初始化体验**：完整的交互式向导 + 一键安装 + JSON 输出模式
4. **Hook 格式覆盖**：7 种格式，远超 IvyFlow 的 2 种

**IvyFlow 优势（差异化方向）**：
1. **工作流深度**：9 步方法论 + Delta Spec + TDD 纪律 + Agent 分派路由表
2. **三重防御**：多一层 Git Hook，理论上阶段越权风险更低
3. **采纳率系统**：纯增量功能，Comet 完全没有
4. **安全机制**：PII 扫描 + 敏感文件检测，Comet 没有
5. **技术栈推荐**：自动检测 + 精选映射表，降低新用户上手成本

**战略建议**：
- IvyFlow 应避免在平台广度上与 Comet 正面竞争
- 核心卖点聚焦：(1) 严谨工作流深度 (2) 采纳率量化 (3) 安全合规
- 初期目标用户：对 AI 代码质量和可追溯性有要求的企业团队
- 与 Comet 的关系：互补而非替代。可考虑互通（共享 OpenSpec 生态）

### B. IvyFlow 与 Devin/OpenHands 的边界

IvyFlow **不是** AI Agent 平台。它不执行代码，不管理 Agent 生命周期。它的角色是：

1. **工作流编排器**：定义"什么时候该做什么"
2. **阶段守卫**：确保"不做不该做的事"  
3. **采纳率量化**：回答"AI 写了多少代码，质量如何"

Agent 的实际执行由 AI 编码助手（Claude Code、Cursor 等）完成，IvyFlow 不介入。

### C. 关键架构决策记录（ADR）

| ID | 决策 | 理由 | 权衡 |
|----|------|------|------|
| ADR-1 | TypeScript + npm 而非 Python + pip | npm 是 AI 编码工具生态默认，对标 Comet | Python CLI 打包复杂度更高 |
| ADR-2 | commander + @inquirer/prompts 而非 yargs + enquirer | 与 Comet 一致，降低学习成本 | — |
| ADR-3 | OpenSpec 作为强依赖（非自研） | 行业标准，避免重复造轮子 | 长期锁定风险，Phase 4 抽象层缓解 |
| ADR-4 | GitNexus 作为弱依赖（可选安装） | 对非全量用户是过度依赖 | 功能降级时体验折扣 |
| ADR-5 | 三重防御而非仅 Hook | 全平台覆盖 > 仅 Hook 平台 | 安全级别不如 Hook 实时 |
| ADR-6 | Rule 做 PII 扫描而非 Hook | 全平台覆盖 + 零延迟 | 依赖 Agent 遵守，非强制拦截 |
| ADR-7 | 文件系统采纳率存储而非数据库 | 零依赖、Git 可追溯、简单可靠 | 查询效率低，不适合超大规模 |
| ADR-8 | manifest.json 驱动分发 | 声明式管理，与 Comet 一致 | — |

### D. 命名由来

**IvyFlow（常春藤流）**：Ivy（常春藤）象征"严谨的工作流像常春藤一样缠绕和保护代码质量"，Flow（流）代表"从需求到归档的顺畅工作流"。常春藤在建筑学中代表"扎根和生长"，与 IvyFlow 帮助项目建立可持续的规范驱动开发文化相呼应。对标 Comet（短暂闪耀的彗星）vs IvyFlow（持续生长的常春藤）——差异化叙事。

### E. 参考资源

- [Comet 源码](https://github.com/rpamis/comet)
- [OpenSpec](https://github.com/fission-ai/openspec)
- [GitNexus](https://github.com/colbymchenry/gitnexus)
- [Skills CLI 生态](https://skills.sh/)
- [Skill Creator 指南](https://skills.sh/anthropics/skill-creator)

---

> **文档维护者**：IvyFlow Team  
> **最后更新**：2026-06-16  
> **反馈渠道**：GitHub Issues
> **反馈渠道**：GitHub Issues

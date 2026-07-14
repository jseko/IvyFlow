# IvyFlow Init 当前实现设计文档

> 日期：2026-07-14 | 版本：v0.15.0 | 基于实际代码

---

## 一、概述

`ivy init` 是 IvyFlow 的项目初始化命令，将工作流 skills、rules、commands 和 capabilities 安装到 AI 编程平台目录中。

### 设计原则

1. **简洁优先** — 每步都有明确目的，不做无意义的选择
2. **自动检测** — 能自动检测的不让用户手动选择
3. **开发者专注** — IvyFlow 是开发者工作流工具，不扩展到其他角色

---

## 二、当前流程（4 步）

```
Step 1: 欢迎 + 安装作用域
Step 2: 语言选择 + 技术栈检测
Step 3: CodeGraph + OpenSpec 可选安装
Step 4: 安装执行 + 完成指引
```

### Step 1：欢迎 + 作用域

- 显示 IvyFlow Logo 和版本号
- 自动检测已安装的 AI 编程平台（30 个平台，分 3 级）
- 展示检测到的平台数量
- 选择安装范围：项目目录（推荐）或全局配置

### Step 2：语言 + 技术栈

- **语言选择**：自动检测系统语言，默认中文。选择后写入对应平台的指令文件（CLAUDE.md / AGENTS.md / CODEBUDDY.md 等），追加 `请始终使用中文回复。`
- **技术栈检测**：调用 `detectFingerprint()` 自动扫描项目文件（package.json / pom.xml / go.mod 等），展示检测到的语言、框架、构建工具。纯展示，不阻断流程。

### Step 3：CodeGraph + OpenSpec

- **CodeGraph**：可选安装语义代码智能工具，节省 ~58% 工具调用
- **OpenSpec**：可选安装规范驱动开发工具，用于变更提案和归档

### Step 4：安装执行

- 安装引擎分 4 阶段串行执行：内核 → 能力包 → 平台 → 写入配置
- 每阶段内部并行（能力包并行安装，平台并行安装）
- 实时 spinner 进度展示
- 安装完成后展示快速上手命令和已安装内容摘要

---

## 三、架构

```
展示层（init.ts）
  ├── 4 步交互向导
  ├── @inquirer/prompts
  └── 自定义 spinner

执行层（install-engine.ts）
  ├── KernelInstaller      → 复制 skills/rules/hooks
  ├── CapabilityInstaller  → 复制 4 个能力包
  ├── PlatformInstaller    → 安装到 30 个平台
  └── ConfigWriter         → .ivy/project.yaml + 语言指令

数据层
  ├── .ivy/project.yaml    → 项目配置
  ├── .claude/skills/ivy/  → 工作流 skills
  ├── .claude/rules/       → 规则文件
  ├── .claude/commands/    → 斜杠命令
  └── CLAUDE.md            → 语言指令（追加到末尾）
```

---

## 四、关键设计决策

### D1：移除项目类型选择

**决策**：不提供项目类型选择步骤。

**理由**：`projectType` 字段仅写入 `.ivy/project.yaml`，不被任何 skill、规则或能力包消费。选择后对工作流行为无任何影响。

### D2：移除能力包选择

**决策**：4 个能力包默认全部安装，不提供选择步骤。

**理由**：能力包的 SKILL.md 和 rules 文件只是 AI 参考文档，不被任何 phase skill 引用或强制执行。选择步骤给用户"我能选什么"的错觉但选了无实际效果。全部安装不占资源。

### D3：移除安全审计展示

**决策**：不展示安装前安全评估表格。

**理由**：所有模块都是 IvyFlow 自身代码（内核 + 4 个能力包），无第三方风险。权限和风险等级是硬编码在 manifest.yaml 中的，用户无法改变。展示表格只增加一步无意义的确认。

### D4：语言字段写入平台指令文件

**决策**：`language` 字段不仅写入 `.ivy/project.yaml`，还追加到各平台的指令文件末尾。

**理由**：让 AI 工具根据用户选择自动切换回复语言。支持 7 个平台：CLAUDE.md、AGENTS.md、CODEBUDDY.md、GEMINI.md、.cursorrules、.windsurfrules、.github/copilot-instructions.md。幂等写入，重复 init 不会重复添加。

### D5：不做角色选择

**决策**：不引入角色系统（产品经理、测试、架构师等）。

**理由**：IvyFlow 是开发者工作流执行器，5 阶段流程（open → design → build → verify → archive）专为编码场景设计。引入其他角色需要全新的 skill 文件和工作流，维护成本翻倍，且 90% 用户只会选"全栈开发"。

### D6：默认语言改为中文

**决策**：系统语言非中文/英文时，默认选择中文。

**理由**：面向中文开发者社区，降低上手门槛。

---

## 五、已安装的资产清单

### Skills（8 个）

| 文件 | 用途 |
|------|------|
| `ivy/SKILL.md` | 调度器，根据阶段路由到对应 skill |
| `ivy/ivy-open/SKILL.md` | Phase 1：创建 OpenSpec 变更结构 |
| `ivy/ivy-design/SKILL.md` | Phase 2：深度设计 + brainstorming |
| `ivy/ivy-build/SKILL.md` | Phase 3：执行实现 + 代码审查 |
| `ivy/ivy-verify/SKILL.md` | Phase 4：质量门控 + 分支处理 |
| `ivy/ivy-archive/SKILL.md` | Phase 5：归档 + 知识提取 |
| `ivy/ivy-hotfix/SKILL.md` | Bug 修复快捷路径 |
| `ivy/ivy-tweak/SKILL.md` | 小改动快捷路径 |
| `ivy/references/*.md` (×10) | 参考文档 |

### Rules（3 个）

| 文件 | 用途 |
|------|------|
| `ivy-phase-guard.md` | 阶段守卫规则 |
| `ivy-security.md` | 安全检查规则 |
| `never-assume.md` | 禁止假设规则 |

### Commands（5 个）

| 文件 | 用途 |
|------|------|
| `ivyflow.md` | 启动完整工作流 |
| `ivyflow-quick.md` | 快速修复模式 |
| `ivyflow-hotfix.md` | Bug 修复快捷路径 |
| `ivyflow-tweak.md` | 小改动快捷路径 |
| `ivyflow-status.md` | 查看任务状态 |

### Capabilities（4 个）

| 名称 | 内容 |
|------|------|
| `code-intelligence` | GitNexus 语义索引指导 |
| `testing` | TDD 方法论 + 测试框架适配 |
| `deployment` | CI/CD 模板 |
| `documentation` | API 文档 + 变更日志模板 |

---

## 六、文件结构（安装后）

```
项目根目录/
├── .claude/
│   ├── commands/
│   │   ├── ivyflow.md
│   │   ├── ivyflow-quick.md
│   │   ├── ivyflow-hotfix.md
│   │   ├── ivyflow-tweak.md
│   │   ├── ivyflow-status.md
│   │   └── opsx/ (×11)
│   ├── rules/
│   │   ├── ivy-phase-guard.md
│   │   ├── ivy-security.md
│   │   └── never-assume.md
│   └── skills/
│       ├── ivy/SKILL.md
│       ├── ivy/ivy-{open,design,build,verify,archive,hotfix,tweak}/SKILL.md
│       ├── ivy/references/ (×10)
│       ├── ivy-capability-{code-intelligence,testing,deployment,documentation}/SKILL.md
│       └── openspec-*/SKILL.md (×11)
├── .ivy/
│   ├── project.yaml
│   ├── capabilities/ (×4)
│   ├── hooks/
│   ├── rules/
│   └── skills/
├── CLAUDE.md              ← 语言指令追加到末尾
└── .git/hooks/
    ├── pre-push
    └── post-commit
```

---

## 七、非交互模式

| 参数 | 行为 |
|------|------|
| `--quick` | 跳过向导，自动选推荐能力包 + 检测到的平台 |
| `--yes` | 全默认（项目作用域 + 自动检测语言 + 推荐包） |
| `--all` | 全安装（所有能力包 + 所有平台） |
| `--overwrite` | 覆盖已有文件 |
| `--skip-openspec` | 跳过 OpenSpec 安装 |
| `--platforms <ids>` | 指定平台 |
| CI 环境（非 TTY） | 自动降级为 `--quick` 模式 |

---

## 八、错误处理

| 场景 | 处理 |
|------|------|
| 平台安装失败 | 单平台失败不阻断整体，汇总报告 |
| 能力包安装失败 | 不回滚已安装的，标注失败状态 |
| 磁盘空间不足 | 安装前检查，不足时提示 |
| 权限不足 | 给出具体路径和 chmod 建议 |
| 网络不可用 | CodeGraph 安装标记为不可用 |
| 无 AI 平台检测到 | 提示安装平台或使用 `--platforms none` |
| 项目非 Git 仓库 | Git hooks 跳过，提示初始化 |

---

## 九、打包与分发

### 二进制打包

```
npm run package:binary

产物：
bin-out/
├── ivy                              # shell wrapper
└── ivyflow-0.14.0-darwin-aarch64    # 62MB 独立二进制
```

**打包流程**：
1. `tsc` 编译 TypeScript → `dist/`
2. 生成 `assets-registry.cjs`（所有 assets 文件内联为 JS 对象）
3. `esbuild` 打包为单文件 CJS（bundle + inject assets registry）
4. 正则 patch 处理 ESM → CJS 兼容（createRequire、import.meta.url、package.json 版本号）
5. `bun build --compile` 生成独立二进制

**内嵌文件**：52 个 assets 文件全部内嵌在二进制中，无需外部目录。

### npm 包分发

```bash
npm install -g ivyflow-cli
ivy init
```

npm 包模式下，assets 从安装目录的文件系统读取。

---

## 十、代码位置

| 模块 | 文件 |
|------|------|
| 向导入口 | `src/commands/init.ts` (386 行) |
| 安装引擎 | `src/core/install-engine.ts` (342 行) |
| 内核安装器 | `src/core/installers/kernel.ts` |
| 能力包安装器 | `src/core/installers/capability.ts` |
| 平台安装器 | `src/core/installers/platform.ts` (233 行) |
| 能力包注册表 | `src/core/capability-registry.ts` |
| 安全审计器 | `src/core/security-auditor.ts`（已废弃，不再调用） |
| Skill 分发 | `src/core/skills.ts` |
| CLI 注册 | `src/cli/index.ts` |
| 打包脚本 | `scripts/package-binary.js` |
| 资产清单 | `assets/manifest.json` |

# IvyFlow Init 重新设计规格

> 日期：2026-07-14 | 状态：待实施 | 版本：v1.0

---

## 一、设计目标

将 `ivy init` 重新设计为**模块化、交互式、透明化**的 6 步引导流程。核心目标：

1. **更好的上手体验** — 对标并超越 Comet init，提供沉浸式交互向导
2. **install + educate** — 安装完成后用户不仅能用 IvyFlow，还理解它的价值
3. **模块化架构** — 内核 + 可选能力包，用户按需装配

---

## 二、整体架构

### 2.1 分层设计

```
┌─────────────────────────────────────────────┐
│              展示层（6 步向导）               │
│   @inquirer/prompts + 自定义 spinner/boxen    │
├─────────────────────────────────────────────┤
│              执行层（安装引擎）               │
│  InstallEngine                               │
│  ├── KernelInstaller      (必装)             │
│  ├── CapabilityInstaller  (按需)             │
│  │   ├── CodeIntelligence                   │
│  │   ├── TestingToolchain                   │
│  │   ├── DeploymentIntegration              │
│  │   └── DocumentationGen                   │
│  ├── PlatformInstaller    (30 平台适配)       │
│  └── SecurityAuditor      (声明式权限)        │
├─────────────────────────────────────────────┤
│              数据层（配置持久化）             │
│  .ivy/project.yaml  +  能力包 manifest.yaml   │
└─────────────────────────────────────────────┘
```

### 2.2 核心模块

| 模块 | 职责 | 文件位置 |
|------|------|----------|
| `InitWizard` | 6 步向导流程编排 | `src/commands/init.ts`（重写） |
| `InstallEngine` | 安装执行编排 | `src/core/install-engine.ts`（新增） |
| `KernelInstaller` | 内核安装（技能 + 规则 + 钩子） | `src/core/installers/kernel.ts`（新增） |
| `CapabilityInstaller` | 能力包安装 | `src/core/installers/capability.ts`（新增） |
| `PlatformInstaller` | 平台适配安装（复用现有逻辑） | `src/core/installers/platform.ts`（重构） |
| `SecurityAuditor` | 安全评估与展示 | `src/core/security-auditor.ts`（新增） |
| `CapabilityRegistry` | 能力包注册与发现 | `src/core/capability-registry.ts`（新增） |

---

## 三、6 步向导 UX

### Step 1：欢迎 + 作用域

显示 IvyFlow Logo（boxen 样式），自动检测已安装的 AI 编程平台并展示数量，询问安装作用域。

```
   ╔══════════════════════════════════════════╗
   ║     🍃  IvyFlow  v0.15.0                 ║
   ║     AI-Native Development Workflow        ║
   ╚══════════════════════════════════════════╝

   检测到 3 个 AI 编程平台：Claude Code, OpenCode, Cursor

   ? 安装范围：
     ● 当前项目（./ivyflow/）          ← 推荐
     ○ 全局配置（~/.ivyflow/）
```

**差异点 vs Comet**：Comet 只显示 "Install scope: Project (current directory)"，我们在第一步就展示平台检测结果，让用户感知兼容性。

### Step 2：语言偏好 + 项目类型

自动检测系统语言作为默认值，询问项目类型以优化后续工作流配置。

```
   ? 工作语言：中文 / English（自动检测：中文）

   ? 项目类型：
     ● Web 应用（React / Vue / Next.js 等）
     ○ CLI 工具
     ○ 库 / SDK
     ○ 微服务
     ○ 自动检测（已检测到：Web 应用）
```

**差异点 vs Comet**：Comet 只询问语言，我们追加项目类型以优化后续工作流。

### Step 3：能力包选择

卡片式多选，包含推荐标签、评分、风险等级、预计大小。

```
   ? 选择需要的能力包（空格选择，回车确认）：

   ┌─────────────────────────────────────────────┐
   │ 🔍  代码理解                    [推荐] ★4.8  │
   │     语义索引，节省 ~58% 工具调用            │
   │     风险：低  │  大小：2.1MB                │
   │     [✓ 已选择]                               │
   ├─────────────────────────────────────────────┤
   │ 🧪  测试工具链                   [推荐] ★4.6 │
   │     TDD 方法论 + 测试框架自动适配           │
   │     风险：低  │  大小：1.5MB                │
   │     [✓ 已选择]                               │
   ├─────────────────────────────────────────────┤
   │ 🚀  部署集成                               │
   │     CI/CD 模板 + 一键发布流程               │
   │     风险：中  │  大小：0.8MB                │
   │     [  未选择]                               │
   ├─────────────────────────────────────────────┤
   │ 📝  文档生成                               │
   │     API 文档 + 变更日志自动生成             │
   │     风险：低  │  大小：1.2MB                │
   │     [  未选择]                               │
   └─────────────────────────────────────────────┘

   预计安装：3 个包  │  总大小：3.6MB  │  预计时间：~5s
```

**差异点 vs Comet**：Comet 只是简单询问 "Install CodeGraph? (y/n)"，我们提供卡片式多选 + 推荐标签 + 评分 + 预计开销。

### Step 4：安全审计

按模块聚合的安全评估表，比 Comet 的 per-skill 列表更简洁。

```
   安装前安全评估：

   ┌────────────────────┬──────────┬──────────┬──────────┐
   │ 模块               │ 网络权限 │ 文件权限 │ 风险等级 │
   ├────────────────────┼──────────┼──────────┼──────────┤
   │ 🍃 内核            │ 无       │ 写入配置 │ 🟢 低    │
   │ 🔍 代码理解        │ 无       │ 读取项目 │ 🟢 低    │
   │ 🧪 测试工具链      │ 无       │ 读取项目 │ 🟢 低    │
   ├────────────────────┼──────────┼──────────┼──────────┤
   │ 总计               │ 0 外部连接          │ 🟢 安全  │
   └────────────────────┴──────────┴──────────┴──────────┘

   ? 确认安装？ Yes
```

**差异点 vs Comet**：Comet 的审计是 skill 维度的（每个 skill 一行，14 行），我们按模块聚合，更简洁清晰。

### Step 5：安装执行

实时 spinner + 文件计数 + 分阶段进度。

```
   ⠋ 安装内核...               ⠋ 复制 2/3 文件
   ✓ 安装内核                  ✓ 3 files, 0.8s
   ⠋ 安装代码理解...           ⠋ 初始化 GitNexus 索引
   ✓ 安装代码理解              ✓ 12 files, 2.1s
   ⠋ 安装测试工具链...         ⠋ 检测测试框架
   ✓ 安装测试工具链            ✓ 8 files, 1.3s
   ⠋ 安装到 3 个平台...        ⠋ Claude Code (3/5)
   ✓ Claude Code               ✓ 5 files, 0.6s
   ✓ OpenCode                  ✓ 5 files, 0.4s
   ✓ Cursor                    ✓ 5 files, 0.5s

   ✓ IvyFlow 安装完成！耗时 5.7s
```

**差异点 vs Comet**：Comet 只有简单的 "Installed: CodeBuddy Code -> .codebuddy/skills/"，我们提供实时进度 + 文件计数 + 分阶段。

### Step 6：完成指引

展示已安装的能力和平台，提供快速上手命令。

```
   ╔══════════════════════════════════════════════╗
   ║  🎉  IvyFlow 已就绪！                        ║
   ║                                              ║
   ║  快速开始：                                  ║
   ║    /ivyflow "实现用户登录"   启动完整工作流   ║
   ║    /ivyflow-quick "修复报错"  快速修改        ║
   ║    /ivyflow-status            查看任务状态    ║
   ║                                              ║
   ║  工作目录：docs/ivyflow/specs/               ║
   ║           docs/ivyflow/plans/                ║
   ║                                              ║
   ║  已安装能力：🍃内核 🔍代码理解 🧪测试工具链    ║
   ║  已适配平台：Claude Code, OpenCode, Cursor    ║
   ╚══════════════════════════════════════════════╝

   💡 提示：重启 AI 工具后斜杠命令即可生效
```

**差异点 vs Comet**：展示已安装的能力和平台，让用户清楚知道"我装了什么"。

---

## 四、4 个能力包

### 4.1 代码理解 (Code Intelligence)

| 维度 | 内容 |
|------|------|
| **职责** | 让 AI 工具理解项目代码结构，减少无效搜索 |
| **组成** | GitNexus 集成 skill + CodeGraph 可选安装 + 项目索引初始化 |
| **已有基础** | `src/core/gitnexus.ts`（零耦合覆盖层）、`src/core/ecosystem.ts`（检测逻辑） |
| **安装后效果** | AI 在提问时自动使用语义索引，节省 ~58% 工具调用 |
| **风险等级** | 低（无网络权限，仅读取项目文件） |
| **预估大小** | 2.1MB |

### 4.2 测试工具链 (Testing Toolchain)

| 维度 | 内容 |
|------|------|
| **职责** | 提供 TDD 工作流和测试框架自动适配 |
| **组成** | TDD 方法论 skill + 测试框架检测器 + `ivy verify` 门控配置 |
| **已有基础** | `src/core/capability-detector.ts`（检测 vitest/jest/playwright）、`src/core/verify-profile.ts`（质量门控）、`assets/capability/verify-mapping.yaml` |
| **安装后效果** | `/ivy-build` 阶段自动运行测试，`/ivy-verify` 执行完整质量门控 |
| **风险等级** | 低（无网络权限） |
| **预估大小** | 1.5MB |

### 4.3 部署集成 (Deployment Integration)

| 维度 | 内容 |
|------|------|
| **职责** | 一键生成 CI/CD 配置 + 发布流程管理 |
| **组成** | CI/CD 模板生成器 + `ivy release` 打包 + 环境配置管理 |
| **已有基础** | `assets/ci/github-actions.yml`、`assets/ci/gitlab-ci.yml`、`src/commands/release.ts` |
| **安装后效果** | 自动生成 `.github/workflows/ivyflow-ci.yml`，`ivy release` 一键打包发布产物 |
| **风险等级** | 中（涉及外部 API/CI 平台） |
| **预估大小** | 0.8MB |

### 4.4 文档生成 (Documentation Generation)

| 维度 | 内容 |
|------|------|
| **职责** | 从工作流产物自动生成文档 |
| **组成** | API 文档生成器 + 变更日志生成器 + 知识提取器增强 |
| **已有基础** | `src/core/knowledge-extractor.ts`（决策/约束提取）、`src/core/assess-engine.ts`（文档质量评估） |
| **安装后效果** | `/ivy-archive` 完成后自动生成 CHANGELOG，代码变更自动更新 API 文档 |
| **风险等级** | 低（无网络权限） |
| **预估大小** | 1.2MB |

---

## 五、数据模型

### 5.1 项目配置 `.ivy/project.yaml`（增强版）

```yaml
# === 现有字段（保留） ===
version: "0.15.0"
platforms: [claude, opencode, cursor]
scope: project

# === 新增字段 ===
language: zh-CN
project_type: web-app

# === 能力包配置（新增） ===
capabilities:
  code_intelligence:
    enabled: true
    provider: gitnexus          # gitnexus | codegraph | none
    index_freshness: fresh
  testing:
    enabled: true
    framework: vitest           # 自动检测
    tdd_mode: strict            # strict | relaxed | off
  deployment:
    enabled: false
    ci_provider: null           # github-actions | gitlab-ci | null
  documentation:
    enabled: false
    formats: []                 # api-doc | changelog | readme

# === 安全声明（新增） ===
security:
  risk_level: low
  external_connections: 0
  file_permissions: [read_project, write_config]

# === 安装元数据（新增） ===
install:
  completed_at: "2026-07-14T10:30:00Z"
  duration_ms: 5723
  version: "0.15.0"
```

### 5.2 能力包 manifest

```yaml
# assets/capabilities/<name>/manifest.yaml
name: code-intelligence
display_name: "代码理解"
icon: "🔍"
description: "语义索引，让 AI 理解你的代码结构"
benefit: "节省 ~58% 工具调用，加速代码问答"
risk_level: low
network_permission: none
file_permission: read_project
size_kb: 2150
rating: 4.8
recommended: true
dependencies: []
conflicts: []
```

### 5.3 能力包目录结构

```
assets/capabilities/
├── code-intelligence/
│   ├── SKILL.md              # AI 工具使用的指令
│   ├── rules/
│   │   └── use-gitnexus.md   # 强制使用语义索引的规则
│   └── manifest.yaml
├── testing/
│   ├── SKILL.md              # TDD 工作流指令
│   ├── rules/
│   │   └── tdd-required.md   # 强制 TDD 的规则
│   └── manifest.yaml
├── deployment/
│   ├── SKILL.md
│   ├── templates/
│   │   ├── github-actions.yml
│   │   └── gitlab-ci.yml
│   └── manifest.yaml
└── documentation/
    ├── SKILL.md
    ├── templates/
    │   ├── api-doc.hbs
    │   └── changelog.hbs
    └── manifest.yaml
```

---

## 六、平台安装（优化现有逻辑）

### 6.1 优化方向

保留现有 30 平台检测安装逻辑，做以下优化：

1. **精简平台分层** — Tier 1/2/3 分层保留，但 UI 中只默认展示 Tier 1，Tier 2/3 折叠到"更多平台"
2. **并行安装** — 已有 `Promise.allSettled` 逻辑保留
3. **安装验证** — 安装后追加文件存在性校验，失败时给出具体原因
4. **全局 vs 项目** — 全局安装时跳过 git hooks，只写 `~/.ivyflow/` 配置

### 6.2 平台适配器接口（保留现有）

```typescript
interface PlatformAdapter {
  name: string;
  detect(): boolean;
  install(config: IvyFlowConfig): Promise<void>;
  uninstall(): Promise<void>;
}
```

---

## 七、向后兼容与迁移

### 7.1 兼容策略

| 场景 | 处理方式 |
|------|----------|
| **已有 `.ivy/` 的旧项目** | 检测到旧版配置 → 提示升级 → 保留旧数据，追加新字段 |
| **`--quick` 模式** | 保留快捷参数，跳过交互向导，自动选推荐能力包 + 所有检测到的平台 |
| **`--overwrite`** | 保留，覆盖安装 |
| **`--platforms <ids>`** | 保留，指定平台 |
| **CI 环境（非 TTY）** | 自动降级为 `--quick` 模式，不启动交互向导 |

### 7.2 快捷参数

```
ivy init              # 默认：启动 6 步交互向导
ivy init --quick      # 兼容旧行为：跳过向导，自动选推荐能力包
ivy init --yes        # 全默认（当前项目 + 自动检测 + 推荐包）
ivy init --all        # 全安装（所有能力包 + 所有平台）
ivy init --standard   # 保留，等同于默认交互模式
```

### 7.3 升级检测

```
   检测到旧版 IvyFlow 配置（v0.14.0）

   ? 是否升级到 v0.15.0？
     新版本提供：能力包选择、安全审计、实时安装进度

     ● 升级（推荐）— 保留现有配置，追加新功能
     ○ 跳过 — 保持现有配置不变
```

---

## 八、错误处理

| 场景 | 处理 |
|------|------|
| **平台安装失败** | 单个平台失败不阻断整体，汇总报告失败原因 |
| **能力包安装失败** | 已安装的能力包不回滚，失败的能力包标注状态 |
| **磁盘空间不足** | 安装前检查可用空间（能力包总大小 * 2），不足时提示 |
| **权限不足** | 写入失败时给出具体路径和 `chmod` 建议 |
| **网络不可用** | 需要网络的能力包（如 CodeGraph 远程安装）标记为不可用 |
| **无 AI 平台检测到** | 提示用户安装至少一个支持的平台，或使用 `--platforms none` 跳过 |
| **项目非 Git 仓库** | Git hooks 安装步骤跳过，提示用户初始化 Git 仓库 |

---

## 九、文件变更清单

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/core/install-engine.ts` | 安装执行编排器 |
| `src/core/installers/kernel.ts` | 内核安装器 |
| `src/core/installers/capability.ts` | 能力包安装器 |
| `src/core/installers/platform.ts` | 平台安装器（重构自现有 init.ts） |
| `src/core/security-auditor.ts` | 安全审计器 |
| `src/core/capability-registry.ts` | 能力包注册表 |
| `assets/capabilities/code-intelligence/SKILL.md` | 代码理解 skill |
| `assets/capabilities/code-intelligence/rules/use-gitnexus.md` | 代码理解规则 |
| `assets/capabilities/code-intelligence/manifest.yaml` | 代码理解 manifest |
| `assets/capabilities/testing/SKILL.md` | 测试工具链 skill |
| `assets/capabilities/testing/rules/tdd-required.md` | 测试工具链规则 |
| `assets/capabilities/testing/manifest.yaml` | 测试工具链 manifest |
| `assets/capabilities/deployment/SKILL.md` | 部署集成 skill |
| `assets/capabilities/deployment/templates/github-actions.yml` | GitHub Actions 模板 |
| `assets/capabilities/deployment/templates/gitlab-ci.yml` | GitLab CI 模板 |
| `assets/capabilities/deployment/manifest.yaml` | 部署集成 manifest |
| `assets/capabilities/documentation/SKILL.md` | 文档生成 skill |
| `assets/capabilities/documentation/templates/api-doc.hbs` | API 文档模板 |
| `assets/capabilities/documentation/templates/changelog.hbs` | 变更日志模板 |
| `assets/capabilities/documentation/manifest.yaml` | 文档生成 manifest |

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/commands/init.ts` | 完全重写，从 339 行单体文件改为向导编排器 |
| `src/cli/index.ts` | 追加 `--yes` / `--all` 参数注册 |
| `src/core/platforms.ts` | 无结构性变更，保留现有 30 平台定义 |
| `src/core/detect.ts` | 无结构性变更，保留现有检测逻辑 |

### 保留不变的文件

| 文件 | 原因 |
|------|------|
| `src/core/platforms.ts` | 平台定义稳定，无需变更 |
| `src/core/detect.ts` | 检测逻辑稳定，无需变更 |
| `assets/manifest.json` | 内核 manifest 保留，能力包有独立 manifest |
| `assets/skills/ivy/` | 内核技能文件保留不变 |
| `assets/rules/` | 内核规则文件保留不变 |
| `assets/hooks/` | 内核钩子文件保留不变 |

---

## 十、测试策略

### 单元测试

| 测试目标 | 测试内容 |
|----------|----------|
| `CapabilityRegistry` | 注册、发现、过滤能力包 |
| `SecurityAuditor` | 风险等级计算、权限聚合 |
| `InstallEngine` | 安装流程编排、失败回滚 |
| `KernelInstaller` | 文件复制、目录创建 |
| `CapabilityInstaller` | 能力包文件安装、manifest 解析 |
| `PlatformInstaller` | 单平台安装、多平台并行 |

### 集成测试

| 测试目标 | 测试内容 |
|----------|----------|
| `ivy init --quick` | 向后兼容，结果与旧版一致 |
| `ivy init --yes` | 全默认安装，生成正确配置 |
| `ivy init --all` | 全安装，所有能力包 + 平台 |
| 升级场景 | 旧 `.ivy/` 目录升级，数据不丢失 |
| 非 TTY 环境 | 自动降级为 quick 模式 |

### E2E 测试

| 测试目标 | 测试内容 |
|----------|----------|
| 完整向导 | 模拟用户交互，6 步向导完整走通 |
| 部分安装 | 只选部分能力包和平台 |
| 安装失败恢复 | 模拟文件写入失败，验证错误报告 |

---

## 十一、实施里程碑

| 阶段 | 内容 | 预计工作量 |
|------|------|------------|
| **M1: 基础设施** | `InstallEngine`、`CapabilityRegistry`、`SecurityAuditor`、数据模型 | 2-3 天 |
| **M2: 安装器** | `KernelInstaller`、`CapabilityInstaller`、`PlatformInstaller`（重构） | 2-3 天 |
| **M3: UX 向导** | 6 步向导实现 + CLI 参数注册 | 2-3 天 |
| **M4: 能力包内容** | 4 个能力包的 SKILL.md + rules + templates + manifest | 2-3 天 |
| **M5: 测试 + 文档** | 单元测试、集成测试、E2E 测试、更新 README | 2-3 天 |

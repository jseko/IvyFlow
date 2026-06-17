# IvyFlow v0.3 设计文档（修订版）

> 版本：v0.3.0 | 基于：v0.2 实现 + 设计评审反馈 | 日期：2026-06-17 | 状态：Revision-A

---

## 1. 概述

### 1.1 定位修正

**修订前**："质量与完整性版本"——大而全，包含 uninstall / update / analytics / security

**修订后**：**安全强化 + 生命周期管理**。只补充两项：

1. **CLI 生命周期**：`ivy uninstall` + `ivy update`（v0.1/v0.2 一直未交付，用户反馈最紧迫）
2. **安全规则有执行点**：`ivy-security.md` 不仅分发，还集成到 `ivy validate`

其余能力（analytics / session events / dashboard）延后到 v0.4，理由见 §9。

### 1.2 为什么撤回 analytics

**评审发现的核心矛盾**：

v0.3 analytics 假设的数据源矩阵实际是残缺的：

| 平台 | PreToolUse Hook | Rule 层 | Git Hook | 能采集的数据 |
|---|---|---|---|---|
| Claude Code | ❌ | 静态文件 | ✅ pre-push | git diff only |
| CodeBuddy | ❌ | 静态文件 | ❌ | git diff only |
| Cursor | ❌ | 静态文件 | ❌ | git diff only |
| GitHub Copilot | ❌ | 静态文件 | ❌ | git diff only |
| Windsurf | ✅ | 静态文件 | ❌ | 部分工具事件 |
| Trae | ❌ | 静态文件 | ❌ | git diff only |
| Qoder | ❌ | 静态文件 | ❌ | git diff only |

v0.3 analytics 设计假设"7 平台 × session events"，实际上 6/7 平台没有事件源。
强行上线会得到**"Windsurf-only dashboard"**，数据偏差不可接受。

→ analytics 必须等到 PreToolUse Hook 至少覆盖 2 个平台（§9.6 红线：stable ≥ 6 个月），
  或找到不依赖 Hook 的替代归因方案。目前两者均不满足。

### 1.3 修订后的 CLI 命令

```
ivy init       [--quick | --standard | --enterprise] [--overwrite] [--skip-openspec]
ivy status     [--change <name>]
ivy validate                           ← 新增：同时做 phase + security 校验
ivy doctor     [--fix]
ivy uninstall  [--platforms <ids>] [--dry-run] [--force]
ivy update     [--check]
```

**6 个命令**（接近评审建议的 ≤ 5 上限，保留 doctor 因为 v0.2 已交付且有活跃用户）。

### 1.4 明确不做（v0.3）

- ❌ `ivy analytics` → v0.4（数据源矩阵不满足，见 §1.2）
- ❌ `.ivy/sessions/` 目录 + events.jsonl → v0.4（同上）
- ❌ `ivy dashboard` → v0.4
- ❌ PreToolUse Hook 扩展（Cursor / Copilot / 其他）→ §9.6 红线
- ❌ Skill 按阶段拆分 → 状态机不应编码为文件系统
- ❌ 技术栈检测 + Skill 推荐 → §9.5 红线（≥ 100 项目 usage data）
- ❌ 三层防御优先级定义 → 不在 v0.3 引入抽象
- ❌ `ivy-security.md` 独立命令 → 仅集成到 validate，不增加 CLI 面

---

## 2. 架构变更

### 2.1 目录结构（修订版）

```
ivy/
├── src/
│   ├── commands/
│   │   ├── uninstall.ts           # 新增 — 带 --dry-run + --force
│   │   └── update.ts              # 新增 — check-only + print command
│   ├── core/
│   │   ├── security.ts            # 新增 — validate 时调用的安全扫描
│   │   └── version.ts             # 新增 — 版本比对（update 用）
│   └── utils/
├── assets/
│   ├── manifest.json              # 变更 — + rules/ivy-security.md
│   └── rules/
│       └── ivy-security.md        # 新增 — PII + 敏感文件黑名单
```

**与初版 v0.3 的差异**：
- 删除 `adoption.ts`、`analytics.ts`、`.ivy/sessions/` 设计
- security 不增加独立命令，而是 validate 的子能力

### 2.2 向后兼容

- v0.1/v0.2 `.ivy/project.yaml` → 直接读取
- v0.2 `.ivy/` 目录结构不变
- 所有已有命令参数不变

---

## 3. Sprint 3.1：CLI 生命周期（uninstall + update）

### 3.1 ivy uninstall

**核心约束**：这是 IvyFlow 中**破坏性最高的命令**，必须引入安全设计层级。

```typescript
export interface UninstallOptions {
  cwd?: string;
  platforms?: string[];      // 默认 project.yaml 中的 platforms[]
  dryRun?: boolean;          // 只打印将要删除的内容，不执行
  force?: boolean;           // 跳过确认提示（CI 用）
}

export async function runUninstall(opts?: UninstallOptions): Promise<number> {
  // 1. 读取 .ivy/project.yaml → 确定已安装平台
  // 2. --dry-run → 只打印清单，exit 0
  // 3. !--force → confirm() 提示用户确认（强确认节点）
  // 4. 对每个平台：
  //    a. 删除 <skillsDir>/skills/ivy/（递归删除）
  //    b. 删除 <skillsDir>/<rulesDir>/ivy-phase-guard.{md,mdc}
  //    c. 删除 <skillsDir>/<rulesDir>/ivy-security.{md,mdc}
  //    d. 删除 <skillsDir>/hooks/ivy-phase-guard.json（仅 Windsurf）
  // 5. 处理 .git/hooks/pre-push：
  //    a. 读取文件内容
  //    b. 查找 Ivy 标记头（"# IvyFlow pre-push hook — auto-generated"）
  //    c. 删除从标记头到标记尾（"# IvyFlow pre-push hook END"）之间的内容
  //    d. 若删除后文件为空 → 删除整个文件
  //    e. 若文件还有其他内容 → 保留，仅移除 Ivy 部分
  // 6. 删除 .ivy/ 目录
  // 7. 打印删除摘要
}
```

**安全设计**：

| 层级 | 机制 | 默认行为 |
|---|---|---|
| `--dry-run` | 只打印不删除 | 不提供，用户可选 |
| `--force` | 跳过交互确认 | 不提供，CI / 自动化用 |
| confirm() | 强确认节点 | 默认必须 |
| git hook 标记 | 精准定位 Ivy 写入的内容 | 避免误删用户自定义 hook |
| 幂等性 | 重复运行不报错 | 文件不存在 = 跳过 |

**不做**：
- ❌ 配置备份 — `--dry-run` 打印清单让用户自行备份
- ❌ 部分卸载保留机制 — `ivy init` 可重新安装
- ❌ 删除非 Ivy 管理的文件 — 严格只删 `ivy-` 前缀和 `skills/ivy/` 目录

### 3.2 ivy update

**核心约束**：只做到"提示升级命令"，不做自动安装。

```typescript
export interface UpdateOptions {
  check?: boolean;    // 仅检查不提示
  cwd?: string;
}

export async function runUpdate(opts?: UpdateOptions): Promise<number> {
  // 1. 读取 package.json → localVersion
  // 2. 尝试 npm view ivyflow-cli version → remoteVersion
  //    a. 网络失败 / 离线 → logger.warn('离线模式，无法检查更新') → exit 0
  // 3. semver 比较：
  //    a. remote === local → "已是最新 vX.Y.Z"
  //    b. remote > local  → 打印升级命令 + CHANGELOG 链接
  //    c. remote < local  → "本地版本超前（可能是开发版）"
  // 4. --check → 仅输出状态码（0=最新, 1=有更新），不打印升级命令
}
```

**设计要点**：
- 离线场景必须 graceful（不报错）
- `--check` 返回退出码供 CI 使用
- 打印的命令明确标注 `"请手动运行："`，不做自动 `npm install`
- 不引入 changelog 解析（YAGNI），只打印 CHANGELOG.md 链接

### 3.3 CLI 注册

```typescript
program.command('uninstall')
  .description('Remove IvyFlow files from installed platforms')
  .option('--platforms <ids>', 'Comma-separated platform ids')
  .option('--dry-run', 'Print what would be removed without deleting', false)
  .option('--force', 'Skip confirmation prompt', false)
  .action(async (opts) => {
    process.exit(await runUninstall({
      platforms: opts.platforms?.split(','),
      dryRun: opts.dryRun,
      force: opts.force,
    }));
  });

program.command('update')
  .description('Check for updates (prints command, does not auto-install)')
  .option('--check', 'Check-only, return exit code', false)
  .action(async (opts) => {
    process.exit(await runUpdate({ check: opts.check }));
  });
```

---

## 4. Sprint 3.2：安全规则 + validate 集成

### 4.1 ivy-security.md 内容

```markdown
# Ivy Security Rules

## 凭据与密钥（禁止硬编码）

- API Key 模式：`sk-[a-zA-Z0-9]{20,}`、`ghp_[a-zA-Z0-9]{36}`、`AKIA[A-Z0-9]{16}`
- 数据库连接串：`jdbc://`、`mongodb://`、`postgresql://`（含密码部分）
- 处理：使用环境变量引用，如 `process.env.OPENAI_API_KEY`

## 个人身份信息（PII）

- 手机号（中国）：`1[3-9]\d{9}`
- 邮箱：`[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`
- 处理：确认为测试数据；生产数据使用掩码

## 敏感文件黑名单

Agent 不应读取或写入：
- `.env`, `.env.*`, `.envrc`
- `credentials.json`, `credentials.toml`, `secrets.yaml`
- `*.pem`, `*.key`, `id_rsa`, `id_ed25519`
- `service-account.json`, `firebase-*.json`
- `terraform.tfvars`, `.aws/credentials`

## 重要提示

AI 扫描不等同于专业 SAST 工具（SonarQube、Checkmarx 等）。
生产环境部署前必须通过专业安全审查。
```

### 4.2 ivy validate 扩展

**核心设计**：security 不增加独立命令，而是 `ivy validate` 的子能力。

```typescript
// src/commands/validate.ts — v0.3 扩展
export interface ValidateOptions {
  cwd?: string;
  /** 新增：同时做安全扫描 */
  security?: boolean;    // 默认 true（v0.3 起默认启用）
}

// validate 执行流程：
// 1. 遍历 openspec/changes/*/.ivy.yaml
// 2. 检查 phase + phase_history（已有逻辑）
// 3. security=true 时：
//    a. 读取 assets/rules/ivy-security.md 规则列表
//    b. 对每个已安装平台的 rules 目录，检查 ivy-security.{md,mdc} 是否存在
//    c. 若缺失 → warning（"security rule not installed, run ivy init --overwrite"）
//    d. 扫描工作目录中是否存在敏感文件（仅检查文件名匹配黑名单，不读取内容）
// 4. 汇总输出：phase errors + security warnings
```

**为什么 validate 是 security 的执行点**：

| 防御层 | 语义 | security 的角色 |
|---|---|---|
| Rule | "建议性约束" | Agent 读取 security 规则后自觉遵守 |
| `ivy validate --security` | "校验性约束" | 检查规则文件是否已分发 + 敏感文件是否存在于仓库 |
| PreToolUse Hook | "强制性拦截" | v0.3 无此能力（仅 Windsurf） |

validate 做两件事：
1. **规则存在性校验**——确认 security 规则已安装到各平台
2. **文件名黑名单扫描**——检查仓库中是否有敏感文件（仅扫描文件名，不读取内容，零隐私风险）

**不做**：
- ❌ 内容级 PII 扫描（需要读取文件内容，隐私风险高，且需要 regex 引擎持续维护）
- ❌ 独立 `ivy security` 命令（增加 CLI 面，与 validate 功能重叠）

### 4.3 manifest.json 更新

```json
{
  "version": "0.3.0",
  "schemaVersion": 2,
  "skills": [
    "ivy/SKILL.md",
    "ivy/references/explore-fast-track.md",
    "ivy/references/step8-9-closure.md",
    "ivy/references/phase-state-machine.md",
    "ivy/references/cross-cutting.md"
  ],
  "rules": [
    "ivy-phase-guard.md",
    "ivy-security.md"
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

---

## 5. Sprint 3.3：数据源矩阵定义（仅文档化，不做实现）

### 5.1 为什么只做文档

评审核心发现：v0.3 analytics 的问题是"数据源不成立"。与其强行做残缺实现，不如在文档中明确定义矩阵，作为 v0.4 的前置条件。

### 5.2 数据源矩阵（v0.3 文档化）

```
IvyFlow Event Source Matrix (v0.3)

平台                事件源                    可用数据              置信度
─────────────────────────────────────────────────────────────────────────
Claude Code         git diff                 lines_added/removed    low
                    git log                  commit time, author    low
                    ──────────────────────────────────────────────────
                    缺失：PreToolUse Hook（平台不支持）

CodeBuddy           git diff                 lines_added/removed    low
                    git log                  commit time            low
                    ──────────────────────────────────────────────────
                    缺失：PreToolUse Hook

Cursor              git diff                 lines_added/removed    low
                    git log                  commit time            low
                    ──────────────────────────────────────────────────
                    缺失：PreToolUse Hook

GitHub Copilot      git diff                 lines_added/removed    low
                    git log                  commit time            low
                    ──────────────────────────────────────────────────
                    缺失：PreToolUse Hook

Windsurf            PreToolUse Hook          tool_name, file_path   medium
                    git diff                 lines_added/removed    low
                    git log                  commit time            low
                    ──────────────────────────────────────────────────
                    唯一有实时事件源的平台，但覆盖不完整

Trae                git diff                 lines_added/removed    low
                    git log                  commit time            low
                    ──────────────────────────────────────────────────
                    缺失：PreToolUse Hook

Qoder               git diff                 lines_added/removed    low
                    git log                  commit time            low
                    ──────────────────────────────────────────────────
                    缺失：PreToolUse Hook

─────────────────────────────────────────────────────────────────────────
结论：
- 7 平台中仅 1 个有 PreToolUse Hook（Windsurf）
- 其余 6 个平台只能采 git diff（commit 粒度）
- 7 平台均采不到"会话边界"级数据
- 在 PreToolUse Hook 覆盖 ≥ 2 平台之前，analytics 数据偏差不可接受
─────────────────────────────────────────────────────────────────────────
```

### 5.3 v0.4 analytics 的前置条件

1. **数据基础设施**：PreToolUse Hook 在至少 2 个平台上稳定可用，或找到不依赖 Hook 的替代归因方案
2. **数据积累**：.ivy/sessions/ 目录存在且 events.jsonl 有 ≥ 100 条有效事件
3. **需求验证**：有明确用户反馈表示"需要 analytics"（当前 v0.2 无此反馈）

**v0.3 只做到**：在 `.ivy/project.yaml` 中预留 `analytics_enabled: false` 字段，为 v0.4 开关做准备。

---

## 6. Sprint 3.4：测试与发布

### 6.1 测试策略

| TC | 场景 | 覆盖 |
|----|------|------|
| TC-1 | `ivy uninstall --dry-run` 打印清单不删除 | 自动 |
| TC-2 | `ivy uninstall --force` 跳过确认直接删除 | 自动 |
| TC-3 | `ivy uninstall` 默认模式（交互确认） | 自动（mock confirm） |
| TC-4 | `ivy uninstall` 幂等性（重复运行不报错） | 自动 |
| TC-5 | `ivy uninstall` 只删 Ivy 文件，保留用户 hook | 自动 |
| TC-6 | `ivy update` 有更新时打印升级命令 | 自动（mock npm view） |
| TC-7 | `ivy update --check` 返回正确退出码 | 自动 |
| TC-8 | `ivy update` 离线 graceful 退出 | 自动 |
| TC-9 | `ivy validate --security` 检测缺失 security rule | 自动 |
| TC-10 | `ivy validate --security` 检测敏感文件名 | 自动 |
| TC-11 | `ivy-security.md` 分发给 7 平台（参数化） | 自动 |
| TC-12 | v0.2 → v0.3 数据兼容 | 自动 |

### 6.2 发布清单

- [ ] 覆盖率 ≥ 80%（新增模块：uninstall.ts / update.ts / security.ts）
- [ ] CHANGELOG.md 新增 [0.3.0] 段
- [ ] README.md / README.zh-CN.md：命令列表扩展到 6 个（无 analytics）
- [ ] npm publish v0.3.0（跳过 rc，增量非破坏性）
- [ ] §9 红线 CI 持续运行

---

## 7. 工作量估算

| Sprint | 功能数 | 新增文件 | 预估代码行 | 建议耗时 |
|--------|--------|---------|-----------|---------|
| Sprint 3.1 CLI 生命周期 | 2 | uninstall.ts + update.ts + version.ts | ~320 | 2 周 |
| Sprint 3.2 安全规则 | 2 | security.ts + ivy-security.md | ~120 | 1 周 |
| Sprint 3.3 数据源矩阵 | 0 | 仅文档 | ~30 | 1 天 |
| Sprint 3.4 测试与发布 | — | 测试 + 文档 | ~120 | 1 周 |
| **合计** | **4** | **~5 文件** | **~590** | **4-5 周** |

### 执行顺序

```
Week 1-2  Sprint 3.1  uninstall + update（最紧迫的用户缺失）
Week 3    Sprint 3.2  security rule + validate 集成
Week 4    Sprint 3.3  数据源矩阵文档化（不做实现）
Week 4-5  Sprint 3.4  测试 + 回归 + 发布
```

---

## 8. 修订前后对比

### 8.1 修订前（初版 v0.3）的问题

| 问题 | 初版设计 | 评审意见 |
|------|----------|----------|
| analytics 无可靠数据源 | 7 平台 × events.jsonl | "Windsurf-only dashboard" |
| CLI 膨胀 | 7 个命令 | "超出 runtime 能力" |
| uninstall 无安全设计 | 直接删除 | "高风险命令，需要 dry-run" |
| update 过弱 | print command only | "只是提示器" → 接受，不改 |
| security 无执行点 | 仅 rule 分发 | "需要 validate 集成" |
| 数据源矩阵未定义 | 假设全平台可用 | "6/7 平台无事件源" |

### 8.2 修订后的收敛

| 维度 | 初版 | 修订版 |
|------|------|--------|
| CLI 命令数 | 7 | **6**（去掉 analytics） |
| 新增文件数 | ~7 | **~5**（去掉 adoption.ts / analytics.ts） |
| 预估代码行 | ~1,000 | **~590** |
| 建议耗时 | 6 周 | **4-5 周** |
| 数据源矩阵 | 假设成立 | **文档化 + 明确不成立** |
| security 执行点 | 无 | **validate 集成** |
| uninstall 安全 | 无 | **--dry-run + --force + confirm** |

---

## 9. v0.3 → v0.4 演化约束

### 9.1 analytics 的前置条件（v0.4）

1. PreToolUse Hook 在至少 2 个平台上稳定可用，或找到不依赖 Hook 的替代归因方案
2. `.ivy/sessions/` 目录存在且 events.jsonl 有 ≥ 100 条有效事件
3. 有明确用户反馈表示"需要 analytics"

**v0.3 不做 `.ivy/sessions/` 目录创建**——预留字段但不实现，避免空目录长期存在。

### 9.2 §9 红线延续

v0.3 不修改 §9 任何一条红线：

| 红线 | v0.3 状态 |
|------|----------|
| §9.1 render/ ≤ 8 文件 ≤ 50 行 | ✅ 未触动（新增 rule-security.md 不在 render/ 中） |
| §9.2 detect ≤ 4 层 | ✅ 未触动 |
| §9.3 SKILL.md 4 区块 | ✅ 未触动 |
| §9.4 doctor 本地不变量 | ✅ 未触动 |
| §9.5 Skill 推荐前置 | ✅ 未满足，维持不启动 |
| §9.6 Hook 扩展前置 | ✅ Cursor 未满 6 个月 stable |
| §9.7 一句话约束 | ✅ 分发器不是 OS |

### 9.3 一句话约束

> **v0.3 只做两件事：让用户能安全地移除 IvyFlow，让安全规则有执行点。其余能力延后到基础设施成立时。**

---

> **文档维护者**：IvyFlow Team
> **最后更新**：2026-06-17
> **修订记录**：A — 基于设计评审反馈，撤回 analytics + session events，收敛 uninstall + update + security

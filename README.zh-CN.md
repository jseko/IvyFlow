# IvyFlow

> **AI 编码 Agent 的工作流强约束器。**

[English](./README.md)

IvyFlow（`ivyflow-cli`）是一个 CLI 工具，把 Skill、Rule、Git Hook 安装到 AI 编码平台（v0.2 支持 7 个平台），让 Agent 严格按照 **9 步开发工作流** 推进，而不是上来就写代码。

它**不是** LLM 运行时，**不是** SaaS——只是一个跟你 AI 工具一起落地的本地强约束工具。

---

## 为什么需要它

LLM Agent 会漂移。没有外部约束时，它会跳过需求分析、边写边设计、把"实现"当第一步。IvyFlow 把工作流契约变成 Agent **绕不过去**的东西：

- 一份带版本的 **Skill** 描述了 9 步工作流。
- 一份 **Rule** 文件把 Agent 钉在当前阶段，禁止在 `open` / `design` / `archive` 阶段写代码。
- 一个 **Git pre-push 钩子** 阻止任何尚未到达终态（`archive`）的 change 被推送。
- 一份显式的 **TypeScript 状态机** 是唯一的真理来源——构建阶段会从 enum 自动同步到 markdown rule，两边不会漂移。

## 安装

```bash
npm install -g ivyflow-cli
```

需要 Node.js ≥ 20，并且 `git` 在 `PATH` 中。

## 快速开始

在现有项目根目录：

```bash
ivy init                 # quick 模式（无交互），推荐默认
ivy init --standard      # 交互式向导
ivy init --enterprise    # 与 standard 等价 + 预留插件位（v0.1 占位无效）
```

`ivy init` 会做这些事：

1. 检测当前项目是否落地了 7 个平台中的任意一个，并给出 confidence 评分（`1.0` = 配置文件，`0.8` = rules 目录，`0.6` = 泛目录）。
2. `--standard` 模式让你多选平台（confidence ≥ 0.8 默认勾选）；`--quick` 模式自动选取。
3. 当至少一个选中平台暴露 OpenSpec tool id 时，确保 `@fission-ai/openspec` 可用。
4. 把 `ivy` Skill（4 区块结构：ROUTER / CONSTRAINTS / VARIABLES / REFERENCES）复制到每个平台的 skills 目录。
5. 按平台渲染 `ivy-phase-guard` + `ivy-security` Rule：`.md`（Claude / CodeBuddy / Trae / Qoder）、`.mdc`（Cursor）、`.github/copilot-instructions.md`（GitHub Copilot）。
6. 当选中 Windsurf 时安装 PreToolUse Hook（`.windsurf/hooks/ivy-phase-guard.json`）。
7. 安装 `.git/hooks/pre-push`（次级防线）。
8. 写入 `.ivy/project.yaml`，含 `version: '0.3.0'`、`platforms[]`、`detected_platforms[]` 与 `analytics_enabled: false`。

每个 change 的日常命令：

```bash
ivy status                         # 显示 .ivy/project.yaml 中的当前阶段
ivy status --change add-feature-x  # 显示某个 change 的阶段 + 采纳率快照
ivy validate                       # 校验阶段流转 + security rule + 敏感文件名
ivy validate --security=false      # 跳过安全检查
ivy doctor                         # 本地不变量健康检查（无 telemetry / 无网络）
ivy doctor --fix                   # 仅补齐缺失的 skill / rule / hook 文件（绝不重写已有文件）
ivy uninstall                      # 安全移除 IvyFlow 文件（需确认）
ivy uninstall --dry-run            # 预览将要删除的内容
ivy uninstall --force              # 跳过确认（CI 用）
ivy update                         # 检查 npm 是否有新版本，打印升级命令
ivy update --check                 # 返回退出码 0（最新）或 1（有更新）
```

## v0.3 范围

- **6 个命令**：`init` / `status` / `validate` / `doctor` / **`uninstall`** / **`update`**。
- **5 个阶段**：`open → design → build → verify → archive`。`verify → design` 显式禁止。
- **7 个平台**：`claude`、`codebuddy`、`cursor`、`github-copilot`、`windsurf`、`trae`、`qoder`。仅一个 `PlatformConfig` const 数组——无抽象 `Platform` interface、无注册表。
- **per-platform Rule 渲染**：`src/core/render/` 4 文件物理拆分，无 IR、无 Renderer 接口、无 transformer 注册表；`index.ts` 仅 switch 转发（≤ 30 行）。
- **Windsurf PreToolUse Hook**：渲染为 JSON 由 `init` 自动安装；其他平台静默跳过。
- **`ivy doctor`** 严格遵守 §9.4 边界：禁止 telemetry / 网络 / 状态推断；`--fix` 仅补齐缺失文件。
- **`ivy validate --security`**（默认启用）：检查各平台是否已安装 `ivy-security` rule + 扫描敏感文件名（`.env`、`*.pem`、`id_rsa` 等）。零文件内容读取。
- **`ivy uninstall`** 支持 `--dry-run`、`--force`、幂等移除。Git hook 精准移除（仅 IvyFlow 部分），保留用户自定义内容。
- **`ivy update`** 仅检查不自动安装，离线 graceful。
- **§9 演化约束层**（CI 强制）：SKILL.md 必须保持 4 区块且单区块 ≤ 50 行；manifest schema 在构建期校验；`render/` 配额政策化。
- **向后兼容**：v0.1/v0.2 `.ivy/project.yaml` 会被透明读取。

## 已知限制

- 采纳率快照基于 `git diff --shortstat <baseCommit>..HEAD`，**confidence 全部为 `low`**，无法区分 AI 与人类编写的行。
- 仅在 change 阶段为 `archive` 时可生成快照，没有 `--force-snapshot`。
- `ivy validate` 仅输出彩色人类可读文本，v0.3 不提供 `--json`。
- pre-push hook 可以被 `git push --no-verify` 绕过——把 Rule 当作主防线，hook 当作兜底。
- PreToolUse Hook 仅向 **Windsurf** 平台分发（其他 6 个平台没有稳定的契约），其余平台依赖 Rule + Git Hook 两层防御。
- analytics / session events / dashboard 延后到 v0.4（数据源矩阵不满足：6/7 平台缺乏 PreToolUse Hook）。

## 状态机

权威来源是 `src/core/phase-machine.ts`。允许的流转：

```
open    → design, build
design  → build, open
build   → verify, design
verify  → archive, build      （verify → design 被禁止）
archive → （终态）
```

构建脚本会用 enum 重新生成 `assets/rules/ivy-phase-guard.md` 中的阶段段落。CI 跑 `npm run sync-phases:check`，发现漂移直接失败。

## 开发

```bash
npm install
npm run build       # tsc + sync-phases + check-manifest + check-skill-blocks
npm test            # vitest
npm run lint        # eslint flat config
npm run sync-phases:check
npm run check-manifest
npm run check-skill-blocks
```

覆盖率阈值：全局 80%（行 / 分支 / 函数 / 语句），phase machine 强制 100%。当前实测：**92.51%** 行覆盖率。

## License

MIT.

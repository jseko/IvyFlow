# IvyFlow

> **AI 编码 Agent 的工作流强约束器。**

[English](./README.md)

IvyFlow（`ivyflow-cli`）是一个 CLI 工具，把 Skill、Rule、Git Hook 安装到 AI 编码平台（v0.1 仅支持 Claude Code），让 Agent 严格按照 **9 步开发工作流** 推进，而不是上来就写代码。

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

1. 检测平台（v0.1：Claude Code）。
2. 确认 `@fission-ai/openspec` 可用（缺失则本地安装）。
3. 执行 `openspec init --tools claude` 生成 `openspec/`。
4. 把 `ivy` Skill 和 `ivy-phase-guard` Rule 复制到 `.claude/`。
5. 安装 `.git/hooks/pre-push`（次级防线）。
6. 写入 `.ivy/project.yaml`。

每个 change 的日常命令：

```bash
ivy status                         # 显示 .ivy/project.yaml 中的当前阶段
ivy status --change add-feature-x  # 显示某个 change 的阶段 + 采纳率快照
ivy validate                       # 校验所有 openspec/changes/*/.ivy.yaml 的阶段流转合法
```

## v0.1 范围

- **仅 3 个命令**：`init` / `status` / `validate`。
- **5 个阶段**：`open → design → build → verify → archive`。`verify → design` 与"非 archive 强制快照"被显式禁止。
- **2 层防线**：Rule（主防线）+ Git pre-push hook（兜底）。PreToolUse Hook 故意延后到 v0.2。
- **1 个平台**：Claude Code。Cursor / Windsurf / Copilot 是 Phase 2。
- **1 个 spec adapter**：`OpenSpecAdapter`。`SpecAdapter` 接口预留扩展点，`IVY_SPEC_ADAPTER` 环境变量在 v0.1 是 no-op。

## 已知限制

- 采纳率快照基于 `git diff --shortstat <baseCommit>..HEAD`，**confidence 全部为 `low`**，无法区分 AI 与人类编写的行。
- 仅在 change 阶段为 `archive` 时可生成快照，没有 `--force-snapshot`。
- `ivy validate` 仅输出彩色人类可读文本，v0.1 不提供 `--json`。
- 不提供 `ivy doctor` / `ivy uninstall` / `ivy update`，需要时请手动清理。
- pre-push hook 可以被 `git push --no-verify` 绕过——把 Rule 当作主防线，hook 当作兜底。

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
npm run build       # tsc + sync-phases
npm test            # vitest
npm run lint        # eslint flat config
npm run sync-phases:check
```

覆盖率阈值：全局 70%（行 / 分支 / 函数 / 语句），phase machine 强制 100%。

## License

MIT.

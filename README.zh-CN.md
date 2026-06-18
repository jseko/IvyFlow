# IvyFlow

> **AI 编码 Agent 的工作流强约束器。**

[English](./README.md)

IvyFlow（`ivyflow-cli`）是一个 CLI 工具，把 Skill、Rule、Git Hook 安装到 AI 编码平台（v0.8 支持 16 个平台），让 Agent 严格按照 **9 步开发工作流** 推进，而不是上来就写代码。

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

1. 检测当前项目是否落地了 16 个平台中的任意一个，并给出 confidence 评分（`1.0` = 配置文件，`0.8` = rules 目录，`0.6` = 泛目录）。
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
ivy doctor --platforms             # 平台认证报告（v0.8）
ivy analytics                      # 采纳率指标，含数据源透明度
ivy analytics --confidence         # 详细指标级置信度披露
ivy analytics --period 90d --json  # 90 天窗口的 JSON 输出
ivy dashboard                      # 交互式 ASCII 仪表盘
ivy dashboard --team               # 团队级跨 change 聚合（v0.8）
ivy dashboard --html --period 90d  # 导出 HTML 报告
ivy suggest                        # 工作流建议（卡住/回退/阶段评审）
ivy suggest --json                 # JSON 输出含质量指标
ivy suggest --mark-resolved <id>   # 对建议提供反馈
ivy suggest --calibrate            # 运行质量校准（P80 阈值调优）
ivy suggest --quality              # 显示建议质量面板
ivy suggest --explain              # 显示每条建议的内联追踪信息
ivy review                         # 交互式建议处理（接受/关闭/延后/忽略）
ivy review --auto accept --type stuck  # 批量接受所有卡住建议
ivy check                          # CI 非阻塞工作流健康检查
ivy check --change add-feature-x --output markdown  # PR 友好的 markdown 报告
ivy check --env                    # 环境检测（Node.js, Git 等）
ivy explain                        # 建议可追溯性（只读，§9.15）
ivy explain --id <id>              # 追溯特定建议
ivy explain --change <name>        # 按 change 批量追溯
ivy rules                          # 列出和管理 Advisor 规则
ivy rules --info stuck_detection   # 查看规则详情和生效配置
ivy rules --override stuck_detection.build=25  # 覆盖参数（仅派生缓存）
ivy rules --remove stuck_detection.build      # 移除覆盖
ivy archive --change <name>                   # 归档 change
ivy archive --change <name> --report           # 归档并生成本实施报告（v0.8）
ivy uninstall                      # 安全移除 IvyFlow 文件（需确认）
ivy uninstall --dry-run            # 预览将要删除的内容
ivy uninstall --force              # 跳过确认（CI 用）
ivy update                         # 检查 npm 是否有新版本，打印升级命令
ivy update --check                 # 返回退出码 0（最新）或 1（有更新）
```

## v0.8 范围

- **16 个命令**：`init` / `status` / `validate` / `doctor` / `analytics` / `dashboard` / `suggest` / `review` / `check` / `explain` / `rules` / `archive` / `uninstall` / `update`（含 `--platforms`、`--team` 扩展）。
- **Connected Advisor** — 新增实施报告、团队洞察、平台认证能力。
- **`ivy archive --report`** — 生成 `.ivy/reports/<名称>-<日期>.md` 实施报告：Summary、Timeline、Decision Log、Suggestion Impact、Lessons Learned。只读（Derived Cache，不产生新事件）。
- **`ivy doctor --platforms`** — 平台认证报告：扫描全部 16 平台的检测状态、认证等级、skill/rule/hook 安装状态。
- **`ivy dashboard --team`** — 团队级跨 change 仪表盘：项目总览（完成率、周期时间、P80 活跃变更限制）、瓶颈识别（阶段偏差）、建议系统健康度。所有指标含"非因果结论"标注（§9.13）。
- **Metric Layer** — `src/core/metrics/` 统一查询抽象。类型：`MetricQuery`、`MetricResult`。作用域：change 级（阶段时长、提交频率）和 project 级（活跃变更数、完成率）。
- **平台认证** — 11 Certified + 5 Experimental = 16 平台。`PlatformCertification` 类型（`'certified' | 'experimental' | 'planned'`）。
- **新增 Certified 平台**：Gemini CLI、RooCode。
- **新增 Experimental 平台**：Continue、Kilo Code、Auggie/Augment、Kimi Code、Lingma。
- **`rulesBaseDir`** — 平台可选字段，支持非标准规则目录（如 Cline 的 `.clinerules/`）。
- **平台驱动检测** — `CONFIDENCE_BY_PATH` 完全移除。`detectPlatforms` 仅读取 `Platform.detectionPaths`。
- **3 个 Experimental Hook 渲染器** — Gemini（`beforeTool`）、Qwen Code（`preToolUse`）、Kiro（`hook/type`）。标记为 Experimental，不承诺稳定性。
- **CI/CD 模板** — `assets/ci/github-actions.yml` 和 `assets/ci/gitlab-ci.yml`。手动复制，不自动安装。
- **415 个通过测试**，覆盖 38 个测试文件。
- **5 个阶段**：`open → design → build → verify → archive`。`verify → design` 显式禁止。
- **16 个平台**：`claude`、`cursor`、`github-copilot`、`windsurf`、`codebuddy`、`trae`、`qoder`、`cline`、`amazon-q`、`gemini-cli`、`roocode`、`continue`、`kilocode`、`auggie`、`kimi-code`、`lingma`。仅一个 `PlatformConfig` const 数组。
- **`ivy suggest`** — 工作流建议引擎：卡住检测（阶段阈值）、回退检测（7天窗口）、阶段评审（时长 vs 历史平均）。所有建议**仅做建议**（§9.9），携带**唯一 ID**（§9.10），支持反馈闭环。
- **建议反馈闭环** — `--mark-resolved` 记录用户反馈；质量指标（按类型的采纳率）通过 `--json` 查询。
- **Session 推断校准** — 噪音过滤（<1分钟单事件会话）、周末检测、相邻会话合并（<5分钟间隔）、偏差记录。
- **派生缓存层** — `.ivy/sessions/cache/` 含趋势画像、阶段时长统计、流转统计，1小时 TTL。
- **Dashboard v2** — 趋势可视化（提交趋势、阶段时长条、建议质量）、HTML 导出、时段过滤。Dashboard **仅展示**——零建议/推理逻辑。
- **`ivy analytics --bias`** — 查询推理偏差日志。
- **§9 演化约束层**（CI 强制）：SKILL.md 4 区块 ≤ 50 行；manifest schema 构建期校验。
- **向后兼容**：v0.1-v0.7 `.ivy/project.yaml` 被透明读取。

## 已知限制

- 采纳率快照基于 `git diff --shortstat`，**confidence 全部为 `low`**。
- pre-push hook 可被 `git push --no-verify` 绕过——Rule 是主防线，hook 是兜底。
- PreToolUse Hook 仅向 **Windsurf** 分发（唯一稳定契约平台）。
- Session 推断基于 30 分钟启发式，已校准但无 ground truth 验证。
- 建议基于规则（无 ML），效果取决于阈值调优和用户反馈质量。

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

覆盖率阈值：全局 80%（行 / 分支 / 函数 / 语句），phase machine 强制 100%。当前实测：**88.5%** 行覆盖率。

## License

MIT.

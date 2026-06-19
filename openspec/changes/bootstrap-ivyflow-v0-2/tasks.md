# Tasks — bootstrap-ivyflow-v0-2

> 11 个功能 / ~740 LOC / 7 周 / 3 个 sprint。
> 严格遵守 design.md §9 演化约束（render/ 文件数 ≤ 8 + 单文件 ≤ 50 行 / detect confidence ≤ 4 层 / SKILL.md 4 区块单区块 ≤ 50 行 / doctor 严格 local invariant）。

## 1. Sprint 2.1 — 多平台扩展（Week 1-3）

### 1.1 平台配置常量扩展

- [x] 1.1.1 在 `src/core/platforms.ts` 中扩展 `PlatformConfig` 类型：增加 `ruleFormat: 'md' | 'mdc' | 'copilot'` 与 `hookFormat?: 'windsurf-json'` 字段
- [x] 1.1.2 把 `PLATFORM_CONFIGS` 从 1 项扩展到 7 项（claude / codebuddy / cursor / github-copilot / windsurf / trae / qoder），纯数据，禁止引入 `Platform` interface 或 register 函数
- [x] 1.1.3 写 `platforms.test.ts`：验证 7 项条目存在 + id 唯一 + ruleFormat / detectionPath 字段非空
- [x] 1.1.4 在 README / README.zh-CN 的"支持平台"段落预留更新位置（具体内容在 1.10 同步）

### 1.2 confidence 检测增强

- [x] 1.2.1 在 `src/core/detect.ts` 中新增 `CONFIDENCE_BY_PATH` 常量表（路径 → 1.0 / 0.8 / 0.6 三层硬编码）
- [x] 1.2.2 扩展 `PlatformDetectResult` 类型：增加 `confidence: 1.0 | 0.8 | 0.6` 与 `matchedPath: string` 字段
- [x] 1.2.3 实现 `detectPlatforms()` 扫描 7 个 detectionPath，返回带 confidence 的结果数组
- [x] 1.2.4 写 `detect.test.ts`：覆盖 (a) 配置文件命中→1.0 (b) rules 目录命中→0.8 (c) 泛目录命中→0.6 (d) 全部未命中 (e) 多平台同时命中
- [x] 1.2.5 验证 detect.ts 不读取 git history / 网络 / 子进程（lint 规则或 grep 检查）

### 1.3 render/ 物理拆分

- [x] 1.3.1 创建目录 `src/core/render/` 与 `index.ts`（≤ 30 行，仅 switch 转发）
- [x] 1.3.2 实现 `render/rule-mdc.ts`：`renderRuleAsMdc(md: string): string`，添加 Cursor frontmatter（≤ 30 行）
- [x] 1.3.3 实现 `render/rule-copilot.ts`：`renderRuleAsCopilot(md: string): string`，提取 DO / DO NOT 段落（≤ 50 行）
- [x] 1.3.4 实现 `render/hook-windsurf.ts`：`renderHookForWindsurf(): string`，输出合法 JSON 字符串（≤ 30 行）
- [x] 1.3.5 写 `render/*.test.ts`：每个渲染函数最少 1 个 success case + 1 个 edge case（unknown ruleFormat 抛错）
- [x] 1.3.6 在 CI 增加 lint 规则：`render/` 文件数 ≤ 8 + 单文件行数硬上限

### 1.4 Windsurf Hook 安装

- [x] 1.4.1 在 `src/commands/init.ts` 中新增分支：选中 windsurf 时调用 `renderHookForWindsurf` 并写入 `.windsurf/hooks/ivy-phase-guard.json`
- [x] 1.4.2 写 hook 安装测试：模拟选中 windsurf，断言文件存在 + JSON.parse 通过 + 包含 `event: 'PreToolUse'`

### 1.5 init 多平台多选交互

- [x] 1.5.1 在 `src/commands/init.ts` 中新增 `selectPlatforms(detected: PlatformDetectResult[])` 函数
- [x] 1.5.2 使用 `@inquirer/checkbox` 组件，按 confidence 计算默认勾选：1.0 / 0.8 默认勾选，0.6 默认不勾选 + 标注 "(low confidence — please confirm)"
- [x] 1.5.3 quick 模式自动勾选 confidence ≥ 0.8 的平台，不交互
- [x] 1.5.4 standard 模式弹出 checkbox 让用户调整
- [x] 1.5.5 在 `src/core/skills.ts` 中改造 copy 流程，对每个选中平台并行执行 Skill copy + Rule render + Hook install
- [x] 1.5.6 失败的平台记录到 result map，不阻断其他平台
- [x] 1.5.7 写 init E2E 测试基础 fixture（详见 1.7）

### 1.6 .ivy/project.yaml schema 扩展

- [x] 1.6.1 扩展 `.ivy/project.yaml` schema：新增可选字段 `version: '0.2'` / `last_migration: ISO8601` / `detected_platforms[].confidence`
- [x] 1.6.2 验证 v0.1 文件读取兼容（缺失新字段时使用默认值，不报错）
- [x] 1.6.3 写测试：`reads-v01-yaml.test.ts` 加载 v0.1 fixture 文件并断言无错误

### 1.7 Sprint 2.1 集成验证

- [x] 1.7.1 7 平台 × init 集成测试：每平台独立 fixture（claude / cursor / copilot / windsurf）+ 同质平台参数化共享 fixture（codebuddy / trae / qoder）
- [x] 1.7.2 多平台同时安装无文件冲突测试
- [x] 1.7.3 quick 模式 ≤ 30s 性能测试（在 CI 容器中验证）
- [x] 1.7.4 Sprint 2.1 PR 合并前自审 design.md §9.1 红线（render/ 文件数 + 单文件行数）

## 2. Sprint 2.2 — Skill 结构优化（Week 4-5）

### 2.1 SKILL.md 4 区块重写

- [x] 2.1.1 在 `assets/skills/ivy/SKILL.md` 中插入 4 个区块边界标记 `<!-- BLOCK N: <NAME> START -->` / `END`
- [x] 2.1.2 BLOCK 1 (ROUTER) 编写：阶段路由查找表，嵌套深度 ≤ 2，≤ 50 行
- [x] 2.1.3 BLOCK 2 (CONSTRAINTS) 编写：各 phase 硬性约束规则，≤ 50 行
- [x] 2.1.4 BLOCK 3 (VARIABLES) 编写：项目变量占位符列表，≤ 50 行
- [x] 2.1.5 BLOCK 4 (REFERENCES) 编写：指向 references/ 子文档的链接列表，≤ 50 行
- [x] 2.1.6 添加 lint 脚本 `scripts/check-skill-blocks.ts`：解析 SKILL.md 验证 4 个区块存在 + 每区块行数 ≤ 50

### 2.2 references/ 子文件抽出

- [x] 2.2.1 新建 `assets/skills/ivy/references/phase-state-machine.md`：迁移 v0.1 SKILL.md 中的状态机详细描述
- [x] 2.2.2 新建 `assets/skills/ivy/references/cross-cutting.md`：迁移安全 / 可观测 / 知识记忆段落
- [x] 2.2.3 验证 references/ 文件总数 ≤ 10（v0.2 仅 2 个）
- [x] 2.2.4 同步更新 `scripts/sync-phases.ts`：保证 phase enum → phase-state-machine.md 自动同步，CI 跑 sync-phases:check

### 2.3 manifest.json v1 → v2

- [x] 2.3.1 修改 `assets/manifest.json`：顶层 `version: 2`
- [x] 2.3.2 扩展 `skills` 字段：包含 SKILL.md + references/ 两个文件
- [x] 2.3.3 新增 `hooks` 字段：声明 `windsurf` 与 `claude-code` 两个 hook 类型 + 对应路径
- [x] 2.3.4 写 `manifest.test.ts`：验证 v2 schema 字段完整性

### 2.4 Sprint 2.2 集成验证

- [x] 2.4.1 各平台 Skill 复制完整性测试：7 平台分别选中后 `<skillsDir>/skills/ivy/{SKILL.md, references/phase-state-machine.md, references/cross-cutting.md}` 全部存在且字节相同
- [x] 2.4.2 Sprint 2.2 PR 合并前自审 design.md §9.3 红线（区块行数 + references/ 文件数）

## 3. Sprint 2.3 — 质量与发布（Week 6-7）

### 3.1 ivy doctor 命令

- [x] 3.1.1 新建 `src/commands/doctor.ts` 与对应 CLI 注册（`src/cli/index.ts` 添加 `doctor` 子命令）
- [x] 3.1.2 实现 6 项检查：(a) openspec --version (b) .ivy/project.yaml 合法 (c) 各平台 SKILL.md 完整 (d) 各平台 Rule 文件格式合法 (e) windsurf hook JSON 合法 (f) git pre-push hook 存在
- [x] 3.1.3 输出格式化：每项 `✓ <check>` / `✗ <check>: <reason>`，最终 `passed` / `warning` / `failed`，退出码 0 / 1 / 2
- [x] 3.1.4 实现 `--fix` flag：仅补齐缺失文件，禁止修改已存在文件
- [x] 3.1.5 无 `.ivy/` 目录时 graceful 退出（warning，退出码 1）
- [x] 3.1.6 写 `doctor.test.ts`：覆盖全 pass / 部分 fail / --fix 补齐 / 无 .ivy 目录 4 类场景
- [x] 3.1.7 lint 规则：禁止 doctor.ts 出现 `--telemetry` / `--report` / `--upload` / 网络请求

### 3.2 7 平台 E2E 测试

- [x] 3.2.1 搭建 vitest E2E fixture：tmp git repo + 模拟选中平台
- [x] 3.2.2 Claude / Cursor / Copilot / Windsurf 4 个独立 fixture（覆盖 md / mdc / copilot / hook-json 4 种格式）
- [x] 3.2.3 CodeBuddy / Trae / Qoder 参数化测试共享 md fixture（同质平台仅验证目录存在 + md 字节相同）
- [x] 3.2.4 v0.1 → v0.2 兼容测试：用 v0.1 .ivy/project.yaml 启动 ivy status 应输出与 v0.1 一致
- [x] 3.2.5 多平台同时安装事务性边界测试：第 3 个平台失败时前 2 个不回滚（半成功状态可重跑）

### 3.3 文档同步

- [x] 3.3.1 修改 `README.md`：平台列表 1 → 7，命令列表 3 → 4
- [x] 3.3.2 修改 `README.zh-CN.md`：与 EN 版本同步（核心信息一致）
- [x] 3.3.3 新增 `CHANGELOG.md` v0.2.0 条目：Added / Changed / Migration notes
- [x] 3.3.4 把 design.md §9 红线复制到 `CONTRIBUTING.md` PR 模板的 "Architecture impact" 检查项

### 3.4 覆盖率与发布

- [x] 3.4.1 整体行覆盖率 ≥ 70%；`render/` + `detect.ts` + `doctor.ts` 模块 ≥ 80%；`phase-machine.ts` 强制 100%
- [x] 3.4.2 `npm run build && npm test && npm run lint` 全绿
- [x] 3.4.3 `npm pack --dry-run` 验证打包内容包含 7 平台所需 assets
- [x] 3.4.4 决定 npm publish 时机（NEEDS_USER_INPUT #5：直接发 v0.2.0 vs 先发 v0.2.0-rc.1）
- [ ] 3.4.5 `npm publish` v0.2.0（或 rc.1）
- [x] 3.4.6 GitHub release 包含 CHANGELOG 摘录 + design.md §9 红线链接

## 4. NEEDS_USER_INPUT 收敛（Brainstorming 阶段）

> 这些项必须在 Sprint 2.1 启动前与用户确认，避免实现路径回滚。

- [x] 4.1 confidence 边界值：3 层（1.0/0.8/0.6）vs 预留 4 层（+0.4）
- [x] 4.2 doctor --fix 范围：仅补齐缺失 vs 允许重写格式不正确文件
- [x] 4.3 Copilot instructions 渲染层级：保留 markdown 标题层级 vs 扁平化 DO/DO NOT
- [x] 4.4 E2E fixture 策略：Claude/Cursor/Copilot/Windsurf 独立 + CodeBuddy/Trae/Qoder 参数化共享（推荐方案）vs 全部独立 vs 全部参数化
- [x] 4.5 npm publish 时机：v0.2.0 直发 vs 先 rc.1 走 1-2 周
- [x] 4.6 Trae / Qoder 全局目录路径在实现时与平台官方文档交叉确认（detection 仅检测目录存在，不绑定文件名）

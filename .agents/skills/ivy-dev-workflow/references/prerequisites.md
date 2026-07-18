# 前置条件：项目画像解析与 OpenSpec 初始化

> 对应 SKILL.md 章节：前置条件 P0 / P1 / P2 / P3

**使用时机**：当 AI 进入 P0 阶段时，读取本文件获取完整的项目画像解析和初始化规范。

---

## P0：项目画像解析与校验

> 在接收用户需求、执行任何开发步骤之前，需要先建立项目画像。项目画像是后续所有步骤（编译命令生成、测试模板选择、Agent 分派、路径拼接、GitNexus 影响分析）的基础。

**⚠️ 约束：P0 阶段仅读取项目说明文档、配置文件和目录结构，不读取已有业务代码（Entity、Service、Controller 等具体实现文件）。** 此阶段的唯一目的是确定项目画像，不是代码审查。

### P0.1 — 优先读取项目画像文档

优先从现有项目文档中提取技术栈画像，避免每次重复扫描：

| 优先级 | 来源 | 用途 |
|-------:|------|------|
| 1 | 用户本轮显式指定 | 最高优先级，覆盖所有文档和检测结果 |
| 2 | 项目画像缓存（如 `.claude/project-profile.yaml`，若存在） | 复用已确认画像 |
| 3 | `CLAUDE.md` / `CODEBUDDY.md` / `AGENTS.md` / `README.md` | 读取项目类型、语言、框架、构建工具、测试框架、目录约定 |
| 4 | `package.json` / `tsconfig.json` / lockfile / 测试配置 | 校验文档画像是否仍可信 |
| 5 | 自动扫描 | 文档缺失、冲突或过期时兜底 |

> **读取策略**：只读取根目录和 `.claude/` 下的项目级说明文档；不要递归阅读业务代码目录。

### P0.2 — 校验画像并设置核心变量

从项目文档或缓存中提取并设置核心变量：`{PROJECT_TYPE}`, `{BACKEND_DIR}`, `{FRONTEND_DIR}`, `{BACKEND_STACK}`, `{FRONTEND_STACK}`, `{BUILD_TOOL}`, `{TEST_FRAMEWORK}`。开关变量由 P0.3 执行模式自动推导。

若满足以下条件，直接采用项目文档画像，不执行完整扫描：

- 文档已明确项目类型、主要语言/框架、构建工具、测试框架
- 配置文件校验未发现明显冲突（如 `package.json` 依赖与文档声明不一致）
- 用户本轮没有要求重新检测

### P0.2.Fallback — 缺失/冲突/过期时自动检测

仅在以下情况执行配置文件扫描：

- 项目文档不存在或缺少关键字段
- 文档与 `package.json` / `tsconfig.json` / lockfile / 测试配置明显冲突
- 用户显式要求重新检测
- 需要实时状态的工具（OpenSpec / GitNexus / E2E 框架）尚未确认

```bash
# 兜底扫描：只扫描配置文件和目录结构，不读取业务实现
find . -maxdepth 3 -not -path "*/node_modules/*" -not -path "*/.git/*" \( -name "pom.xml" -o -name "build.gradle" -o -name "package.json" -o -name "Cargo.toml" -o -name "go.mod" -o -name "requirements.txt" -o -name "tsconfig.json" \)
find . -maxdepth 2 -type d -not -path "*/node_modules/*" -not -path "*/.git/*"
```

**画像解析、校验、回退输入模板和展示模板** → 参见 [`references/detection-rules.md`](detection-rules.md)

### P0.3 — 选择执行模式

> v3.2 优化：7 个手动开关收敛为 3 种执行模式，子开关由系统自动推导（含 8 个子开关）。用户只需选择模式编号，**不接受回车跳过**。
>
> **⚠️ 探索快速通道例外**：若已触发探索快速通道，则**跳过本步骤**，执行模式自动设为 `standard`。仅当用户未使用探索关键词时才询问模式选择。

```
请选择执行模式（必选）：

  1. quick    — 快速完成，跳过审查和测试（小型 CRUD / 热修复 / 实验性功能）
  2. standard — 标准流程，含代码审查和单元测试（推荐，常规功能迭代）
  3. full     — 完整流程，含安全审查、E2E 测试、Plan Agent（大型/跨模块/安全敏感）

请输入模式编号（1/2/3）：
```

**模式 → 子开关自动推导表**：

| 子开关 | quick | standard | full | 说明 |
|---|:-:|:-:|:-:|---|
| ENABLE_CODE_REVIEW | off | **on** | **on** | 步骤四：代码审查 |
| ENABLE_UNIT_TEST | off | **on** | **on** | 步骤六：测试执行 |
| ENABLE_SECURITY_REVIEW | off | off | **on** | full 模式专属安全审查 |
| ENABLE_E2E_TEST | off | off | **auto** | 跟随 E2E_FRAMEWORK 检测 |
| ENABLE_PLAN_AGENT | off | off | **conditional** | 规模判断后触发（>5 Entity / 跨模块 / 新架构模式 / DB schema 重构），详见 `references/agent-specs.md` §6 |
| ENABLE_KNOWLEDGE_ARCHIVE | off | **on** | **on** | 知识库归档，详见 `references/cross-cutting.md` §10 |
| ENABLE_ASCII_DIAGRAM | **on** | **on** | **on** | ASCII 图始终生成（内置行为，无需运行时判断） |
| ENABLE_MEETING_PARSE | **on** | **on** | **on** | 会议纪要解析始终开启（内置行为），详见 `references/agent-specs.md` §4 |

**⚠️ quick 模式 TDD 跳过理由记录**（仅 quick 模式触发）：

当用户选择 quick 模式时，`ENABLE_UNIT_TEST=off`、TDD Iron Law 不再强制执行。为防止"图省事跳过测试"的随意性，必须显式记录跳过理由：

```
检测到选择 quick 模式（跳过 TDD）。请简述跳过理由（单选）：

  1. 一次性探索/原型，代码不入主干
  2. 紧急生产修复，事后会补回归测试（请在 proposal.md 标注补测试 deadline）
  3. 纯配置/文档/迁移脚本变更，无业务逻辑
  4. 其他（请简述）：____

理由将写入 proposal.md 的"## TDD 豁免说明"章节，便于后续审计。
```

理由记录到 `openspec/changes/{提案名称}/proposal.md` 末尾，模板：

```markdown
## TDD 豁免说明

- 执行模式：quick
- 跳过理由：{用户选择的选项 + 自述}
- 补测试承诺：{若选 2，必填补测试 deadline；其他选项填"无"}
- 决策时间：{YYYY-MM-DD}
```

### P0.4 — 自动检测变量（系统推断，用户无需手动设置）

执行以下自动检测（完整脚本 → [`references/detection-rules.md`](detection-rules.md#p04-自动检测脚本)）：

- **CI_MODE**：检测 GitNexus 可用性，取值 `full`（精确）/ `stale`（索引过期，结果标注"尽力"）/ `no`（AI 推断）
- **E2E_FRAMEWORK**：检测项目中的 playwright/cypress 配置文件，取值 `playwright` / `cypress` / `none`
- **PROJECT_TYPE**：检测项目目录结构，取值 `fullstack` / `backend-only` / `frontend-only`

**设置完成后输出**：

```
✅ 项目配置检测完成

- 项目类型：{PROJECT_TYPE}（fullstack / backend-only / frontend-only）
- 后端目录：{BACKEND_DIR}，技术栈：{BACKEND_STACK}
- 前端目录：{FRONTEND_DIR}，技术栈：{FRONTEND_STACK}
- 构建工具：{BUILD_TOOL}，测试框架：{TEST_FRAMEWORK}
- 执行模式：{EXECUTION_MODE}
  - 代码审查：{ENABLE_CODE_REVIEW}
  - 单元测试：{ENABLE_UNIT_TEST}
  - 安全审查：{ENABLE_SECURITY_REVIEW}（仅 full 模式）
  - E2E 测试：{ENABLE_E2E_TEST}（跟随 {E2E_FRAMEWORK}）
  - 会议纪要解析：{ENABLE_MEETING_PARSE}（始终开启）
- 代码智能层（GitNexus）：{CI_MODE}（full=精确 / stale=尽力 / no=AI 推断）
- E2E 框架：{E2E_FRAMEWORK}

后续步骤将根据以上配置动态启用/跳过对应阶段。
```

> **重要**：一旦在此步骤设置，整个开发流程中保持不变。如需修改，需重新开始会话。

---

## P1：验证 openspec 是否已安装

```bash
openspec --version
```

- **已安装**（输出版本号）→ 跳至 **P3**
- **未安装** → 执行 P2

---

## P2：安装 openspec（仅未安装时执行）

### P2.1 — 确认 AI 工具选择

询问用户使用哪个 AI 编程工具（如用户已指定则跳过）：

```
请问您使用的是哪个 AI 编程工具？
- Claude    → 工具名：claude，    路径：.claude/
- CodeBuddy → 工具名：codeBuddy，路径：.codebuddy/
- Qoder     → 工具名：qoder，    路径：.qoder/
- Trae      → 工具名：trae，     路径：.trae/
```

工具名与路径的完整映射 → 参见 [`references/tool-mapping.md`](tool-mapping.md)

### P2.2 — 执行安装

```bash
npm install -g @fission-ai/openspec@latest
openspec --version
```

**安装失败处理**：

| 失败类型 | 解决方案 |
|---------|---------|
| 权限错误（EACCES） | `sudo npm install -g @fission-ai/openspec@latest` |
| Node.js 版本过低（需 >= 16） | macOS: `brew upgrade node`；Linux: `nvm install --lts` |
| 网络超时 | 添加 `--registry=https://registry.npmmirror.com` 重试 |

**成功标准**：`openspec --version` 输出版本号，无报错。

---

## P3：验证项目是否已初始化

```bash
ls {工具项目相对路径}
```

- **目录已存在** → 跳至步骤一
- **目录不存在** → 执行初始化：

```bash
openspec init --tools {工具名}
```

**成功标准**：`{工具项目相对路径}` 目录生成，无报错退出。

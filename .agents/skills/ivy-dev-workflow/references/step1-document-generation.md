# 步骤一：解析需求，创建提案与测试用例文档

> 对应 SKILL.md 章节：步骤一

**使用时机**：当 AI 进入步骤一（P0/P1/P3 完成后），读取本文件获取完整的文档生成规范。

---

## 1.0 初稿生成与 Brainstorming 修订判断

> Brainstorming 是 `opsx:propose` / 直接生成文档之后的初稿修订阶段。必须先有 proposal/design/specs/tasks 初稿，再进入 Brainstorming 交互入口；Brainstorming 完成后才允许展示步骤二确认模板。

**判断用户输入**：

- 用户输入包含 `探索`、`交互式`、`一步一步`、`/opsx:propose` 等关键词 → 执行 **探索模式**：先生成初稿 artifacts，再强制进入 Brainstorming 修订入口
- 用户输入明确包含 `不要头脑风暴`、`跳过 Brainstorming`、`直接确认`、`自动执行` 等跳过意图 → 生成初稿后执行 **跳过 Brainstorming 模式**，并在 proposal.md 记录"用户显式跳过 Brainstorming"
- 用户输入不含上述关键词且已给出明确功能需求 → 先按 1.1 → 1.9 生成初稿 artifacts，再使用 `AskUserQuestion` 询问是否启用 Brainstorming 修订

**Brainstorming 选择节点（可自动确认，初稿完成后必须执行）**：

在 `openspec status --change "{提案名称}"` 显示 proposal/design/specs/tasks 完成后，读取初稿摘要并使用 `AskUserQuestion` 向用户提出以下单选问题，禁止用普通文本替代。仅当用户在本轮明确授权自动执行或处于 CI/CD 自动化场景时，才允许跳过该问题并按自动判断处理：

```text
OpenSpec 初稿已生成，是否基于初稿进行 Brainstorming/交互式修订？

选项：
1. 启用 Brainstorming（推荐）— 基于初稿中的假设、待确认事项和方案分歧，用 1-4 个关键问题确认修订方向
2. 跳过 Brainstorming — 直接进入步骤二提案文档确认
3. 自动判断 — 由 AI 根据初稿质量和分歧数量决定；若存在 UI/架构/数据/权限/测试等关键分歧，自动进入 Brainstorming
```

**选择处理规则**：

| 用户选择 | 后续动作 |
|---------|----------|
| 启用 Brainstorming | 读取初稿 → 提取关键假设/待确认事项/方案分歧 → AskUserQuestion 收集选择 → 反写 artifacts → 进入步骤二 |
| 跳过 Brainstorming | 不再改动初稿，直接进入步骤二，并在 proposal.md 或 self-review.md 记录"用户选择跳过 Brainstorming" |
| 自动判断 | 若初稿命中关键分歧触发条件则启用 Brainstorming，否则直接进入步骤二并记录判断依据 |

**自动判断触发条件**（初稿命中任一即启用 Brainstorming）：
- 初稿中存在未关闭的"待确认事项"或 `NEEDS_USER_INPUT`
- UI/UX 需求存在展示形式、主题、布局、交互方式选择
- 数据模型、存储方案、权限边界、API 形态存在多种合理方案
- proposal/design/specs/tasks 对范围或验收标准描述不一致
- full 模式或跨模块/安全敏感/新增架构模式
- 用户上一次反馈指出缺少头脑风暴或需求澄清

**探索模式流程**（初稿驱动 Brainstorming）：

1. 确认 P0 技术栈变量已设置（若未设置，先返回 P0 完成技术栈检测）
2. 根据用户需求提炼英文提案名称（规则同 1.1 节）
3. 使用 Skill 工具调用 `opsx:propose` 生成初稿：
   ```
   Skill(skill="opsx:propose", args="{原始需求；请生成 OpenSpec 初稿并标注待确认事项}")
   ```
   `opsx:propose` 会自动处理：change 创建、依赖排序、模板获取、文件生成。**禁止**主 agent 手动执行这些步骤。
4. `opsx:propose` 执行完毕后，验证文件存在性：
   ```bash
   openspec status --change "{提案名称}"
   ```
5. 🔴 Brainstorming 交互修订：读取 proposal/design/specs/tasks 初稿，执行 G1-G5 高频遗漏场景检查表（详见 `references/agent-specs.md` §4.X），命中触发条件的 Gap 合并进 AskUserQuestion 提问列表（总数 ≤ 4），超出部分按 G2 > G1 > G3 > G4 > G5 优先级截断，未提问的 Gap 保留在 proposal.md §待确认事项或 self-review.md 中。使用 `AskUserQuestion` 工具向用户提问，收集对初稿的修订决策（方案选型、范围边界、验收标准、测试优先级）。
6. 将 Brainstorming 选择反写到 proposal.md、design.md、specs/**/*.md、tasks.md；如果 `{ENABLE_UNIT_TEST}=on`，再执行 1.8 生成或更新测试用例文档。
7. 对于生成的标准模板与项目模板的差异，**询问用户**是否需要对齐补充。
8. 跳至 1.9 最终验证

**直接生成模式流程**：按 1.1 → 1.9 顺序执行，跳过交互式探索过程，直接使用项目模板填充。仅允许在用户显式选择"跳过 Brainstorming"、自动判断未命中触发条件，或 CI/CD 自动化场景下进入该模式。

---

## 1.1 生成提案名称

根据用户需求提炼英文提案名称，规则：

- **格式**：kebab-case（全小写，连字符分隔）
- **结构**：`{动词}-{核心对象}-{可选修饰}`，2-5 个词
- **动词约定**：`add`（新增）/ `fix`（修复）/ `update`（更新）/ `remove`（删除）/ `refactor`（重构）/ `optimize`（优化）

```
示例：
"新增用户权限管理模块" → add-user-perm-module
"增加企业微信扫码登录" → add-wechat-work-login
"修复订单状态同步问题" → fix-order-status-sync
"优化数据库查询性能"  → optimize-db-query-perf
```

---

## 1.2 创建 change 目录

```bash
openspec new change "{提案名称}"
```

**成功标准**：目录 `openspec/changes/{提案名称}/` 已创建，包含 `.openspec.yaml` 配置文件。

---

## 1.3 生成 proposal.md

**步骤 1.3 前置**：执行 G1-G5 高频遗漏场景检查表（详见 `references/agent-specs.md` §4.X），
命中触发条件且用户已在需求中覆盖的 → 标记"已覆盖"；命中但未覆盖的 → 写入 proposal.md §待确认事项。

**步骤 1.3a：优先检索现有代码**

在填充模板前，**先通过 GitNexus 检索现有代码库**，理解项目现状：

```bash
# 1. 搜索是否已有相关功能实现
ci_query("{需求核心关键词}")      # 例: ci_query("permission role authorization")

# 2. 了解项目模块结构，确定新功能归属
ci_clusters()                      # 返回功能集群拓扑
```

CI_MODE=no 时降级为：
```bash
rg -i "{关键词}" --type-add 'code:*.{ext}' -t code -l | head -20
find . -maxdepth 2 -type d -not -path "*/node_modules/*" | sort  # 目录结构分析
```

**步骤 1.3b：基于检索结果填充模板**

读取 `templates/proposal-template.md` 模板，**结合代码检索结果 + 用户需求**填充内容，写入 `openspec/changes/{提案名称}/proposal.md`。

**填充要点**：
- **Why**：从用户需求中提取核心问题和动机（1-2 句话）
- **What Changes**：列出所有功能点，**标注与现有代码的关系**（新增模块 / 修改已有模块 / 替换现有实现）
- **Capabilities**：将功能点拆解为独立的能力单元（kebab-case 命名），每个能力对应一个 spec 文件
- **Impact**：**基于 `ci_clusters()` 和 `ci_query()` 的检索结果**，分析对现有模块、依赖的具体影响（引用实际文件名/模块名，而非泛泛描述）

**成功标准**：proposal.md 包含完整的 Why、What Changes、Capabilities、Impact 四个章节；Impact 章节引用了通过代码检索发现的**具体受影响模块**。

---

## 1.4 生成 design.md（使用项目模板）

**步骤 1.4a：优先深度检索现有架构**

在设计技术方案前，**先通过 GitNexus 全面理解现有代码架构**：

```bash
# 1. 搜索已有的设计模式、可复用组件、相似实现
ci_query("{技术关键词}")           # 例: ci_query("middleware pattern repository service")

# 2. 理解集成点的上下文（调用方式、数据格式、约束）
ci_context("{相关模块名}")         # 例: ci_context("AuthService")

# 3. 了解现有数据流/调用链，确保新设计与架构一致
ci_processes()                     # 返回执行流列表
```

CI_MODE=no 时降级为：
```bash
rg -n "class\|interface\|export" --type-add 'code:*.{ext}' -t code | head -30
rg -n "import.*from\|require(" --type-add 'code:*.{ext}' -t code | head -30
Read 关键集成点文件（根据 proposal Impact 章节确定目标文件）
```

**步骤 1.4b：基于检索结果填充模板**

读取 `templates/design-template.md` 模板，**结合深度代码检索结果 + proposal + 技术栈变量**填充内容，写入 `openspec/changes/{提案名称}/design.md`。

**数据来源优先级**：
1. **GitNexus 检索结果**（最高优先级）：现有架构、模块拓扑、调用链、可复用组件
2. **proposal.md**：需求信息、Capability 列表
3. **P0 核心变量**：技术栈、构建工具、测试框架
4. **项目配置**：`CLAUDE.md` 和 `.claude/rules/` 中的编码约定

**Design 关键章节的检索驱动填充**：
- **Context**：引用 `ci_clusters()` 和 `ci_processes()` 的结果，描述现有架构和集成点
- **Decisions**：每个技术决策需对比至少 1 个**项目中已存在的模式**（通过 `ci_query` 发现），说明为何沿用或偏离
- **Architecture Diagram**：将新模块放入 `ci_clusters()` 返回的现有模块拓扑中
- **Risks**：基于 `ci_impact()` 预判对现有模块的影响风险（非事后评估）

> 分级填充策略（P0/P1/P2 章节详情和验证清单）→ [`references/design-generation-guide.md`](design-generation-guide.md)

**成功标准**：design.md 的技术方案基于实际代码库分析（非凭空设计）；Decisions 章节引用了现有模式作为对比；Architecture 章节将新模块嵌入现有拓扑。

**文件写入错误处理**：遇到 `Error writing file` 时，分段写入——首次 Write 创建文件（前 100-150 行），后续 Edit 每次追加 100-150 行，重复直到完整。不要在 Write 失败后重复调用 Write 或跳过文件生成步骤。

---

## 1.5 生成 specs 文档

读取 `templates/spec-template.md` 模板，根据 `proposal.md` 的 Capabilities 列表，为每个 capability 生成对应的 spec 文件。

**执行步骤**：

1. 解析 `proposal.md` 的 "New Capabilities" 部分
2. 为每个 capability 创建目录和文件：
   ```
   openspec/changes/{提案名称}/specs/
   ├── {capability-name-1}/
   │   └── spec.md
   ├── {capability-name-2}/
   │   └── spec.md
   └── {capability-name-3}/
       └── spec.md
   ```

3. 使用 `templates/spec-template.md` 填充每个 spec.md：
   - 功能描述：从 proposal 和 design 中提取
   - 验收标准：明确的、可测试的标准
   - 接口定义：从 design.md 第 5 章提取相关接口
   - 数据模型：从 design.md 第 4 章提取相关表设计
   - 前端组件：从 design.md 第 6 章提取（如有前端）

**成功标准**：
- 每个 capability 都有对应的 spec 文件
- spec 文件包含功能描述、验收标准、接口定义、数据模型
- OpenSpec 能识别 specs 为 "done" 状态

---

## 1.6 验证 OpenSpec 状态

```bash
openspec status --change "{提案名称}" --json
```

**预期输出**：
```json
{
  "artifacts": [
    {"id": "proposal", "status": "done"},
    {"id": "design", "status": "done"},
    {"id": "specs", "status": "done"},
    {"id": "tasks", "status": "ready"}
  ]
}
```

**如果状态不符合预期**：检查文件路径和内容是否正确，OpenSpec 通过文件存在性判断状态。

---

## 1.7 生成 tasks.md（使用项目模板）

读取 `templates/tasks-template.md` 了解任务格式，根据 `design.md` 第 13 章（实施计划）生成任务清单，写入 `openspec/changes/{提案名称}/tasks.md`。

**任务格式**（参考 tasks-template.md）：
```markdown
- [ ] {序号}. {任务描述}
  - File: {文件路径}
  - {详细说明}
  - Purpose: {任务目的}
  - _Leverage: {复用的现有组件/工具}_
  - _Requirements: {对应的需求编号}_
  - _Prompt: Role: {角色} | Task: {任务} | Restrictions: {限制} | Success: {成功标准}_
```

**任务拆解规则**：

| 类型 | 拆解粒度 | 示例 |
|------|----------|------|
| 后端 | 每个实体类、Repository、Service、Controller | 创建 User 实体类 |
| 前端 | 每个页面、组件、Store 模块 | 创建 UserListPage 组件 |
| 配置 | 数据库脚本、配置文件修改 | 创建数据库迁移脚本 |
| 测试 | 单元测试、集成测试 | 编写 UserService 单元测试 |

**任务顺序**（按依赖关系）：
1. 数据库设计与迁移
2. 实体类创建
3. Repository 创建
4. Service 创建
5. Controller 创建
6. 前端页面创建
7. 前端组件创建
8. 集成测试
9. 部署验证

**成功标准**：
- tasks.md 包含至少 10 个具体任务
- 每个任务有明确的文件路径和详细说明
- 任务顺序符合依赖关系
- 包含 _Leverage_、_Requirements_、_Prompt_ 等元信息

---

## 1.8 生成测试用例文档

> **开关控制**：本步骤受 `{ENABLE_UNIT_TEST}` 变量控制。
> - `{ENABLE_UNIT_TEST}=on` → 执行本步骤
> - `{ENABLE_UNIT_TEST}=off`（默认）→ 跳过本步骤，不生成 test-cases.md，不追加测试任务到 tasks.md
>
> 跳过时输出提示：`⏭️ 单元测试开关已关闭（ENABLE_UNIT_TEST=off），跳过测试用例文档生成`

**仅当 `{ENABLE_UNIT_TEST}=on` 时执行以下内容：**

生成 `openspec/changes/{提案名称}/test-cases.md`，同时将测试实现任务追加到 `tasks.md`。

**完整的提示词和输出文档结构** → 参见 [`templates/test-cases-prompt.md`](../templates/test-cases-prompt.md)

**成功标准**：
- `{ENABLE_UNIT_TEST}=on`：`test-cases.md` 已生成，三个章节齐全，用例编号完整，测试框架与 `{TEST_FRAMEWORK}` 一致，`tasks.md` 末尾已追加测试实现任务
- `{ENABLE_UNIT_TEST}=off`：跳过本步骤，不生成 test-cases.md，tasks.md 中无测试相关任务

---

## 1.9 最终验证

```bash
openspec status --change "{提案名称}"
```

**预期输出**：
```
Change: add-user-permission-module
Schema: spec-driven
Status: Ready for implementation

Artifacts:
✓ proposal.md
✓ design.md
✓ specs/**/*.md
✓ tasks.md

Ready to apply: /opsx:apply add-user-permission-module
```

**成功标准**：
- 所有 artifacts 状态为 "done"
- `isComplete: false`（尚未实施）
- `applyRequires` 中的所有 artifacts 都已完成

---

## 1.10 Spec Self-Review（文档质量自动检查）

> 在进入步骤二用户确认前，由主 Agent 自动对 proposal.md、design.md、specs/**/*.md、tasks.md 执行三级自检，将结果附在步骤二确认界面上。

**执行时机**：1.9 最终验证通过后、步骤二用户确认展示前。

### P0 — Placeholder 扫描（阻断级，发现即修复）

检测以下模式（不区分大小写）并向用户展示前自动修复：

```
TBD / TODO / FIXME / 待定 / 待补充 / 待确认 / 暂略 / xxx / ??? 
{占位} / [待填写] / <待定> / （省略） / （略）
```

**自动修复规则**：
1. 上下文充分（如 design.md 已定义对应内容）→ 自动填充合理值
2. 上下文不足 → 替换为具体问题描述（如 `§性能目标：待确认——当前峰值 QPS 和 P99 延迟要求？`）
3. 无法修复的 → 在 Self-Review 报告中标注 `NEEDS_USER_INPUT`，不阻断流程

### P1 — 内部一致性检查（警告级，高亮展示）

| 检查项 | 检查方式 |
|-------|---------|
| proposal 与 design 的功能范围是否一致 | 对比 proposal §功能点 vs design §功能范围 |
| tasks.md 任务数与 design §实现计划任务数是否匹配 | 计数对比 |
| specs/ 中引用的接口是否都在 design §接口清单中出现 | 接口名/路径交叉引用 |
| test-cases.md 测试场景是否覆盖 proposal 的所有验收标准 | 关键词映射（仅 ENABLE_UNIT_TEST=on） |

### P2 — 格式完整性（提示级，不阻断）

| 检查项 |
|-------|
| proposal.md 是否包含 §背景、§功能范围、§验收标准 三个必要章节 |
| design.md 是否包含 §接口设计 或 §数据模型 章节（至少一个） |
| tasks.md 是否所有任务都有文件路径标注 |

### 自检报告输出

以折叠形式附在步骤二确认消息后，格式如下：

```
📋 Spec Self-Review 报告（自动生成）

✅ P0 Placeholder 扫描：通过（0 处占位符）
⚠️  P1 一致性检查：1 处警告
   - tasks.md 任务数（12）与 design §实现计划（10）不一致，建议确认是否遗漏
✅ P2 格式完整性：通过

自检详情：openspec/changes/{提案名称}/self-review.md

─────────────────────────────
如以上警告不影响您的判断，可直接回复 [确认无误] 继续
```

**自检结果同时写入** `openspec/changes/{提案名称}/self-review.md`，包含每项检查的状态（PASS / FIXED / NEEDS_USER_INPUT）和修复动作记录。

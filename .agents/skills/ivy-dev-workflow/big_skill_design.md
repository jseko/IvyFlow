# Big Skill 优化设计方案

> 目标：将 `.codebuddy/skills/ivy-dev-workflow/SKILL.md` 从 **1670 行**缩减至 **~450 行**，
> 同时保持功能完整性，通过渐进式披露（Progressive Disclosure）按步骤加载详细规范。

---

## 一、问题分析

### 1.1 当前状态

| 指标 | 数值 | 推荐上限 | 超标倍数 |
|------|------|----------|----------|
| SKILL.md 总行数 | 1670 | 500 | 3.3x |
| 始终占用 token（估算） | ~25K | ~7.5K | 3.3x |
| references/ 已有文件 | 19 | — | — |
| templates/ 已有文件 | 14 | — | — |

### 1.2 问题根因

SKILL.md 将**工作流编排**（决策路由、阶段衔接）和**步骤细节**（命令、模板、检查清单）混在同一个文件中，导致：

1. **Token 浪费**：AI 在执行步骤三时，步骤七八的详细规范也全部在上下文中
2. **注意力稀释**：1670 行中关键决策点被大量命令示例淹没
3. **维护困难**：修改某步骤细节需要在 1670 行中定位
4. **违反 Progressive Disclosure 原则**：Skill Creator 指南明确推荐 SKILL.md < 500 行

### 1.3 各章节行数分布

| 章节 | 行数 | 占比 | 可提取 |
|------|------|------|--------|
| Frontmatter + 总览 | 70 | 4% | 否 |
| 探索快速通道 | 75 | 4% | ✅ → `explore-fast-track.md` |
| 附属文件索引 | 45 | 3% | 否（保留精简版） |
| P0 项目画像 | 132 | 8% | ✅ → `prerequisites.md` |
| P1/P2/P3 前置条件 | 60 | 4% | ✅ → `prerequisites.md` |
| 代码智能层 | 22 | 1% | 否（已引用 code-intelligence-layer.md） |
| **步骤一：文档生成** | **380** | **23%** | ✅ → `step1-document-generation.md` |
| **步骤三：代码实现** | **293** | **18%** | ✅ → `step3-implementation.md` |
| 步骤四：代码审查 | 110 | 7% | ✅ → `step4-7-quality-gates.md` |
| 步骤五：编译验证 | 52 | 3% | ✅ → `step4-7-quality-gates.md` |
| 步骤六：测试执行 | 80 | 5% | ✅ → `step4-7-quality-gates.md` |
| 步骤七：功能确认 | 86 | 5% | ✅ → `step4-7-quality-gates.md` |
| 步骤八九：收尾归档 | 90 | 5% | ✅ → `step8-9-closure.md` |
| 尾部概要章节 | 50 | 3% | 否（精简保留） |
| 关键约束 | 44 | 3% | 否（核心约束必须始终可见） |
| 流程状态机 | 20 | 1% | 否（精简保留） |

---

## 二、优化策略

### 2.1 核心原则

**Progressive Disclosure 三层加载**：

```
Layer 1: SKILL.md（始终在上下文，~450 行）
  → 工作流编排：阶段顺序、决策路由、变量定义、确认节点
  → 精简摘要：每步骤仅保留「做什么 + 何时读哪个 reference」

Layer 2: references/（按步骤按需加载，每个 ~100-400 行）
  → 步骤详细规范：命令、模板引用、检查清单、代码示例
  → AI 到达某步骤时才读取对应 reference

Layer 3: templates/（仅文件生成时读取）
  → 文档模板、报告模板（不变）
```

### 2.2 提取规则

| 规则 | 说明 |
|------|------|
| **编排留在 SKILL.md** | 流程顺序、决策路由、确认节点、变量定义、开关控制 |
| **细节提取到 reference** | 具体命令、代码示例、检查清单、填充模板的步骤、错误处理表 |
| **引用路径明确** | SKILL.md 中用 `→ 参见 references/xxx.md` 指引，AI 到达该步骤时 `read_file` |
| **步骤摘要 ≤ 10 行** | SKILL.md 中每个步骤仅保留目标、输入输出、关键约束和引用指针 |

---

## 三、新文件结构

### 3.1 references/ 新增文件

| 新文件 | 来源章节 | 预估行数 | 内容摘要 |
|--------|----------|----------|----------|
| `explore-fast-track.md` | 探索快速通道（L72-146） | ~80 | 触发条件、快速通道流程（步骤A-E）、关键行为、例外规则 |
| `prerequisites.md` | P0/P1/P2/P3（L196-391） | ~200 | P0.1-P0.4 画像解析、P1-P3 安装初始化、自动检测脚本、输出模板 |
| `step1-document-generation.md` | 步骤一（L417-795） | ~390 | 1.0-1.10 完整步骤、Brainstorming 判断、proposal/design/specs/tasks 生成细节、Self-Review |
| `step3-implementation.md` | 步骤三（L838-1131） | ~300 | 3.0-3.7 影响检查、TDD 纪律、Agent 分派、Delta Spec 反写、BLOCKED 规则 |
| `step4-7-quality-gates.md` | 步骤四~七（L1134-1473） | ~340 | 代码审查流程、编译修复循环、全量回归测试、Verification Gate、汇报模板 |
| `step8-9-closure.md` | 步骤八九（L1476-1564） | ~90 | 实现报告生成、归档选项处理、归档前检查 |

### 3.2 SKILL.md 精简后结构（~450 行）

```
SKILL.md（精简后）
├── Frontmatter（~18 行，不变）
├── Ivy 开发工作流 总览（~10 行，精简）
├── 五阶段别名层（~12 行，不变）
├── 交互节点分级（~8 行，不变）
├── 流程顺序约定（~15 行，精简，保留核心规则，删除重复细节）
├── 附属文件索引（~30 行，更新索引表，新增6个reference）
├── 探索快速通道（~15 行，摘要 + 指针 → references/explore-fast-track.md）
├── P0 项目画像（~15 行，摘要 + 指针 → references/prerequisites.md）
├── P1/P2/P3 前置条件（~10 行，摘要 + 指针 → references/prerequisites.md）
├── 代码智能层（~10 行，不变，已有引用）
├── 步骤一：文档生成（~25 行，摘要 + 指针 → references/step1-document-generation.md）
├── 步骤二：提案确认（~25 行，保留确认模板，精简修复约束）
├── 步骤三：代码实现（~25 行，摘要 + 指针 → references/step3-implementation.md）
├── 步骤四：代码审查（~10 行，摘要 + 指针 → references/step4-7-quality-gates.md）
├── 步骤五：编译验证（~8 行，摘要 + 指针）
├── 步骤六：测试执行（~8 行，摘要 + 指针）
├── 步骤七：功能确认（~10 行，摘要 + 指针）
├── 步骤八：实现报告（~5 行，摘要 + 指针 → references/step8-9-closure.md）
├── 步骤九：归档确认（~10 行，摘要 + 指针）
├── 安全护栏/可观测性/知识引擎（~10 行，保留指针，已引用 cross-cutting.md）
├── 流程状态机（~20 行，保留精简版）
├── 关键约束（~40 行，保留全文——核心约束需始终可见）
├── 扩展性指引（~3 行，指针）
└── 合计约 ~450 行
```

### 3.3 精简前后对比

| 维度 | 精简前 | 精简后 | 降幅 |
|------|--------|--------|------|
| SKILL.md 行数 | 1670 | ~450 | **-73%** |
| 始终占用 token | ~25K | ~7K | **-72%** |
| references 文件数 | 19 | 25（+6） | — |
| 按需加载总行数 | 0 | ~1400 | 分散在6个文件中 |

---

## 四、SKILL.md 精简模板示例

以「步骤三：代码实现」为例，展示精简前后的差异：

### 4.1 精简前（293 行，全部内联）

```markdown
## 步骤三：代码实现

> ⚠️ 前置条件：...

### 3.0 实现前影响检查（调用 ci_impact）
[~15 行命令和流程]

### 3.1 前置操作：读取并锁定 tasks.md
[~8 行]

### 3.2 任务执行与标记
[~70 行详细规则 + TDD 纪律 + 代码示例 + Red Flags]

### 3.3 实现规范与 Agent 分派规则
[~60 行 Agent 路由表 + Task 调用模板]

### 3.4 遇到设计歧义时
[~15 行暂停提问模板]

### 3.5 步骤三完成校验
[~15 行命令]

### 3.6 实现后变更检测
[~10 行]

### 3.7 Delta Spec 反写
[~60 行双层检查 + 生成模板]
```

### 4.2 精简后（~25 行，摘要+指针）

```markdown
## 步骤三：代码实现

> ⚠️ 前置条件：proposal.md / design.md / specs/ / tasks.md 全部存在且通过步骤二确认。

**目标**：按 tasks.md 顺序逐个实现，保持依赖关系。

**关键约束**：
- 文档先于代码：步骤二确认前不创建代码文件
- 一任务一标记：完成即 Edit 标记 `[x]`
- TDD 纪律（ENABLE_UNIT_TEST=on）：RED → GREEN → REFACTOR，违规则 STOP
- Agent 分派：每个代码文件由专业 Agent 实现（详见 `references/agent-mapping.md`）
- 调试止损：同一 Bug ≥ 3 次 → BLOCKED，禁止第 4 次自动修复

**步骤流程**（完整细节 → [`references/step3-implementation.md`](references/step3-implementation.md)）：

| 子步骤 | 目的 | 关键动作 |
|--------|------|----------|
| 3.0 影响检查 | 预判修改风险 | `ci_impact(target, "both")`，CRITICAL 暂停 |
| 3.1 锁定 tasks | 确认执行依据 | 读取 tasks.md，确认 `- [ ]` 状态 |
| 3.2 逐任务实现 | 编写代码 | 选 Agent → 实现 → 标记 `[x]` → 验证 |
| 3.3 Agent 分派 | 专业实现 | 按 `references/agent-mapping.md` 路由 |
| 3.4 歧义暂停 | 避免猜错 | 向用户提问，不自行假设 |
| 3.5 完成校验 | 进度核查 | `grep -c '\- \[ \]'` 应为 0 |
| 3.6 变更检测 | 范围对比 | `ci_detect_changes()` vs tasks.md |
| 3.7 Delta Spec | 规格偏差反写 | 仅 ENABLE_CODE_REVIEW=on 时执行 |

**步骤三完成后** → 提示"进入步骤四：代码审查"（ENABLE_CODE_REVIEW=on）或"进入步骤五：编译验证"
```

---

## 五、实施步骤

### Phase 1：创建 reference 文件（不修改 SKILL.md）

> 风险最低：仅新增文件，不影响现有工作流

1. **创建 `references/explore-fast-track.md`**
   - 从 SKILL.md L72-146 提取探索快速通道完整内容
   - 顶部添加目录和使用指引

2. **创建 `references/prerequisites.md`**
   - 从 SKILL.md L196-391 提取 P0/P1/P2/P3 完整内容
   - 合并 P0.1-P0.4、P1-P3 所有子步骤

3. **创建 `references/step1-document-generation.md`**
   - 从 SKILL.md L417-795 提取步骤一完整内容
   - 包含 1.0-1.10 所有子步骤、Brainstorming 判断、Self-Review

4. **创建 `references/step3-implementation.md`**
   - 从 SKILL.md L838-1131 提取步骤三完整内容
   - 包含 3.0-3.7、TDD 纪律、Agent 分派、Delta Spec

5. **创建 `references/step4-7-quality-gates.md`**
   - 从 SKILL.md L1134-1473 提取步骤四~七完整内容
   - 包含代码审查、编译修复、测试执行、Verification Gate

6. **创建 `references/step8-9-closure.md`**
   - 从 SKILL.md L1476-1564 提取步骤八九完整内容
   - 包含实现报告、归档选项、归档前检查

### Phase 2：精简 SKILL.md（逐步骤替换）

> 每次替换一个章节，确保功能不变

1. 替换「探索快速通道」→ 摘要 + 指针
2. 替换「P0 项目画像」→ 摘要 + 指针
3. 替换「P1/P2/P3」→ 摘要 + 指针
4. 替换「步骤一」→ 摘要 + 指针
5. 替换「步骤三」→ 摘要 + 指针
6. 替换「步骤四~七」→ 摘要 + 指针
7. 替换「步骤八九」→ 摘要 + 指针
8. 更新「附属文件索引」表
9. 精简「流程顺序约定」（删除与关键约束重复的内容）

### Phase 3：验证

1. **功能完整性**：确保精简后 SKILL.md 的每个步骤指针指向正确的 reference 文件
2. **行数检查**：确认 SKILL.md ≤ 500 行
3. **端到端测试**：用一个简单的功能需求走一遍完整流程，确认 AI 在每个步骤正确读取 reference

---

## 六、关键约束精简策略

> 关键约束（L1620-1664）是 44 行核心规则，必须始终在 SKILL.md 中可见。
> 但可以通过合并重复项缩减至 ~30 行：

| 合并策略 | 说明 |
|----------|------|
| 合并规则 1 和 5 | 都关于"顺序/变量驱动"，合并为一条 |
| 合并规则 6 和 8 | 都关于"最小化/即时性"，合并为一条 |
| 规则 9 已有引用 | Agent 职责边界 → `references/agent-mapping.md`，删除内联重复 |
| 规则 13 已有引用 | 代码检索优先 → `references/code-intelligence-layer.md`，精简为 1 句 |

---

## 七、风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| AI 不读取 reference 文件 | SKILL.md 中每个步骤用 `→ 读取 references/xxx.md 获取完整规范` 明确指令 |
| 按需加载增加总 token | 实际减少：始终加载从 25K → 7K，按需加载仅 ~2-3K/步骤 |
| Reference 文件间交叉引用 | 每个 reference 文件顶部列出依赖的其他 reference |
| 步骤间信息丢失 | SKILL.md 保留所有变量定义和开关控制，reference 仅提供操作细节 |
| 维护两个层级 | 每个 reference 文件头部标注对应的 SKILL.md 章节号，便于对齐更新 |

---

## 八、预期效果

| 效果 | 说明 |
|------|------|
| **Token 节省** | 始终加载从 ~25K 降至 ~7K，节省 72% |
| **注意力聚焦** | AI 在步骤三时只看步骤三的 reference，不被其他步骤干扰 |
| **维护友好** | 修改步骤三细节只需编辑 `step3-implementation.md`，不动 SKILL.md |
| **可扩展性** | 新增步骤只需新建 reference + 在 SKILL.md 加指针 |
| **符合 Skill 最佳实践** | SKILL.md < 500 行，Progressive Disclosure 三层加载 |

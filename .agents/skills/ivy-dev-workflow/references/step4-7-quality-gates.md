# 步骤四~七：质量门禁

> 对应 SKILL.md 章节：步骤四（代码审查）/ 步骤五（编译验证）/ 步骤六（测试执行）/ 步骤七（功能确认）

**使用时机**：当 AI 进入步骤四、五、六或七时，读取本文件获取完整的质量门禁规范。

---

## 步骤四：代码审查与修复

> **开关控制**：本步骤受 `{ENABLE_CODE_REVIEW}` 变量控制。
> - `{ENABLE_CODE_REVIEW}=on` → 执行本步骤
> - `{ENABLE_CODE_REVIEW}=off`（默认）→ 跳过本步骤，直接进入步骤五
>
> 跳过时输出提示：`⏭️ 代码审查开关已关闭（ENABLE_CODE_REVIEW=off），跳过步骤四`

> **Phase 2 规划**：当前为批量审查模式（所有任务完成后统一审查）。Phase 2 将演进为逐任务两阶段审查（Spec 合规 + 代码质量），详见 `references/agent-mapping.md` 逐任务审查分派规则。

> **Delta Spec 联动**：如果 `specs/delta.md` 存在，将其中的遗漏场景（Layer 2 代码级遗漏）作为代码审查的额外检查维度。

代码审查阶段对步骤三产出的所有变更代码进行质量审查，按严重级别分级报告并驱动修复。

### 4.1 审查 Agent 分派

**根据 `{BACKEND_STACK}` 和 `{FRONTEND_STACK}` 选择审查 Agent（通过 Task 工具调用）：**

| 审查对象 | Agent | 触发条件 | 调用示例 |
|---------|-------|---------|---------|
| Java/Spring Boot 代码 | `java-reviewer` | standard / full 模式 | `Task(subagent_name="java-reviewer", description="审查后端代码", prompt="…")` |
| JS/TS/Vue 前端代码 | `typescript-reviewer` | standard / full 模式 | `Task(subagent_name="typescript-reviewer", description="审查前端代码", prompt="…")` |
| 安全专项审查 | `security-reviewer` | **仅 full 模式**（`ENABLE_SECURITY_REVIEW=on`） | `Task(subagent_name="security-reviewer", description="安全专项审查", prompt="…")` |
| 无可用的专用审查 Agent | 主 agent 直接审查（输出 fallback 日志）| — | — |

### 4.2 审查流程

**审查范围确定**（git SHA 精确范围）：

```bash
# 获取步骤三开始前的 HEAD 作为基准
BASE_SHA=$(git rev-parse HEAD~1)   # 或步骤三开始前的 HEAD
HEAD_SHA=$(git rev-parse HEAD)
```

审查 Agent prompt 中以 `git diff BASE_SHA HEAD_SHA --name-only` 的输出作为审查范围，仅审查变更文件，避免全量扫描。

1. 使用 Task 工具调用对应的审查 Agent
2. 审查 Agent 自动运行 git diff 定位变更文件
3. 按 severity（CRITICAL > HIGH > MEDIUM > LOW）分级报告问题
4. 将审查报告写入 `openspec/changes/{提案名称}/review-001.md`
5. 按优先级修复 CRITICAL 和 HIGH 级别问题

**审查提示词模板和修复记录格式** → 参见 [`templates/review-prompt.md`](../templates/review-prompt.md)

**成功标准**：所有 `CRITICAL` 和 `HIGH` 级别问题已修复并记录。

### 4.3 审查反馈响应规范

> 收到审查反馈后的结构化响应流程。**严禁表演性同意（"You're absolutely right!"）和盲目实施。**

**6 步响应模式**：

```
WHEN 收到审查反馈:
  1. READ: 完整阅读所有反馈，不急于反应
  2. UNDERSTAND: 用自己的话复述每条建议的技术要求
  3. VERIFY: 检查每条建议在当前代码库中的技术正确性
  4. EVALUATE: 判断是否 YAGNI / 破坏现有功能 / 违反项目架构决策
  5. RESPOND: 技术性确认或理性反驳（禁止表演性同意）
  6. IMPLEMENT: 一次一条，测试每一条
```

**禁止响应清单**：
- "You're absolutely right!" / "Great point!" / "Excellent feedback!"（表演性同意）
- "Let me implement that now"（验证前急于实施）
- 任何感谢表达（代码本身就证明你听到了反馈）

**反馈处理优先级**：

| 优先级 | 类型 | 处理策略 |
|--------|------|---------|
| 1 | Blocking（安全漏洞/数据丢失/崩溃） | 立即修复，阻塞后续任务 |
| 2 | Simple（typo/import 缺失/命名） | 快速批量修复 |
| 3 | Complex（重构/逻辑变更/架构调整） | 逐条评估后单独修复 |

**YAGNI 审查建议**：当审查者建议"properly implement"某功能时，先 grep 代码库确认实际调用方：
- 无人调用 → "This isn't called anywhere. Remove it (YAGNI)?"
- 有调用方 → 实施 proper implementation

**"先澄清再实施"规则**：

```
IF 多条反馈中有任何一条不清楚:
  STOP. 先澄清全部不清楚的条目.

示例:
  审查反馈 6 条，理解 1,2,3,6，不清楚 4,5.
  ❌ WRONG: 先实施 1,2,3,6，稍后再问 4,5
  ✅ RIGHT: "理解条目 1,2,3,6。需要澄清条目 4 和 5 后再开始实施"
```

**来源区分处理**：

| 来源 | 处理策略 |
|------|---------|
| Human partner（用户） | 信任但确认范围；跳过感谢直接行动 |
| External reviewer | 验证技术正确性 → 检查是否破坏现有功能 → 检查是否理解完整上下文 → 理性反驳或实施 |

**修复记录格式**（追加到 `review-001.md`）：

```markdown
## 修复记录

| 问题编号 | 级别     | 文件:行号                | 问题描述       | 修复方式         | 状态      |
|--------|---------|------------------------|--------------|----------------|---------|
| C-001  | CRITICAL | UserMapper.java:45     | SQL 注入风险   | 改用参数化查询    | ✅ 已修复 |
| H-001  | HIGH     | UserService.java:56    | 缺少事务注解    | 添加 @Transactional | ✅ 已修复 |
| M-001  | MEDIUM   | UserController.java:120 | 响应格式不一致  | 统一 ResponseEntity | ⏭️ 跳过 |
```

---

## 步骤五：编译验证与错误修复

代码审查修复完成后，根据 `{BUILD_TOOL}` 和 `{PROJECT_TYPE}` 动态生成并执行编译命令。

### 5.1 执行编译

**编译命令映射** → 参见 [`references/build-commands.md`](build-commands.md) "编译命令映射"章节

### 5.2 编译错误诊断与修复

若编译失败，根据 `{BACKEND_STACK}` 选择处理方式：

- `{BACKEND_STACK}=spring-boot` → 使用 `java-build-resolver` agent
- 其他技术栈 → 通用错误分类处理

**通用错误分类表** → 参见 [`references/build-commands.md`](build-commands.md) "通用编译错误分类"章节

### 5.3 修复循环与降级策略

编译失败时执行以下修复循环，**最多 3 轮**：

```
第 1 轮编译 → 失败 → 诊断 → 修复 → 第 2 轮编译
                                          │
                                    失败 → 诊断 → 修复 → 第 3 轮编译
                                                          │
                                                    失败 → 降级处理
```

- **第 1-2 轮**：自动诊断修复，每轮修复后重新执行编译命令验证
- **第 3 轮仍失败**：停止自动修复，生成 `build-resolver-001.md`，暂停流程提示用户介入

**修复记录文档模板、java-build-resolver 调用提示词和降级提示** → 参见 [`templates/build-resolver.md`](../templates/build-resolver.md)

**修复约束**：
- 仅做最小必要修复，不重构无关代码
- 不使用 `@SuppressWarnings`、`// @ts-ignore`、`eslint-disable` 等方式抑制警告
- 修复后需通过编译验证

**成功标准**：所有编译命令无错误退出（exit code 0）。

### 5.4 编译通过后任务标记校验

编译成功后，再次检查 tasks.md 中的任务标记状态：

```
⚠️ 编译已通过，请确认以下检查项：
1. tasks.md 中已实现的实现任务是否全部标记 - [x]？
2. 是否有遗漏标记的任务？
3. 测试类任务（Phase 5）若 ENABLE_UNIT_TEST=off 可保持 - [ ] 状态
```

**如发现遗漏标记**：使用 Edit 工具逐任务补标记，遗漏会导致进度追踪失真。

---

## 步骤六：全量回归测试与覆盖率审查

> **开关控制**：本步骤受 `{ENABLE_UNIT_TEST}` 变量控制。
> - `{ENABLE_UNIT_TEST}=on` → 执行本步骤
> - `{ENABLE_UNIT_TEST}=off`（默认）→ 跳过本步骤，直接进入步骤七
>
> 跳过时输出提示：`⏭️ 单元测试开关已关闭（ENABLE_UNIT_TEST=off），跳过步骤六`
>
> TDD 模式下（standard/full），步骤三已完成单元测试编写。本步骤聚焦**全量回归验证 + 集成测试 + 覆盖率审查**，不重复编写测试代码。
>
> **顺序约束：步骤六不是补测试阶段。** 若本步骤发现某个已实现行为没有对应测试：
> 1. 不得直接在步骤六补写"后验测试"
> 2. 将该行为登记为 **TDD 遗漏**（记录到实现报告或 Delta Spec）
> 3. 回退到步骤三，对该行为重新执行 RED → GREEN → REFACTOR
> 4. 若实现代码已存在且无失败测试证据，按 Iron Law 标记为 TDD 违规，并请求用户确认是否删除/重写相关实现

### 6.1 全量回归测试

执行全量测试套件，验证步骤三 TDD 单元测试 + 新增集成测试无回归。

**测试执行命令映射** → 参见 [`references/build-commands.md`](build-commands.md) "步骤 6.2" 章节

### 6.2 执行后端单元测试

**命令映射** → 参见 [`references/build-commands.md`](build-commands.md) "步骤 6.2" 章节

### 6.3 执行后端集成测试

**命令映射** → 参见 [`references/build-commands.md`](build-commands.md) "步骤 6.3" 章节

### 6.4 E2E 测试执行（full 模式）

> **开关控制**：本子节受 `{ENABLE_E2E_TEST}` 变量控制。
> - `{ENABLE_E2E_TEST}=on`（full 模式 + `{E2E_FRAMEWORK}!=none`）→ 执行 E2E 测试
> - `{ENABLE_E2E_TEST}=off` → 跳过本子节

**前置条件**：`{E2E_FRAMEWORK}` 已在 P0.4 阶段自动检测，值为 `playwright` / `cypress` / `none`。

**执行流程**：

1. 读取 `templates/test-cases-prompt.md` 中"四、E2E 测试用例"章节
2. 根据 `{E2E_FRAMEWORK}` 选择测试命令：

| E2E_FRAMEWORK | 执行命令 | 选择器规范参考 |
|---------------|---------|---------------|
| playwright | `npx playwright test` | `references/playwright-conventions.md` |
| cypress | `npx cypress run` | `references/playwright-conventions.md` |
| none | ⏭️ 跳过 E2E 测试 | — |

3. 执行 E2E 测试，收集结果
4. 失败用例按 6.6 节流程修复

**E2E 测试用例格式**：用例编号以 `ET-` 开头（如 `ET-001`），与单元测试（`UT-`）和集成测试（`IT-`）区分。

**成功标准**：所有 E2E 测试用例通过，关键用户路径（Happy Path）全部覆盖。

### 6.5 执行前端组件测试（如有前端变更）

**命令映射** → 参见 [`references/build-commands.md`](build-commands.md) "步骤 6.4" 章节

### 6.6 测试失败修复

1. 分析失败原因：现有测试被新代码破坏 vs 新增用例实现有误
2. **优先修复被破坏的现有测试**，对照 `test-cases.md` 中的预期行为修正
3. 若预期本身不合理，与用户确认后更新 `test-cases.md`
4. 修复后重新执行对应测试，直至全部通过

### 6.7 测试覆盖率检查（可选）

**命令映射** → 参见 [`references/build-commands.md`](build-commands.md) "步骤 6.6" 章节

覆盖率参考基准：核心业务逻辑行覆盖率 ≥ 80%，API 接口 ≥ 70%。

### 6.8 最终编译验证

**命令映射** → 参见 [`references/build-commands.md`](build-commands.md) "步骤 6.7" 章节

**成功标准**：
- 最终构建命令输出成功状态，无测试失败
- `test-cases.md` 中所有用例编号均已有对应测试实现且通过
- 对应测试实现必须来自步骤三 RED 阶段；若步骤六发现用例编号无对应测试实现，登记为 **TDD 遗漏** 并回退步骤三 RED，不在步骤六补写后验测试

---

## 步骤七：【可自动确认节点】功能完成确认

> ⏸️ **可自动确认：默认等待用户确认；仅本轮用户显式授权自动执行或 CI/CD 自动化场景可跳过。**

> **降级策略**：仅当用户在**本轮对话**明确指示"自动执行"或处于 CI/CD 自动化场景时，才允许跳过功能确认；不得基于历史偏好、模糊语义或模型自行判断跳过。触发后：
> 1. 输出实现摘要（编译状态、文件清单等）
> 2. 自动进入步骤八
> 3. 在实现报告中标注"自动模式，未人工确认功能"

### 7.0 完成前验证关卡（Verification Gate）

> **Iron Law**: NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
>
> AI 不可凭记忆声称完成，必须展示运行时证据。每一项验证必须实际执行命令并展示输出，不可凭"应该没问题"跳过。

**5 项强制验证**（按顺序执行，任一项失败则拦截，修复后重新验证）：

```
┌────────────────────────────────────────────────────────────────┐
│ □ 1. 编译验证 — 运行编译命令 + 展示 exit code                     │
│      后端: {BUILD_TOOL} 编译命令                                  │
│      前端: {BUILD_TOOL} 构建命令（如有前端变更）                     │
│      ❌ exit code ≠ 0 → 返回步骤五修复                            │
│                                                                  │
│ □ 2. 测试验证 — 全量运行测试 + 展示通过/失败数                      │
│      {ENABLE_UNIT_TEST}=on 时强制: {TEST_FRAMEWORK} 测试命令       │
│      ❌ 有失败 → 回退步骤三/五/六（根据失败类型）                    │
│      {ENABLE_UNIT_TEST}=off → 标注"测试开关关闭，跳过"              │
│                                                                  │
│ □ 3. tasks.md 标记验证 — grep 统计未标记任务数                     │
│      grep -c '\- \[ \]' openspec/changes/{提案名称}/tasks.md       │
│      ❌ 结果 > 0（测试任务除外）→ 逐任务补标记                       │
│                                                                  │
│ □ 4. Agent 输出独立验证 — 每个 Agent 声称 DONE 的任务检查 VCS diff │
│      git diff --name-only 对比 tasks.md 预期文件清单               │
│      ❌ 文件缺失 → 返回步骤三补全                                  │
│                                                                  │
│ □ 5. Delta Spec 验证（{ENABLE_CODE_REVIEW}=on 时）                 │
│      specs/delta.md 存在 或 标注"无规格外决策"                      │
│      {ENABLE_CODE_REVIEW}=off → 标注"审查开关关闭，跳过"            │
└────────────────────────────────────────────────────────────────┘
```

**Rationalization 反驳表**（检测到以下借口时强制执行验证）：

| 借口（AI 自我合理化） | 事实 |
|----------------------|------|
| "应该没问题" | 运行验证 |
| "Agent 说成功了" | 独立验证 Agent 输出 |
| "之前跑过了" | 代码可能已变更，重新运行 |
| "改动很小不需要" | 小改动也可能引入编译错误 |

**任一检查项未通过 → 先修复问题再重新验证，确认全部通过后再向用户汇报。**

### 7.1 汇报模板

```
实现摘要：
- 编译状态：✅ 成功
{- 代码审查：CRITICAL 0 个，HIGH 0 个（已全部修复）
}{- 单元测试：{UT 用例数} 个，全部通过 ✅
}{- 集成测试：{IT 用例数} 个，全部通过 ✅
}{- 组件测试：{CT 用例数} 个，全部通过 ✅（如有）
}
请验证以下功能点是否符合您的需求：
{根据 proposal.md 中的验收标准逐条列出}

请回复：
- [功能完成] → 生成实现报告，进入归档确认
- [需要优化] → 请描述具体问题或优化点
```

> 上述模板中 `{- ...\n}` 包裹的内容为条件渲染：
> - `{ENABLE_CODE_REVIEW}=on` 时显示代码审查行
> - `{ENABLE_UNIT_TEST}=on` 时显示测试相关行
> - 开关为 off 时对应行不显示

### 7.2 用户反馈：需要优化

1. 明确优化范围和预期效果
2. 修改对应代码（遵循原有技术栈规范 skill）
3. 重新执行**步骤五（编译验证）**{和**步骤六（测试执行）**}（`{ENABLE_UNIT_TEST}=on` 时执行步骤六）
4. 修复完成后**重新回到步骤七**确认

**可迭代多轮，直到用户确认功能完成。**

### 7.3 用户反馈：功能完成 → 进入步骤八

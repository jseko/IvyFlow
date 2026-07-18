# 步骤三：代码实现

> 对应 SKILL.md 章节：步骤三

**使用时机**：当 AI 进入步骤三（步骤二用户确认后），读取本文件获取完整的代码实现规范。

---

## 前置条件

进入步骤三之前，确认以下文件已全部存在且通过步骤二的用户确认：

```
openspec/changes/{提案名称}/proposal.md   — 已确认
openspec/changes/{提案名称}/design.md     — 已确认
openspec/changes/{提案名称}/specs/        — 已确认
openspec/changes/{提案名称}/tasks.md      — 已确认
# 当 {ENABLE_UNIT_TEST}=on 时还必须存在：
openspec/changes/{提案名称}/test-cases.md — 已确认
```

如果上述任一文件缺失或未经用户确认，返回步骤一补全或步骤二等待确认。

按照 `tasks.md` 中的任务顺序逐个实现，保持任务依赖关系，跳序或批量执行会导致文件依赖混乱。

```
/opsx:apply {提案名称}
```

---

## 3.0 实现前影响检查（调用 ci_impact）

开始实现前，对 tasks.md 中每个「修改已有文件」的任务执行影响检查：

```
对每个"修改已有文件"的任务：
  ci_impact(target, "both")
  ├── 风险等级 CRITICAL → 暂停，报告用户确认后继续
  ├── 风险等级 HIGH     → 输出 ⚠️ 警告到实现日志，继续执行
  └── 风险等级 MEDIUM/LOW → 记录到实现日志
```

> CI_MODE=no 时，ci_impact 由 AI 凭调用关系推断影响范围；CI_MODE=full 时由图数据库精确遍历。

---

## 3.1 前置操作：读取并锁定 tasks.md

开始实现前，先确认任务清单状态：

1. 读取 `openspec/changes/{提案名称}/tasks.md`
2. 确认所有任务均处于 `- [ ]` 状态
3. 将 tasks.md 中的任务清单作为实现阶段的执行依据

---

## 3.2 任务执行与标记

**每个任务的执行流程**：步骤 A（选任务）→ B（选 Agent，按 3.3 路由规则）→ C（实现）→ D（Edit 标记 `[x]`）→ E（验证标记），缺一不可。

**关键规则**：

| 规则 | 说明 |
|------|------|
| **Agent 分派** | 步骤 B 需要根据文件类型选择 Agent（详见 3.3）。跳过 Agent 分派会导致代码不符合项目规范。 |
| **并行分派** | 无文件依赖的任务在单条消息中并行启动多个 Agent。串行执行会增加总耗时和 token 消耗。 |
| **一任务一标记** | 完成一个任务 → 立即 Edit 标记 `[x]`。批量标记容易遗漏，导致进度追踪失真。 |
| **跨文件同任务** | 一个任务涉及多个文件时，所有文件创建完毕才算完成 |
| **提交前必检查** | 步骤七向用户汇报前，先确认 tasks.md 无遗漏标记 |

### TDD 执行纪律（`{ENABLE_UNIT_TEST}=on` 时强制）

```
RED     → 1. 先写测试用例（按 test-cases.md 对应条目）
          2. 运行测试，确认失败（非编译错误，是断言失败或 NoClassDefFoundError）
          3. Verify RED: 确认失败原因符合预期（测试引用了不存在的代码）
          🚩 Red Flags: 测试首次运行即通过 → STOP，说明覆盖的是已有行为

GREEN   → 4. 实现最小代码使测试通过
          5. 运行测试，确认通过
          6. Verify GREEN: 确认是通过新代码而非已有代码
          🚩 Red Flags: 实现代码先于测试被创建 → STOP，回到 RED

REFACTOR → 7. 消除重复、提取常量、优化命名——不改变测试覆盖的行为
          8. 重构后重跑测试，确认仍绿
```

**Good vs Bad 测试代码对照**（Java/Spring 示例；其他技术栈套用同样思路）：

```java
// ✅ GOOD —— 行为清晰、名字自解释、用真实代码
@Test
void should_reject_when_email_is_empty() {
    UserRequest req = UserRequest.builder().email("").build();
    Result result = userService.register(req);
    assertThat(result.getCode()).isEqualTo(400);
    assertThat(result.getMsg()).isEqualTo("邮箱不能为空");
}

// ❌ BAD —— 名字含糊、测的是 Mock 行为、断言无意义
@Test
void test1() {
    when(repo.save(any())).thenReturn(new User());
    userService.register(req);
    verify(repo, times(1)).save(any());  // 验证的是 mock 被调用，不是真实行为
}
```

**关键差异**：
- `should_X_when_Y` 命名 > `test1` —— 测试名即文档
- 断言"业务结果"（错误码、消息）> 断言"内部交互"（mock.verify）
- 真实对象构造 > 大量 Mock —— Mock 只在外部边界（HTTP/DB/时钟）使用

### TDD Red Flags 违规检测（`{ENABLE_UNIT_TEST}=on` 时强制）

检测到以下任一模式 → STOP，当前任务标记为 TDD 违规，回到 RED：
- 实现代码先于测试代码被创建（GREEN 阶段检查）
- 测试首次运行即通过（RED 阶段检查——说明覆盖的是已有行为，非新功能）
- 无法解释测试为什么失败（RED 阶段检查）
- 声称"稍后补测试"（任何阶段）
- 出现 "just this once" / "这个场景例外因为……" 等合理化语言（任何阶段）
- "我已经手工测过了"（任何阶段）
- "后补测试能达到同样目的"（任何阶段）
- 重构改变了测试覆盖的行为（REFACTOR 阶段检查）

**All of these mean: Delete code. Start over with TDD.**

### 任务执行失败处理

| 失败类型 | 处理方式 |
|---------|---------|
| 编译错误 | 直接修复，最多 2 次尝试 |
| 断言/逻辑失败 | 触发 Systematic Debugging 四阶段流程（详见 `references/systematic-debugging.md`） |
| 同一任务同一 Bug ≥ 3 次调试失败（限断言/逻辑失败） | → **BLOCKED**：疑似架构问题，停止自动修复 |

### BLOCKED 状态转换规则

当任务因以下原因无法继续时，标记为 BLOCKED：
- 同一任务同一 Bug 调试 ≥ 3 次失败（非编译错误，仅限断言/逻辑失败）→ 原因模板："调试 ≥ 3 次失败。每次修复暴露新的共享状态/耦合问题 → 可能为架构问题。需人工介入分析根本原因"
- 设计歧义无法自行决策
- 依赖的外部资源不可用
- 其他需要人工介入的场景

BLOCKED 后暂停后续依赖任务，向用户报告并等待决策。严禁对 BLOCKED 任务尝试第 4 次自动修复。

---

## 3.3 实现规范与 Agent 分派规则

> **核心原则**：每个代码文件由一个专业 Agent 负责实现，不允许主 agent 直接写代码（除非无可用的专业 Agent）。

### 3.3.1 Agent 分派路由

**核心原则**：每个代码文件由专业 Agent 实现。完整的 Agent 分派路由表、职责边界和 Fallback 策略 → [`references/agent-mapping.md`](agent-mapping.md)

**快速参考**：

| 文件类型 | Agent | 说明 |
|---------|-------|------|
| `*.java` | `spring-agent` | Spring Boot 代码（Controller/Service/Repository/Entity/DTO） |
| `*.vue`、`*.js`（前端） | `frontend-agent` | Vue 组件、Store、API 模块 |
| `*.java`（纯 Entity/DTO < 50 行） | 主 agent 直写 | 无业务逻辑的简单 POJO，减少 Agent 调用开销 |
| `*.sql`、`*.properties`、`*.xml` | 主 agent 直写 | 配置文件，使用 Write/Edit 工具 |

**并行分派**：无文件依赖的任务在单条消息中并行启动多个 Agent。串行执行会增加总耗时和 token 消耗。
- 并行组示例：Entity ∥ DTO → Repository ∥ Repository → Service ∥ Controller → 前端页面 ∥ 组件
- 串行仅限：后续任务依赖前序任务的接口/类型定义时（如 Service 依赖 Entity 类型）

**并行失败处理**：单个 Agent 失败重试 1 次，仍失败则降级主 Agent 直写；同组 > 50% Agent 失败则暂停报告用户；步骤累计 > 5 次失败则中止并输出失败报告。完整的失败处理流程和报告模板 → [`references/agent-mapping.md`](agent-mapping.md)

### 3.3.2 Task 调用模板

**精简模板（推荐，约 1400 tokens）**：

后端任务（spring-agent）：
```
Task(
  subagent_name="spring-agent",
  description="创建 {类名}",
  prompt="项目：Spring Boot 1.5.9 + JPA + Shiro，包名 com.shimh
    文件：{FILE_PATH} | 任务：{任务描述}
    设计参考：openspec/changes/{提案名称}/design.md
    编码约定：遵循 .claude/rules/java-spring-boot.md 规范
    关键约束：不使用 Lombok | @Autowired 字段注入 | Result 成功码 0 | Entity extends BaseEntity
    请直接创建代码文件。"
)
```

前端任务（frontend-agent）：
```
Task(
  subagent_name="frontend-agent",
  description="创建 {组件名}",
  prompt="项目：Vue 2.5 + Element UI 2.0 + Vuex + Axios
    文件：{FILE_PATH} | 任务：{任务描述}
    设计参考：openspec/changes/{提案名称}/design.md
    编码约定：遵循 .claude/rules/vue.md 规范
    关键约束：Options API | res.code === 0 | .sync 双向绑定 | scoped 样式 | el- 前缀
    请直接创建代码文件。"
)
```

> **使用规则**：standard/full 模式使用精简模板（节省 ~55% token）；quick 模式主 agent 直写。完整模板（含所有编码约定细节）→ [`references/agent-specs.md`](agent-specs.md#§54-agent-prompt-精简模板v32-新增)

### 3.3.3 配置文件任务

SQL 脚本、properties、XML 配置等任务**不使用 Task 工具**，直接通过 `write_to_file` / `replace_in_file` 完成。

---

## 3.4 遇到设计歧义时

立即暂停，向用户提问，自行猜测可能导致实现偏离需求：

```
⏸️ 设计歧义需要确认

在实现"{任务名称}"时遇到以下不明确的地方：
问题：{具体问题描述}

可能的选项：
1. {选项1}
2. {选项2}

请问您希望采用哪种方式？
```

---

## 3.5 步骤三完成校验

所有任务完成后，执行以下校验：

```bash
# 统计 tasks.md 中任务标记情况
grep -c '\- \[ \]' openspec/changes/{提案名称}/tasks.md  # 应输出 0（测试任务除外）
grep -c '\- \[x\]' openspec/changes/{提案名称}/tasks.md  # 应匹配已实现任务数
```

**校验不通过 → 返回补标记再进入步骤五**。逐任务补标记直到全部 `[x]`。

**成功标准**：`tasks.md` 中所有实现任务标记 `[x]`（测试任务可保持 `[ ]` 当 ENABLE_UNIT_TEST=off），代码文件按设计方案完整创建。

---

## 3.6 实现后变更检测（调用 ci_detect_changes）

> v3.2 新增：利用代码智能层检测实现后变更，与 tasks.md 预期范围对比。

所有任务完成后执行：`ci_detect_changes()` 获取实际变更文件列表 → 与 tasks.md 预期范围对比 → 范围不一致时输出意外变更警告（含文件清单和可能原因）→ 用户确认后继续。

**CI_MODE 行为**：full 时精确到符号级 diff；stale 时标注"索引可能过期"；no 时执行 `git diff --name-only` 代替。

> 详细流程（含意外变更报告模板和 CI_MODE 行为对比表）→ [`references/code-intelligence-layer.md`](code-intelligence-layer.md)

---

## 3.7 Delta Spec 反写

> **开关控制**：本步骤受 `{ENABLE_CODE_REVIEW}` 变量控制（与代码审查共用开关）。
> - `{ENABLE_CODE_REVIEW}=on` → 执行本步骤
> - `{ENABLE_CODE_REVIEW}=off` → 跳过本步骤，输出提示 `⏭️ 代码审查开关已关闭，跳过 Delta Spec 反写`

实现阶段中，代码实现与 spec 之间可能存在偏差。Delta Spec 反写机制在实现完成后捕获这些偏差，制度化地反写回文档。

**双层检查结构**（详见 `references/delta-spec-patterns.md`）：
- **Layer 1（规格外决策）**：接口参数调整、错误码新增、实现路径变更、第三方库选型
- **Layer 2（代码级遗漏）**：D1 输入边界、D2 外部依赖异常、D3 部分失败降级、D4 安全默认值、D5 多路径守卫

**执行时机与模式联动**：

| 执行模式 | 触发时机 | 行为 |
|---------|---------|------|
| quick | — | 完全跳过 |
| standard | 步骤七用户确认后 | 汇总生成 delta.md |
| full | 步骤三期间 + 步骤七 | 每次 3.5 校验后增量追加决策到待汇总列表，步骤七汇总生成 |

**执行流程**：

1. **识别规格外决策**：回顾步骤三中所有与 spec/design 不一致的实现选择：
   - 接口签名调整（参数增减、类型变更）
   - 错误码/状态码新增
   - 实现路径变更（不同于 design 中描述的方式）
   - 第三方库替换或新增依赖

2. **代码级遗漏检查**：对照 `references/delta-spec-patterns.md` Layer 2 清单逐项检查：
   - 输入边界是否完整（null、空字符串、超长、特殊字符）
   - 外部依赖异常是否处理（超时、网络错误、返回异常格式）
   - 部分失败降级策略是否明确
   - 安全默认值是否强制（而非"建议配置"）
   - 多路径场景是否都覆盖（如不同角色、不同状态下的代码路径）

3. **生成 delta.md**：写入 `openspec/changes/{提案名称}/specs/delta.md`，格式：

```markdown
# Delta Spec — {提案名称}

## 变更汇总

| # | 类型 | 描述 | 关联 spec | 决策 |
|---|------|------|----------|------|
| D-001 | 接口调整 | {描述} | {spec 章节} | {决策说明} |
| D-002 | 代码级遗漏 | {描述} | {spec 章节} | {补全方式} |

## 待同步回原文档

以下内容需在后续迭代中同步回 proposal.md / design.md / specs/：

- [ ] {待同步项}

## 未解决的设计决策

以下决策需用户确认：

- [ ] {决策描述}
```

**成功标准**：`{ENABLE_CODE_REVIEW}=on` 时 delta.md 已生成；所有 Layer 1 决策有明确记录；Layer 2 遗漏场景已标记处理状态（已修复/已确认豁免/需用户决策）。

# Systematic Debugging — 四阶段调试流程

> 本参考文档供步骤三 TDD 循环中的调试中断处理使用。当步骤三 3.2 GREEN 阶段验证失败（断言失败/逻辑错误）时触发。
>
> **Iron Law**：`NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST`
>
> 违反 Iron Law 的检测信号：如果在未完成 Phase 1 的情况下提出任何修复方案 → STOP，回到调查阶段。

---

## 四阶段调试流程

### Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

1. **Read Error Messages Carefully**
   - 不要跳过任何错误或警告
   - 完整阅读堆栈跟踪（stack trace）
   - 注意行号、文件路径、错误码

2. **Reproduce Consistently**
   - 能稳定触发吗？
   - 确切的复现步骤是什么？
   - 每次都会发生吗？
   - 如果不能稳定复现 → 收集更多数据，不要猜测

3. **Check Recent Changes**
   - 什么变更可能导致这个问题？
   - `git diff`、最近提交
   - 新依赖、配置变更
   - 环境差异

4. **Gather Evidence in Multi-Component Systems**
   - 在每个组件边界添加诊断埋点：
     - 记录进入组件的数据
     - 记录离开组件的数据
     - 验证环境/配置传播
     - 检查每一层的状态
   - 运行一次收集证据，确认哪个组件出问题
   - **然后**调查该具体组件

### Phase 2: Pattern Analysis

**Find the pattern before fixing:**

1. **Find Working Examples**
   - 在同一代码库中找到相似的可工作的代码
   - 什么与出问题的代码相似但正常工作？

2. **Compare Against References**
   - 如果要实现某个模式，**完整**阅读参考实现
   - 不要略读——阅读每一行
   - 在应用前完全理解模式

3. **Identify Differences**
   - 工作代码和故障代码之间的每个差异
   - 列出所有差异，不论多小
   - 不要假设"这不重要"

4. **Understand Dependencies**
   - 这个组件还依赖什么？
   - 什么设置、配置、环境？
   - 有什么假设？

### Phase 3: Hypothesis and Testing

**科学方法：**

1. **Form Single Hypothesis**
   - 明确陈述："我认为 X 是根因，因为 Y"
   - 写下来
   - 具体，不模糊

2. **Test Minimally**
   - 做**最小**改动来验证假说
   - 一次只改一个变量
   - 不要一次修多个东西

3. **Verify Before Continuing**
   - 有效？→ Phase 4
   - 无效？→ 形成新假说
   - 不要在无效修复上叠加修复

4. **When You Don't Know**
   - 说"我不理解 X"
   - 不要假装知道
   - 请求帮助或继续研究

### Phase 4: Implementation

**修复根因，不是症状：**

1. **Create Failing Test Case**
   - 最简单的复现
   - 优先自动化测试
   - 修复前必须有失败测试

2. **Implement Single Fix**
   - 解决已识别的根因
   - 一次一个变更
   - 不夹带"顺便优化"
   - 不夹带重构

3. **Verify Fix**
   - 测试现在通过了吗？
   - 没有其他测试被破坏了吗？
   - 问题真的解决了吗？

4. **If Fix Doesn't Work**
   - STOP
   - 数一下：尝试了多少次修复？
   - < 3 次 → 回到 Phase 1，带着新信息重新分析
   - **≥ 3 次 → STOP 并质疑架构（见下方止损规则）**
   - 不要尝试第 4 次修复

---

## 止损规则：3+ 次修复失败 = 架构问题

```
IF 同一 Bug 尝试 ≥ 3 次修复均失败:
  STOP. 不要尝试第 4 次修复.

  这是架构问题的信号:
  - 每次修复暴露新的共享状态/耦合/问题
  - 修复需要"大规模重构"才能实现
  - 每次修复在其他地方产生新症状

  → 质疑当前模式/架构本身是否正确
  → "我们是不是惯性地坚持着一个错误的模式？"
  → 与用户讨论架构方案，而非继续修复症状
  → 这不是"假说失败"，这是"架构错误"
```

---

## Rationalization 反驳表

| 借口（AI 自我合理化） | 事实 |
|----------------------|------|
| "这个 issue 太简单，不需要流程" | 简单 issue 也有根因。流程对简单 Bug 也很快（15-30 分钟 vs 2-3 小时猜测） |
| "紧急情况，没时间走流程" | 系统化调试比猜测试错更快。紧急更需要纪律，不是更少 |
| "先试这个修复，然后再调查" | 第一个修复会形成模式。从一开始就做对 |
| "确认修复有效后再写测试" | 未经测试的修复不可靠。先写测试证明它有效 |
| "多个修复一起上省时间" | 无法隔离哪个有效。会产生新 Bug |
| "参考太长，我看个大概就行" | 部分理解保证产生 Bug。完整阅读参考实现 |
| "我看到问题了，让我修" | 看到症状 ≠ 理解根因 |
| "再试一次修复"（已失败 2+ 次） | 3+ 次失败 = 架构问题。质疑模式，不要继续修复 |

---

## Red Flags —— STOP 并回到 Phase 1

检测到以下任一模式 → 立即停止当前修复尝试，回到 Phase 1：

- "Quick fix now, investigate later"
- "Just try changing X and see if it works"
- 一次加多个变更然后跑测试
- 跳过测试，"手动验证"
- "It's probably X, let me fix that"（猜测性修复）
- "我不完全理解但这样可能行"
- "Pattern 说 X 但我按自己的方式适配"
- 跳过调查直接列出修复方案（"Here are the main problems: ..."）
- **"One more fix attempt"（已尝试 2+ 次修复）**
- **每个修复暴露新的不同位置的问题**
- 提出修复方案前未追踪数据流

**ALL of these mean: STOP. Return to Phase 1.**

---

## Quick Reference

| Phase | Key Activities | Success Criteria |
|-------|---------------|------------------|
| **1. Root Cause** | Read errors, reproduce, check changes, gather evidence at boundaries | Understand WHAT and WHY |
| **2. Pattern** | Find working examples, compare completely | Identify differences |
| **3. Hypothesis** | Form theory, test minimally | Confirmed or new hypothesis |
| **4. Implementation** | Create test, single fix, verify | Bug resolved, tests pass |

---

## 配套技术

- **root-cause-tracing.md** — 从调用栈末端反向追踪到原始触发点
- **defense-in-depth.md** — 在数据流每一层加验证，使 Bug 在结构上不可能重现
- **condition-based-waiting.md** — 用条件轮询替代任意 sleep，消除 flaky tests

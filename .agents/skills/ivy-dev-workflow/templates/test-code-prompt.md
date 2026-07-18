# TDD 测试先行提示词模板

> 本模板主要供步骤三 RED 阶段使用：根据 test-cases.md 先写失败测试，确认失败原因正确后再进入 GREEN 实现。
> 步骤六仅可复用本文件中的 Verification Checklist / Testing Anti-Patterns 做回归审查，**不得在步骤六首次补写单元测试**。
> v3.3 新增：TDD 完整规范（Iron Law + 红绿重构循环 + Rationalization 反驳表 + Red Flags + Anti-Patterns）。

---

## TDD Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

违反此规则的代码应被删除，从测试开始重新实现。无例外。

---

## 红绿重构循环

```
RED     → 1. 先写测试用例（按 test-cases.md 对应条目）
          2. 运行测试，确认失败（非编译错误，是断言失败或 NoClassDefFoundError）
          3. Verify RED: 确认失败原因符合预期（测试引用了不存在的代码）

GREEN   → 4. 实现最小代码使测试通过
          5. 运行测试，确认通过
          6. Verify GREEN: 确认是通过新代码而非已有代码

REFACTOR → 7. 消除重复、提取常量、优化命名——不改变测试覆盖的行为
          8. 重构后重跑测试，确认仍绿
```

---

## Rationalization 反驳表

| 借口（AI 自我合理化） | 事实 |
|----------------------|------|
| "这个太简单了，不需要测试" | 简单代码也会坏。写测试只要 30 秒 |
| "我先实现再补测试" | 后补的测试立即通过，证明不了任何东西——你不知道它测的是不是正确行为 |
| "后补测试能达到同样目的" | 后补测试是"这段代码做什么"，先写测试是"这段代码应该做什么"。前者被实现偏见污染 |
| "我已经手动测试过了" | 临时测试 ≠ 系统测试。没有记录、无法重跑、容易遗漏 |
| "删掉 X 小时的工作太浪费了" | 沉没成本谬误。保留不可信代码 = 技术债务 |
| "留着当参考，我先写测试" | 你会"适配"它。适配 = 测试后补 |
| "需要先探索一下" | 可以。探索完删掉，用 TDD 重新开始 |
| "测试难写 = 设计有问题" | 听测试的。难测 = 难用。简化接口 |
| "TDD 会拖慢我" | TDD 比 Debug 快。务实的做法就是测试先行 |
| "手动测试更快" | 手动不能证明边界。每次改代码你都得重新手动测 |
| "现有代码也没测试" | 你在改进它。给现有代码加测试 |

---

## Red Flags 违规检测清单

检测到以下任一模式 → STOP，当前任务标记为 TDD 违规，回到 RED：

- 实现代码先于测试代码被创建
- 测试在实现之后编写
- 测试首次运行即通过（说明测试覆盖的是已有行为，非新功能）
- 无法解释测试为什么失败
- 声称"稍后补测试"
- 出现 "just this once" / "这个场景例外因为……" 等合理化语言
- "我已经手工测过了"
- "后补测试能达到同样目的"

**All of these mean: Delete code. Start over with TDD.**

---

## When Stuck — TDD 卡点指引

执行 TDD 时遇到以下卡点 → 按"解法"处理，不要绕开 Iron Law：

| 卡点 | 现象 | 解法 |
|------|------|------|
| **不知如何写测试** | 看着空白测试文件不知道断言什么 | ① 先写"期望中的 API"调用 → `service.method(x)` 形态先于实现存在<br>② 先写断言 `assertThat(result).isEqualTo(...)`，反推参数和方法签名<br>③ 写不出来 → 说明需求未澄清，回步骤一/二补充验收标准 |
| **测试太复杂**（>30 行 setup） | 单测里堆了一堆 Mock、构造数据 | 设计有问题，不是测试有问题。听测试的反馈：<br>① 拆分被测类的职责（SRP）<br>② 提取构造器/工厂减少入参<br>③ 把跨模块协作改为依赖注入 |
| **必须 Mock 一切才能跑** | 类直接 `new` 依赖、静态方法、单例 | 耦合过高。整改路径：<br>① 改为构造器/方法参数注入<br>② 用真实对象代替 Mock（含 In-Memory 实现）<br>③ 仅外部边界（HTTP/DB/文件/时钟）保留 Mock |
| **setup 巨大**（fixture 几十行） | 每个测试方法前都要构造庞大对象图 | ① 抽 `TestDataBuilder` / `ObjectMother` 工厂<br>② 用 builder 模式让默认值合理、只显式覆盖差异字段<br>③ 仍巨大 → 设计太复杂，简化领域模型 |

> **核心心法**：测试难写 = 设计难用。修测试之前先问"是不是该改设计"。

---

## Verification Checklist —— 标记任务完成前自检（8 项）

在 `tasks.md` 中把任务标记为 `[x]` 之前，逐项确认：

- [ ] 每个新增 public 方法都对应至少 1 个测试方法
- [ ] 每个测试都**亲眼看过它失败**（RED 阶段保留截图/日志可追溯）
- [ ] 每次失败原因都是"功能缺失/断言不符"，不是"拼写错/编译错"
- [ ] 实现是**通过测试驱动出来的最小代码**，没有 YAGNI 多余功能
- [ ] 当前测试通过 + 既有测试无回归（全绿）
- [ ] 测试输出干净：无堆栈警告、无 `System.out.println` 调试痕迹
- [ ] 使用真实对象，仅外部边界（HTTP/DB/文件/时钟）才用 Mock
- [ ] 异常路径与边界值（空/null/极值/并发）都有对应测试

任一项打不上 √ → 你跳过了 TDD，**回到 RED 重新开始**，不要直接标 `[x]`。

---

## Testing Anti-Patterns

| Anti-Pattern | 正确做法 |
|-------------|---------|
| 测试 Mock 行为而非真实行为 | 优先使用真实实现，Mock 仅限外部边界（网络/文件系统/时钟） |
| 为生产类添加 test-only 方法 | 通过公开接口测试；test-only 方法是设计坏味道 |
| 不理解的 Mock（为通过测试而 Mock） | 理解依赖的真实行为后再决定是否需要 Mock |
| 测试实现细节而非行为 | 测试"做了什么"（返回值/副作用）而非"怎么做的"（内部调用顺序） |

---

## 补全提示词

```
请根据 openspec/changes/{提案名称}/test-cases.md 中定义的测试用例，
检查并补全缺失的测试代码实现。

测试文件位置（根据 {BACKEND_STACK} 和 {FRONTEND_STACK}）：
- spring-boot：{BACKEND_DIR}/src/test/java/.../*Test.java（单元），*IT.java（集成）
- express/nestjs：{BACKEND_DIR}/test/*.test.js 或 __tests__/*.spec.ts
- django：{BACKEND_DIR}/tests/test_*.py
- go：{BACKEND_DIR}/**/*_test.go
- vue3：{FRONTEND_DIR}/src/**/__tests__/*.spec.ts
- react：{FRONTEND_DIR}/src/**/*.test.tsx
- angular：{FRONTEND_DIR}/src/**/*.spec.ts

测试代码规范（根据 {TEST_FRAMEWORK}）：

【junit5】后端单元测试：
- 类名：{被测试类名}Test.java，方法名：should_[预期结果]_when_[条件]
- 使用 @ExtendWith(MockitoExtension.class)，不启动 Spring 容器
- Mock 外部依赖，每个方法只验证一个行为，使用 AssertJ 断言

【junit5】后端集成测试：
- 类名：{Controller类名}IT.java
- 使用 @AutoConfigureMockMvc + @Transactional（测试后自动回滚）
- 验证 HTTP 状态码、响应体 JSON 结构；权限测试使用 @WithMockUser

【vitest + vue3】前端组件测试：
- mount(Component, { props, global })，await wrapper.trigger('click') 模拟交互
- wrapper.find(...).exists() / .text() 验证 DOM 状态

【jest + react】前端组件测试：
- render(<Component />)，fireEvent / userEvent 模拟交互
- expect(screen.getByText(...)).toBeInTheDocument() 验证 DOM

禁止的操作：
❌ 删除测试用例来规避失败
❌ 修改预期结果来通过测试
❌ 使用 @Ignore / skip 跳过失败测试
❌ 先写实现后补测试（ENABLE_UNIT_TEST=on 时）
```

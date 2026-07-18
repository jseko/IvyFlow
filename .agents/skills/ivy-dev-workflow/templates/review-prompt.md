# 代码审查提示词模板

> 本模板供步骤四使用，驱动 AI 对代码变更进行双重审查。
> v3.3 新增：TDD 合规性检查维度 + 审查反馈响应规范。

---

## 审查提示词

```
请使用 {审查 agent} 和 code-reviewer skill 对本次代码变更进行审查：

审查范围：git diff BASE_SHA HEAD_SHA --name-only 范围内的文件
  BASE_SHA=$(git rev-parse HEAD~1)  # 或步骤三开始前的 HEAD
  HEAD_SHA=$(git rev-parse HEAD)

需求上下文：{用户原始需求描述}
技术栈：{BACKEND_STACK} + {FRONTEND_STACK}

审查重点（按优先级）：
1. [CRITICAL] 安全性：认证、授权、注入攻击、敏感数据处理
2. [CRITICAL] 业务逻辑：核心流程正确性、边界条件处理
3. [HIGH] 架构规范：依赖注入、事务管理、分层设计、全局异常处理
4. [HIGH] 数据访问：查询优化、N+1 问题、参数化查询
5. [HIGH] 前端规范：组件设计、状态管理、权限控制实现
6. [MEDIUM] API 设计：RESTful 规范、响应格式一致性、错误处理
7. [MEDIUM] 项目约定遵守（根据技术栈检查以下项）：
   - {BACKEND_STACK}=spring-boot：Controller 使用 Result 包装、Service 使用 @Transactional、Entity JPA 注解完整
   - {FRONTEND_STACK}=vue3/vue2：Vue 选项式/组合式 API 一致性、Store 模块化、API 调用路径
8. [LOW] 代码可读性：命名规范、注释完整性

**TDD 合规性**（仅 ENABLE_UNIT_TEST=on 时检查）：
  检查测试代码与实现代码的创建顺序，判断是否遵守测试先行。
  如发现先实现后测试，标注 MEDIUM 级别问题。

请将审查结果写入：openspec/changes/{提案名称}/review-001.md
格式要求：按 CRITICAL/HIGH/MEDIUM/LOW 分级，每个问题包含 File:Line、Issue、Fix 三要素
```

---

## 审查 agent 选择

| 技术栈 | 审查 Agent |
|-------|-----------|
| `{BACKEND_STACK}=spring-boot` | `java-reviewer` |
| `{BACKEND_STACK}=express` / `nestjs` 或 `{FRONTEND_STACK}=vue3` / `react` | `typescript-reviewer` |

---

## 修复优先级

| 级别 | 处理方式 |
|------|---------|
| CRITICAL | 必须修复，修复后重新验证 |
| HIGH | 必须修复，记录修复方式 |
| MEDIUM | 视情况修复，不阻塞流程 |
| LOW | 记录但不修复 |

---

## 审查反馈响应规范（v3.3 新增）

> 收到审查反馈后的结构化响应流程。**严禁表演性同意（"You're absolutely right!"）和盲目实施。**

### 6 步响应模式

```
WHEN 收到审查反馈:
  1. READ: 完整阅读所有反馈，不急于反应
  2. UNDERSTAND: 用自己的话复述每条建议的技术要求
  3. VERIFY: 检查每条建议在当前代码库中的技术正确性
  4. EVALUATE: 判断是否 YAGNI / 破坏现有功能 / 违反项目架构决策
  5. RESPOND: 技术性确认或理性反驳（禁止表演性同意）
  6. IMPLEMENT: 一次一条，测试每一条
```

### 禁止响应清单

- "You're absolutely right!" / "Great point!" / "Excellent feedback!"（表演性同意）
- "Let me implement that now"（验证前急于实施）
- 任何感谢表达（代码本身就证明你听到了反馈）

### 反馈处理优先级

| 优先级 | 类型 | 处理策略 |
|--------|------|---------|
| 1 | Blocking（安全漏洞/数据丢失/崩溃） | 立即修复，阻塞后续任务 |
| 2 | Simple（typo/import 缺失/命名） | 快速批量修复 |
| 3 | Complex（重构/逻辑变更/架构调整） | 逐条评估后单独修复 |

### YAGNI 审查建议

当审查者建议"properly implement"某功能时，先 grep 代码库确认实际调用方：
- 无人调用 → "This isn't called anywhere. Remove it (YAGNI)?"
- 有调用方 → 实施 proper implementation

### 多条反馈的"先澄清再实施"规则

```
IF 多条反馈中有任何一条不清楚:
  STOP. 先澄清全部不清楚的条目.

示例:
  审查反馈 6 条，理解 1,2,3,6，不清楚 4,5.
  ❌ WRONG: 先实施 1,2,3,6，稍后再问 4,5
  ✅ RIGHT: "理解条目 1,2,3,6。需要澄清条目 4 和 5 后再开始实施"
```

### 来源区分处理

| 来源 | 处理策略 |
|------|---------|
| Human partner（用户） | 信任但确认范围；跳过感谢直接行动 |
| External reviewer | 验证技术正确性 → 检查是否破坏现有功能 → 检查是否理解完整上下文 → 理性反驳或实施 |

---

## 修复记录模板

追加到 `review-001.md` 的"修复记录"章节：

```markdown
## 修复记录

| 问题编号 | 级别     | 文件:行号                | 问题描述       | 修复方式         | 状态      |
|--------|---------|------------------------|--------------|----------------|---------|
| C-001  | CRITICAL | UserMapper.java:45     | SQL 注入风险   | 改用参数化查询    | ✅ 已修复 |
| H-001  | HIGH     | UserService.java:56    | 缺少事务注解    | 添加 @Transactional | ✅ 已修复 |
| M-001  | MEDIUM   | UserController.java:120 | 响应格式不一致  | 统一 ResponseEntity | ⏭️ 跳过 |
```

# Agent 与 Skill 映射表

> 供步骤三（代码实现）和步骤四（代码审查）参考。Agent 分派路由、Fallback 策略和扩展指引。

---

## 后端实现 Agent 映射

| `{BACKEND_STACK}` | 使用 Agent | 参考 Skill | 对应 Rules |
|------------------|-----------|-----------|-----------|
| `spring-boot` | `spring-agent` | `springboot-patterns`、`api-design` | `java.md` |
| `spring-cloud` | `spring-cloud-agent` | `springboot-patterns`、`api-design` | `java.md` |
| `quarkus` | `quarkus-agent` | `api-design` | `java.md` |
| `micronaut` | `micronaut-agent` | `api-design` | `java.md` |
| `go` / `gin` / `echo` | `go-agent` | `api-design` | `go.md` |
| `python` / `fastapi` / `django` | `python-agent` | `api-design` | `python.md` |
| `express` / `nestjs` | `node-agent` | `api-design` | `typescript.md` |
| `rust` / `actix` / `axum` | 主 agent 直接执行（**FALLBACK**） | `api-design` | — |

## 前端实现 Agent 映射

| `{FRONTEND_STACK}` | 使用 Agent | 参考 Skill | 对应 Rules |
|-------------------|-----------|-----------|-----------|
| `vue` / `vue2` / `vue3` | `frontend-agent` | — | `vue.md` |
| `react` / `nextjs` | `react-agent` | — | `typescript.md` |
| `angular` | 主 agent 直接执行（**FALLBACK**） | — | `typescript.md` |
| `svelte` / `none` | 主 agent 直接执行（**FALLBACK**） | — | — |

## 代码审查 Agent 映射

| 审查对象 | 审查 Agent | Fallback |
|---------|-----------|----------|
| Java（Spring Boot / Spring Cloud / Quarkus / Micronaut） | `java-reviewer` | — |
| Spring Boot / Maven / Gradle 编译错误 | `java-build-resolver` | — |
| JS/TS（Vue / React / Node.js） | `typescript-reviewer` | 主 agent 执行 |
| Python（FastAPI / Django） | 主 agent 执行（**FALLBACK**） | — |
| Go | 主 agent 执行（**FALLBACK**） | — |
| 数据库 Schema / 查询 / 索引 | `database-agent` | — |

## Agent 职责边界

| Agent | 适用场景 | 不适用场景 |
|-------|---------|-----------|
| `spring-agent` | Spring Boot：Controller / Service / Repository / Entity / Config / Security | 前端代码、非 Java 后端 |
| `spring-cloud-agent` | 微服务：Nacos、Gateway、Sentinel、Seata、Feign | 单体 Spring Boot CRUD |
| `quarkus-agent` | Quarkus：Panache、Mutiny、GraalVM 原生编译 | Spring Boot 项目 |
| `micronaut-agent` | Micronaut：编译期 DI、Micronaut Data | Spring Boot 项目 |
| `go-agent` | Go Web：Gin / Echo / GORM / 并发 / goroutine | JVM 后端、前端 |
| `python-agent` | Python：FastAPI / Django / Pydantic / SQLAlchemy / Celery | JVM 后端、前端 |
| `node-agent` | Node.js：Express / NestJS / Prisma / TypeORM / JWT | Java/Go/Python 后端 |
| `frontend-agent` | Vue 2/3：组件 / 状态管理（Vuex/Pinia）/ Element UI/Plus | React/Angular、Java 后端 |
| `react-agent` | React 18：Hooks / Zustand / Next.js / React Query | Vue/Angular、Java 后端 |
| `database-agent` | Schema 设计 / 索引优化 / SQL 审查 / 迁移策略 | 应用层业务逻辑 |
| `java-reviewer` | Java/Spring 代码审查 | 代码实现、编译修复 |
| `java-build-resolver` | Maven/Gradle 编译错误、依赖冲突 | 代码审查 |
| `typescript-reviewer` | JS/TS/Vue/React 代码审查 | Java/Python/Go 代码审查 |
| 主 agent | 无匹配专用 Agent 时直接执行（输出 fallback 日志） | — |

## 任务类型 → Agent 自动分派流程

```
读取 tasks.md 任务 →
  │
  ├── 任务 File 字段以 .java 结尾 →
  │   ├── {BACKEND_STACK}=spring-boot → spring-agent
  │   ├── {BACKEND_STACK}=spring-cloud → spring-cloud-agent
  │   ├── {BACKEND_STACK}=quarkus → quarkus-agent
  │   ├── {BACKEND_STACK}=micronaut → micronaut-agent
  │   └── 其他 → 主 agent（⚠️ FALLBACK）
  │
  ├── 任务 File 字段以 .go 结尾 →
  │   └── go-agent
  │
  ├── 任务 File 字段以 .py 结尾 →
  │   └── python-agent
  │
  ├── 任务 File 字段以 .ts / .tsx 结尾（Node.js 后端目录） →
  │   └── node-agent
  │
  ├── 任务 File 字段以 .vue 结尾 →
  │   └── frontend-agent
  │
  ├── 任务 File 字段以 .jsx / .tsx（React 前端目录）结尾 →
  │   └── react-agent
  │
  ├── 任务 File 字段以 .sql 结尾 →
  │   └── database-agent
  │
  └── 任务 File 字段为 .properties / .yml / .xml 等配置 →
      └── 主 agent 直接执行
```


---

## 代码智能层接口（v3.2 新增）

> 完整的接口定义、CI_MODE 行为对比、Fallback 策略矩阵和 GitNexus 价值对比 → [`code-intelligence-layer.md`](code-intelligence-layer.md)

### 使用约定

1. **步骤三 3.0（实现前）**：调用 `ci_impact(target, "both")` 检查影响范围
2. **步骤三 3.6（实现后）**：调用 `ci_detect_changes()` 对比预期范围
3. **步骤三 3.4（设计歧义）**：调用 `ci_query(question)` 辅助决策
4. **步骤六诊断**：调用 `ci_processes(query)` 追踪失败调用链
5. **设计阶段**：调用 `ci_clusters(pattern)` 辅助模块划分

## 通用规范（所有技术栈）

- RESTful API：`GET/POST/PUT/DELETE /api/{资源}`，统一响应格式 `{"code":200,"data":{...},"message":"success"}`
- 权限控制：后端 RBAC，前端路由守卫 + 按钮级权限
- 错误处理：统一全局异常处理，结构化日志，敏感信息脱敏
- Rules 与 Agent 互补：Agent 提供实现方法论，Rules 提供声明式约束检查清单

## 扩展指引

新增 Agent 支持时，只需在对应表格中添加一行，分派流程自动匹配，无需修改路由逻辑。

### 添加新后端 Agent 示例

```markdown
| `rust` / `actix` | `rust-agent` | `api-design` | `rust.md` |
```

需要对应创建：
1. `templates/rust-agent.md`（Agent 模板）
2. `rules_sources/rust.md`（Rules 约束）
3. `agent-frontmatter.yaml` 中添加条目
4. 本表中从 FALLBACK 切换为专用 Agent

---

## Agent 4 状态模型（v3.3 新增）

> **来源**：Superpowers subagent-driven-development 的 4 状态模型，替代隐式通过/失败二元判断。

### 状态定义

| 状态 | 含义 | 处理规则 |
|------|------|---------|
| **DONE** | 全部完成，自检通过 | 正常标记 `[x]`，进入下一任务 |
| **DONE_WITH_CONCERNS** | 完成但有顾虑 | 标记 `[x]` + 追加 `⚠️ concerns: {描述}` 到 tasks.md；步骤七时汇总审查 |
| **NEEDS_CONTEXT** | 需要更多上下文才能继续 | 主 Agent 补充上下文 → 重新分派同一任务；不标记 `[x]` |
| **BLOCKED** | 无法完成（计划错误/技术不可行/需人工决策/调试 3+ 次失败） | 暂停后续任务 → 向用户报告 → 等待决策 |

### DONE_WITH_CONCERNS 触发场景（Agent 必须标注）

- 选择的实现方案不是最优但受限于当前 spec 的约束
- 边界场景（如并发/超时/异常路径）因 spec 未定义而采用默认策略
- 修改的文件已经过大，本次新增功能加剧了该问题
- 测试覆盖率因第三方依赖不可 Mock 而未达标

### 非 DONE_WITH_CONCERNS 场景（不应标注）

- "代码可以写得更优雅"（= 正常代码审查范畴，在步骤四处理）
- "变量命名可以更好"（= 正常代码审查范畴）

### tasks.md 标记格式

```
- [x] 3.1 实现 OrderService.createOrder
  - Status: DONE
- [x] 3.2 实现 PaymentGateway.charge
  - Status: DONE_WITH_CONCERNS
  - ⚠️ concerns: 超时重试策略未定义（当前硬编码 3 次），需步骤七时确认
- [ ] 3.3 实现 InventoryService.reserve
  - Status: BLOCKED
  - 原因: 库存预占需分布式锁，但 design.md 未指定锁实现方案
```

---

## 模型选择策略（v3.3 新增）

> **来源**：Superpowers subagent-driven-development 的任务复杂度分级策略。

### 复杂度分级

| 复杂度 | 判断标准 | 模型选择 | 典型任务 |
|--------|---------|---------|---------|
| **Mechanical** | 1-2 文件、完整 spec、无设计决策 | 快速/便宜模型 | DTO、Entity、配置文件、简单 CRUD Repository |
| **Standard** | 多文件、集成逻辑、需模式匹配 | 标准模型 | Service、Controller、组件 |
| **Judgment** | 架构决策、跨模块协调、安全敏感 | 最强模型 | 核心业务逻辑、支付流程、权限系统、重构 |

### 判断规则

```
IF 任务涉及文件数 ≤ 2 AND spec 完整（无歧义）AND 无设计决策 → Mechanical
ELSE IF 任务涉及跨模块协调 OR 安全敏感 → Judgment
ELSE → Standard
```

### 保守原则（ADR-SDD-006）

不确定时使用更高级别。Mechanical 误判成本（多花 2K tokens）<< Judgment 误判成本（代码质量差 + 返工 50K+ tokens）。

**安全边际：**
- 任何涉及"钱"、"权限"、"数据一致性"、"安全"的任务 → 强制 Judgment
- 任何涉及 ≥ 3 文件修改的任务 → 至少 Standard
- 任何 Agent 标注 DONE_WITH_CONCERNS 后重新分派的任务 → 至少 Standard

### 与执行模式联动

| 执行模式 | Mechanical | Standard | Judgment |
|---------|-----------|----------|----------|
| quick | 主 Agent 直写 | 主 Agent 直写 | N/A（quick 模式无复杂任务） |
| standard | 快速模型 | 标准模型 | 标准模型（不强制最强者，降低成本） |
| full | 快速模型 | 标准模型 | 最强模型 |

---

## 并行 Agent 集成验证步骤（v3.3 新增）

> **来源**：Superpowers dispatching-parallel-agents 的集成验证步骤。

### 验证流程

```
每组并行 Agent 全部返回后:
  1. Review summaries: 逐一阅读每个 Agent 的报告
     确认无 DONE_WITH_CONCERNS 遗漏
     确认无 NEEDS_CONTEXT 或 BLOCKED 状态未处理

  2. Check for conflicts:
     git diff --name-only 检查是否有 Agent 编辑了同一文件
     冲突 → 主 Agent 手动合并或重新分派

  3. Run full suite:
     运行全量编译/测试
     确认并行 Agent 的修改组合后无回归

  4. Spot check:
     抽查 1-2 个关键文件的 Agent 实现质量
     发现系统性问题 → 更新后续 Agent 的 prompt 模板

  5. Mark completion:
     全部验证通过 → 批量标记 tasks.md
```

---

## 逐任务审查分派规则（Phase 2 规划标记）

> **Phase 2 启用条件**：standard/full 模式 + ENABLE_CODE_REVIEW=on  
> **Phase 1 行为**：步骤四保持批量审查模式（所有任务完成后统一审查）

### 两阶段审查流程（Phase 2）

```
每个实现任务完成后:
  1. Spec 合规审查（spec-reviewer）
     检查: 实现是否与 spec 一致
     发现: 缺失需求或过度实现 → BLOCKED
     修复后重新提交 → 通过后进入阶段 2

  2. 代码质量审查（java-reviewer / typescript-reviewer）
     检查: 命名/结构/YAGNI/DRY
     发现: Critical 问题 → 暂停后续任务，修复后重新审查
     通过: 标注 [review-passed]，进入下一任务
```

### 审查状态标记格式

```
- [x] 3.1 实现 OrderService.createOrder [review-passed]
- [x] 3.2 实现 PaymentGateway.charge [review-failed]
- [ ] 3.3 实现 InventoryService.reserve [review-skipped]
```

### Agent 路由（保持不变）

审查 Agent 分派规则与当前步骤四 4.1 节一致：
- Java → java-reviewer
- TypeScript/Vue → typescript-reviewer
- 安全 → security-reviewer（仅 full 模式）

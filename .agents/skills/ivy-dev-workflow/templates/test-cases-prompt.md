# 测试用例生成提示词模板

> 本模板供步骤一（1.3）使用，驱动 AI 根据 proposal.md + design.md 生成完整测试用例文档。
> 测试框架根据 `{TEST_FRAMEWORK}`、`{BACKEND_STACK}`、`{FRONTEND_STACK}` 动态调整。

---

## 提示词

```
请根据以下提案文档，为本次需求生成完整的测试用例文档，
并把测试实现任务追加到 tasks.md 的"测试任务"章节：

提案文档：openspec/changes/{提案名称}/proposal.md
设计文档：openspec/changes/{提案名称}/design.md
任务清单：openspec/changes/{提案名称}/tasks.md

项目配置：
- 后端技术栈：{BACKEND_STACK}
- 前端技术栈：{FRONTEND_STACK}
- 测试框架：{TEST_FRAMEWORK}

━━━ 一、单元测试用例（Unit Tests）━━━
针对后端核心业务逻辑、Service 层、工具类，按类维度组织。

每个测试用例包含：
- 用例编号（UT-序号，如 UT-001）
- 测试方法名（遵循 should_[预期结果]_when_[条件] 命名规范）
- 测试目标（测试哪个方法/类）
- 前置条件（Mock 数据、依赖状态）
- 输入参数
- 预期输出 / 预期行为
- 测试框架（根据 {TEST_FRAMEWORK}：JUnit5+Mockito / Jest / Vitest / pytest / go test）

覆盖场景：
- 正常路径（Happy Path）
- 边界条件（空值、null、最大值、最小值、空集合）
- 异常路径（非法参数、业务异常、权限不足）
- 关键分支（if/else 每个分支均需覆盖）

━━━ 二、集成测试用例（Integration Tests）━━━
针对 API 接口层，根据 {BACKEND_STACK} 选择合适测试方式：
- spring-boot → @SpringBootTest + MockMvc
- express/nestjs → supertest
- django → Django TestClient
- go → httptest
- rust → actix-web TestRequest

每个测试用例包含：
- 用例编号（IT-序号，如 IT-001）
- 测试接口（HTTP Method + Path）
- 前置条件（数据库初始状态、认证 token）
- 请求参数 / 请求体示例（JSON 格式）
- 预期 HTTP 状态码
- 预期响应体结构（关键字段）
- 关联权限（需要哪个角色/权限码才能访问）

覆盖场景：
- 正常调用（合法入参、合法权限）
- 参数校验（缺少必填字段、格式非法、超出长度限制）
- 权限校验（未登录 401、权限不足 403）
- 业务异常（资源不存在 404、状态冲突 409）
- 边界数据（分页边界等）

━━━ 三、前端组件测试用例（Component Tests，如有前端变更）━━━
根据 {FRONTEND_STACK} 选择框架：
- vue3 → Vitest + Vue Test Utils
- react → Vitest / Jest + React Testing Library
- angular → Jasmine + Angular TestBed

每个测试用例包含：
- 用例编号（CT-序号，如 CT-001）
- 测试组件名
- 测试场景描述
- Props / Slot 输入
- 触发的用户交互（点击、输入、提交）
- 预期 DOM 变化 / 事件触发 / Store 状态变化

覆盖场景：
- 渲染正确性（关键元素按权限显示/隐藏）
- 交互行为（表单提交、按钮点击、弹窗开关）
- 权限控制（按钮级权限指令显示逻辑）

━━━ 四、E2E 测试用例（End-to-End Tests，full 模式 + E2E_FRAMEWORK 可用时）━━━
根据 {E2E_FRAMEWORK} 选择框架：
- playwright → @playwright/test
- cypress → Cypress

E2E 测试选择器规范参考 references/playwright-conventions.md。

每个测试用例包含：
- 用例编号（ET-序号，如 ET-001）
- 测试场景名称（用户视角描述）
- 测试路径（页面级流程，如"登录→用户管理→创建用户→验证列表"）
- 关键断言（页面元素、URL、网络响应）
- 关联的用户角色（需要哪种权限登录）

覆盖场景：
- 核心业务 Happy Path（至少 1 条完整流程）
- 权限/角色切换场景（如管理员 vs 普通用户）
- 关键错误路径（如登录失败后的页面状态）

注意：
- E2E 测试用例数量不宜过多（建议 3-8 条），聚焦核心用户路径
- 每个用例覆盖一个端到端流程，不追求底层逻辑全覆盖

━━━ 同步更新 tasks.md ━━━
在 tasks.md 末尾追加"测试任务"章节：
- [ ] 任务N：实现 {类名} 单元测试（UT-001 ~ UT-00X）
- [ ] 任务N+1：实现 {接口} 集成测试（IT-001 ~ IT-00X）
- [ ] 任务N+2：实现 {组件名} 组件测试（CT-001 ~ CT-00X）（如有前端变更）

请将测试用例写入：openspec/changes/{提案名称}/test-cases.md
```

---

## test-cases.md 输出文档结构示例

```markdown
# 测试用例文档：{提案名称}

> 生成依据：proposal.md + design.md
> 项目配置：{BACKEND_STACK} + {FRONTEND_STACK}，测试框架：{TEST_FRAMEWORK}
> 创建时间：{日期}

---

## 一、单元测试用例

### 1.1 UserService

| 编号     | 测试方法名                                    | 测试目标               | 场景类型 |
|--------|---------------------------------------------|----------------------|--------|
| UT-001 | should_return_user_when_valid_id_given      | UserService.findById | 正常路径 |
| UT-002 | should_throw_exception_when_user_not_found  | UserService.findById | 异常路径 |
| UT-003 | should_throw_exception_when_id_is_null      | UserService.findById | 边界条件 |

**UT-001 详情**
- **测试目标**：`UserService.findById(Long id)`
- **前置条件**：Mock `UserMapper.selectById()` 返回有效 User 对象
- **输入**：`id = 1L`
- **预期输出**：返回对应 `UserDTO`，字段映射正确
- **框架**：JUnit 5 + Mockito（根据 {TEST_FRAMEWORK}）

---

## 二、集成测试用例

### 2.1 用户管理接口

| 编号     | 接口                     | 场景            | 预期状态码 |
|--------|------------------------|---------------|---------|
| IT-001 | POST /api/users        | 正常创建用户      | 200     |
| IT-002 | POST /api/users        | 缺少必填字段 name  | 400     |
| IT-003 | GET  /api/users/{id}   | 未登录访问       | 401     |
| IT-004 | DELETE /api/users/{id} | 无管理员权限      | 403     |

**IT-001 详情**
- **前置条件**：已登录，持有 `ADMIN` 角色 token
- **请求体**：`{"username": "test", "email": "test@example.com", "roleIds": [1]}`
- **预期响应**：`{"code": 200, "data": {"id": ..., "username": "test"}}`

---

## 三、前端组件测试用例

| 编号     | 组件名           | 测试场景               | 预期结果              |
|--------|----------------|----------------------|--------------------|
| CT-001 | UserManagement | 非管理员隐藏删除按钮       | v-permission 指令生效 |
| CT-002 | UserFormDialog | 提交空表单              | 显示校验错误提示         |
```

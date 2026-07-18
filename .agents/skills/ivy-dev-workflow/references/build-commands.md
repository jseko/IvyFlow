# 构建命令映射表

> 供步骤五（编译验证）和步骤六（测试执行）参考，根据 `{BUILD_TOOL}` 动态生成命令。

---

## 编译命令映射

### 步骤 5.1 — 执行编译

根据 `{PROJECT_TYPE}` 决定执行范围：
- `monorepo` → 执行后端编译 + 前端编译
- `backend-only` → 仅执行后端编译
- `frontend-only` → 仅执行前端编译

| `{BUILD_TOOL}` | 后端编译命令 | 前端编译命令 |
|--------------|------------|------------|
| `maven`  | `cd {BACKEND_DIR} && mvn compile -q 2>&1` | — |
| `gradle` | `cd {BACKEND_DIR} && ./gradlew build -x test 2>&1` | — |
| `npm`    | — | `cd {FRONTEND_DIR} && npm run build 2>&1` |
| `pnpm`   | — | `cd {FRONTEND_DIR} && pnpm build 2>&1` |
| `yarn`   | — | `cd {FRONTEND_DIR} && yarn build 2>&1` |
| `go`     | `cd {BACKEND_DIR} && go build ./... 2>&1` | — |
| `cargo`  | `cd {BACKEND_DIR} && cargo build 2>&1` | — |

---

## 通用编译错误分类

| 错误类型 | 诊断方法 | 修复策略 |
|---------|---------|---------|
| 语法错误 | 定位行号，分析错误描述 | 修正语法 |
| 依赖缺失 | 检查构建配置文件 | 添加缺失依赖 |
| 类型错误（TS） | 分析类型不匹配 | 修正类型声明或添加类型转换 |
| 模块未找到 | 检查 import 路径 | 修正路径或安装依赖 |
| 循环依赖 | 分析依赖关系图 | 需暂停询问用户后重构解耦 |

---

## 测试命令映射

### 步骤 6.2 — 后端单元测试

| `{BUILD_TOOL}` | 全量单元测试 | 单独运行某个测试类 |
|--------------|------------|----------------|
| `maven`  | `cd {BACKEND_DIR} && mvn test -q 2>&1` | 加 `-Dtest={TestClassName}` |
| `gradle` | `cd {BACKEND_DIR} && ./gradlew test 2>&1` | 加 `--tests {TestClassName}` |
| `npm/pnpm/yarn` | `cd {BACKEND_DIR} && {BUILD_TOOL} test 2>&1` | 加测试文件名 |
| `go`     | `cd {BACKEND_DIR} && go test ./... 2>&1` | 加 `-run {TestFuncName}` |
| `cargo`  | `cd {BACKEND_DIR} && cargo test 2>&1` | 加 `{test_name}` |

### 步骤 6.3 — 后端集成测试

| `{BUILD_TOOL}` | 集成测试命令 |
|--------------|------------|
| `maven`  | `cd {BACKEND_DIR} && mvn verify -q 2>&1` |
| `gradle` | `cd {BACKEND_DIR} && ./gradlew integrationTest 2>&1` |
| `npm/pnpm/yarn` | `cd {BACKEND_DIR} && {BUILD_TOOL} run test:integration 2>&1` |
| `go`     | `cd {BACKEND_DIR} && go test -tags=integration ./... 2>&1` |

### 步骤 6.4 — 前端组件测试

| `{FRONTEND_STACK}` | 测试命令 |
|------------------|---------|
| `vue3` / `react`（Vitest） | `cd {FRONTEND_DIR} && {前端包管理器} run test:unit 2>&1` |
| `react`（Jest） | `cd {FRONTEND_DIR} && {前端包管理器} test 2>&1` |
| `angular` | `cd {FRONTEND_DIR} && ng test --watch=false 2>&1` |

### 步骤 6.6 — 测试覆盖率

| `{BUILD_TOOL}` | 覆盖率命令 | 报告路径 |
|--------------|---------|---------|
| `maven`  | `cd {BACKEND_DIR} && mvn test jacoco:report -q` | `{BACKEND_DIR}/target/site/jacoco/index.html` |
| `gradle` | `cd {BACKEND_DIR} && ./gradlew test jacocoTestReport` | `{BACKEND_DIR}/build/reports/jacoco/test/html/` |
| `npm/pnpm/yarn` | `cd {BACKEND_DIR} && {BUILD_TOOL} run test:coverage` | `{BACKEND_DIR}/coverage/index.html` |
| `go`     | `go test -coverprofile=coverage.out ./... && go tool cover -html=coverage.out` | `{BACKEND_DIR}/coverage.html` |

覆盖率参考基准：核心业务逻辑行覆盖率 ≥ 80%，API 接口 ≥ 70%。

### 步骤 6.7 — 最终全量构建

| `{BUILD_TOOL}` | 最终构建命令 |
|--------------|------------|
| `maven`  | `cd {BACKEND_DIR} && mvn clean verify -q 2>&1` |
| `gradle` | `cd {BACKEND_DIR} && ./gradlew clean build 2>&1` |
| `npm/pnpm/yarn` | `cd {FRONTEND_DIR} && {BUILD_TOOL} run build 2>&1` |
| `go`     | `cd {BACKEND_DIR} && go build ./... 2>&1` |
| `cargo`  | `cd {BACKEND_DIR} && cargo build --release 2>&1` |

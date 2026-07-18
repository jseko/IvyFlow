# Coding Standards

项目编码规范，覆盖 Java（Spring Boot）和 TypeScript（Vue 3）双栈。

## Java 编码规范

### 分层约定
- Controller：仅做参数接收、权限校验、调用 Service、返回响应。不含业务逻辑
- Service：业务逻辑核心层，事务边界在此层声明（`@Transactional`）
- Mapper：MyBatis-Plus 数据访问，仅做数据库操作
- DTO：API 请求/响应对象，与 Entity 分离。禁止直接暴露 Entity 到 API 层
- Entity：数据库表映射，字段与表列对应

### 命名约定
- 类名：PascalCase（`UserService`、`CustomerController`）
- 方法名：camelCase（`getUserById`、`createCustomer`）
- 常量：UPPER_SNAKE_CASE（`MAX_PAGE_SIZE`）
- 包名：全小写（`com.serviceplat.controller`）
- 数据库表名：snake_case（`sys_user`、`sys_role`）
- 变量名：camelCase，布尔变量用 `is/has` 前缀（`isActive`、`hasPermission`）

### 注解使用
- `@RestController` + `@RequestMapping`：所有 Controller
- `@RequiredArgsConstructor`：构造器注入（替代 `@Autowired`）
- `@Transactional`：仅在 Service 层需要事务的方法上
- `@Validated` / `@Valid`：DTO 参数校验
- 权限注解：使用项目自定义 `@RequirePermission`（替代 `@PreAuthorize`）

### 异常处理
- 业务异常：自定义异常类（`BusinessException`），携带错误码和消息
- 全局异常处理器：`@ControllerAdvice` 统一捕获，返回标准 `ApiResponse`
- 禁止在 Controller 中 try-catch 后返回原始异常信息

### 日志规范
- 使用 SLF4J，禁止 `System.out.println`
- 日志级别：ERROR（异常）、WARN（警告）、INFO（关键业务节点）、DEBUG（调试）
- 禁止在日志中输出敏感数据（密码、token、手机号明文）

## TypeScript / Vue 3 编码规范

### 组件规范
- 统一使用 `<script setup>` 语法
- 组件文件名：PascalCase（`PermissionManagement.vue`）
- 组件内响应式变量用 `ref()` / `reactive()`
- 禁止手动 import Element Plus 组件和图标（依赖 auto-import）

### Store 规范
- Store 文件放在 `src/stores/`，命名 `useXxxStore`
- 使用 Composition API 模式：`defineStore('xxx', () => { ... })`
- 异步 Action 内部处理错误，不向外抛出（由 interceptor 统一处理）

### API 层规范
- API 模块放在 `src/api/`，按业务域拆分
- 统一使用 `src/utils/request.js` 的 axios 实例
- API 函数命名：动词 + 资源名（`getCustomers`、`createTask`）

### 样式规范
- 使用 scoped CSS（`<style scoped>`）
- 遵循 Element Plus 主题变量，不硬编码颜色值
- 暗色模式通过 CSS 变量切换，不使用条件样式
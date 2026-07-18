---
description: Java & Spring Boot 项目编码约束 — 命名、禁止模式、项目配置
globs: **/*.java
---

# Java & Spring Boot 编码约束

## 代码风格（Google Java Style Guide）
- 缩进：4 空格，禁止 Tab
- 行宽：最大 120 字符
- 编码：UTF-8
- 大括号：K&R 风格，即使单行语句也必须使用大括号
- 导入：显式导入，禁止通配符 `*`；静态导入在前，非静态在后，按 ASCII 排序

## 命名约定
- 类/接口/枚举：PascalCase（`UserService`）
- 方法/变量：camelCase（`getUserById`）
- 常量：UPPER_SNAKE_CASE（`MAX_RETRY_COUNT`）
- 包名：全小写，点分隔（`com.shimh.service`）
- 布尔变量/方法：`is`/`has`/`can` 前缀
- 集合：复数命名（`users`、`messages`）

## 禁止模式
- 禁止字段注入（`@Autowired` 直接加在字段上），使用构造器注入
- 禁止捕获通用 `Exception` 后吞掉（空 catch 块）
- 禁止在循环中使用 `+` 拼接字符串，使用 `StringBuilder`
- 禁止可变静态字段
- 重写 `equals()` 时必须同时重写 `hashCode()`
- 使用 `try-with-resources` 管理所有 `AutoCloseable` 资源
- 使用 `Optional` 处理可能为 null 的返回值，禁止返回 null

## 分层架构约定

### Controller 层
- 类注解：`@RestController` + `@RequestMapping("/api/资源名")`
- 方法注解：`@GetMapping` / `@PostMapping` / `@PutMapping` / `@DeleteMapping`
- 所有方法返回 `Result<T>` 统一包装
- 请求体参数使用 `@Valid` / `@Validated` 触发校验

### Service 层
- 接口与实现分离（`XxxService` 接口 + `XxxServiceImpl` 实现）
- 写操作必须加 `@Transactional(rollbackFor = Exception.class)`
- 查询方法命名：`getXxx`（单个）、`listXxx`（列表）、`findXxx`（条件查询）
- 写操作方法命名：`createXxx`、`updateXxx`、`deleteXxx`

### Repository 层（JPA）
- 接口继承 `JpaRepository<Entity, Long>`
- 关联关系默认 `FetchType.LAZY`
- 避免 N+1 查询，必要时使用 `@Query` 显式 JOIN FETCH

### 异常处理
- 业务异常使用自定义 `BusinessException`（继承 `RuntimeException`）
- 全局异常处理使用 `@RestControllerAdvice`
- 日志记录：`log.error("msg", e)` — 始终传入异常对象以保留堆栈信息

## API 约定
- 资源路径使用名词复数：`/api/articles`
- HTTP 方法语义：GET（查询）、POST（创建）、PUT（更新）、DELETE（删除）
- 统一响应格式 `Result<T>`：`code`（Integer）+ `msg`（String）+ `data`（T）
- 分页查询统一使用分页参数对象，返回 `{ total, page, size, records }`

## 配置约定
- 敏感信息使用环境变量：`${DB_PASSWORD}`，禁止硬编码
- 本地配置放 `application-local.properties`（加入 `.gitignore`）
- 使用 BOM 管理依赖版本，禁止不指定版本号
- 日志使用 SLF4J 参数化：`log.info("user={}", userId)`，禁止字符串拼接

## 项目特定约束（基于检测到的技术栈动态填充）
- 基础包名：`{{BASE_PACKAGE}}`
- ORM 框架：{{ORM_FRAMEWORK}}
- 认证框架：{{AUTH_FRAMEWORK}}
- 数据库连接池：{{CONNECTION_POOL}}
- JSON 序列化：{{JSON_LIBRARY}}

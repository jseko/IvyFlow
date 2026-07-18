# 命名规范

> 项目开发命名规范骨架。请根据团队约定补充和修改。
> 创建时间：2026-05-29（v3.2）

---

## 类名

| 类型 | 命名规则 | 示例 |
|------|---------|------|
| Entity 类 | 名词，PascalCase | `User`, `Article`, `OrderItem` |
| Service 接口 | `I` 前缀 或 名词 + `Service` | `UserService`, `IUserService` |
| Service 实现 | 接口名 + `Impl` | `UserServiceImpl` |
| Repository | 实体名 + `Repository` | `UserRepository` |
| Controller | 实体名 + `Controller` | `UserController` |
| DTO | 实体名 + `DTO` / `VO` / `Request` / `Response` | `UserDTO`, `UserVO` |
| 配置类 | 功能名 + `Config` | `SecurityConfig`, `RedisConfig` |
| 工具类 | 功能名 + `Util` / `Utils` / `Helper` | `DateUtil`, `StringUtils` |
| 异常类 | 异常类型 + `Exception` | `BusinessException`, `AuthException` |

---

## 方法名

| 操作 | 命名规则 | 示例 |
|------|---------|------|
| 查询单个 | `get` / `find` + 条件 | `getUserById`, `findByUsername` |
| 查询列表 | `list` / `findAll` / `query` + 条件 | `listArticles`, `findAllByStatus` |
| 创建 | `create` / `save` / `add` | `createUser`, `saveArticle` |
| 更新 | `update` / `modify` | `updateUser`, `modifyProfile` |
| 删除 | `delete` / `remove` | `deleteUser`, `removeArticle` |
| 判断 | `is` / `has` / `can` | `isAdmin`, `hasPermission` |
| 批量操作 | `batch` + 操作名 | `batchDelete`, `batchUpdate` |

---

## 变量名

| 类型 | 命名规则 | 示例 |
|------|---------|------|
| 局部变量 | camelCase | `userId`, `articleList` |
| 常量 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `DEFAULT_PAGE_SIZE` |
| 布尔变量 | `is` / `has` / `can` 前缀 | `isActive`, `hasChildren` |
| 集合变量 | 名词复数 或 `List` / `Map` 后缀 | `users`, `userList`, `roleMap` |

---

## 数据库表名

| 类型 | 命名规则 | 示例 |
|------|---------|------|
| 表名 | 小写 + 下划线，名词复数形式 | `users`, `articles`, `order_items` |
| 关联表 | 两表名用 `_` 连接 | `user_roles`, `article_tags` |
| 主键 | `id` | `id` |
| 外键 | 关联表名单数 + `_id` | `user_id`, `article_id` |
| 时间戳 | `create_time`, `update_time` | — |
| 索引 | `idx_` + 表名缩写 + 字段名 | `idx_user_email`, `idx_art_status` |

---

## API 路径

| 类型 | 命名规则 | 示例 |
|------|---------|------|
| 资源路径 | `/api/` + 名词复数 | `/api/users`, `/api/articles` |
| 嵌套资源 | 父资源 + `/{id}/` + 子资源 | `/api/users/{id}/roles` |
| 非 REST 操作 | `/api/` + 资源 + `/` + 动词 | `/api/articles/{id}/publish` |
| 版本前缀 | `/api/v1/` 或 `/api/v2/` | `/api/v1/users` |

---

## 扩展方式

- 本文件为骨架模板，请根据团队实际规范修改和补充
- 建议对照项目现有代码库验证后调整
- 新增命名类别时保持与现有风格一致

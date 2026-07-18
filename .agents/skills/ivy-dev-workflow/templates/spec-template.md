# Spec Template

用于生成 specs/{capability-name}/spec.md 的标准模板。

---

# {Capability Name}

## 功能描述

<!-- 从 proposal 和 design 中提取该能力的详细描述 -->
<!-- 说明这个能力要实现什么功能，解决什么问题 -->

## 验收标准

<!-- 明确的、可测试的验收标准 -->
- [ ] 标准 1：[具体的验收条件]
- [ ] 标准 2：[具体的验收条件]
- [ ] 标准 3：[具体的验收条件]

## Scenario（业务场景）

### Happy Path
<!-- 正常业务流程，用 ASCII 图描述 -->
```
用户 ──→ [操作] ──→ <判断？>
                    │是         │否
                    ▼           ▼
              [正常结果]    [提示信息]
```

### 异常场景
<!-- 异常分支描述 -->

## Rule（业务规则）

| 规则编号 | 规则描述 | 触发条件 | 预期行为 |
|---------|---------|---------|---------|
| R-001   | ...     | ...     | ...     |

## Boundary（边界条件）

| 边界编号 | 边界描述 | 边界值 | 预期行为 | 优先级 |
|---------|---------|-------|---------|-------|
| B-001   | ...     | ...   | ...     | P0    |

## Exception（异常类型）

| 异常类型 | 触发条件 | HTTP 状态码 | 错误码 | 错误信息 |
|---------|---------|-----------|-------|---------|
| ...     | ...     | 400       | ...   | ...     |

## 接口定义（如果是 API）

<!-- 从 design.md 第 5 章提取相关接口 -->

### API 列表

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/resource` | 创建资源 | USER |
| GET | `/api/resource` | 资源列表 | USER |
| GET | `/api/resource/:id` | 资源详情 | USER |
| PUT | `/api/resource/:id` | 更新资源 | USER |
| DELETE | `/api/resource/:id` | 删除资源 | ADMIN |

### 请求/响应示例

**创建资源**

```http
POST /api/resource
Content-Type: application/json

{
  "field1": "value1",
  "field2": "value2"
}
```

**响应**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "field1": "value1",
    "field2": "value2"
  }
}
```

## 数据模型（如果涉及数据库）

<!-- 从 design.md 第 4 章提取相关表设计 -->

### 表结构

**表名**：`table_name`

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| `id` | BIGINT | 主键 | PRIMARY KEY, AUTO_INCREMENT |
| `field1` | VARCHAR(50) | 字段说明 | NOT NULL |
| `field2` | VARCHAR(100) | 字段说明 | UNIQUE |
| `created_at` | TIMESTAMP | 创建时间 | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TIMESTAMP | 更新时间 | ON UPDATE CURRENT_TIMESTAMP |

### 实体类（后端）

```java
@Entity
@Table(name = "table_name")
public class EntityName {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, length = 50)
    private String field1;
    
    // ...
}
```

## 前端组件（如果涉及前端）

<!-- 从 design.md 第 6 章提取相关组件设计 -->

### 页面路由

| 路由 | 组件 | 说明 |
|------|------|------|
| `/resource` | `ResourceListPage` | 资源列表页 |
| `/resource/new` | `ResourceCreatePage` | 创建资源页 |
| `/resource/:id` | `ResourceDetailPage` | 资源详情页 |

### 组件结构

```
pages/
├── ResourceListPage.vue
├── ResourceCreatePage.vue
└── ResourceDetailPage.vue

components/
└── ResourceCard.vue
```

## 依赖关系

<!-- 说明此能力依赖的其他能力或模块 -->
- 依赖能力 1：[说明]
- 依赖能力 2：[说明]

## 注意事项

<!-- 实现时需要注意的特殊事项 -->
- 注意事项 1
- 注意事项 2

---
name: arch-design
description: Architect Phase 2: 架构设计 — C4 模型、模块划分、接口设计、数据模型
---

# Architect Phase 2: 架构设计

## 目标

基于调研结果，输出完整的架构设计文档。

## 步骤

### 0. 入口状态验证

```bash
ivy state show
```

验证当前阶段为 design。读取 `docs/architecture/research/<topic>.md`。

### 1. C4 模型架构图

#### Context（系统上下文）

描述系统与外部系统的交互关系。

#### Container（容器）

描述系统的容器划分（Web App / API / Database / Cache）。

#### Component（组件）

描述每个容器内部的组件划分。

### 2. 模块划分

| 模块 | 职责 | 依赖 | 接口 |
|------|------|------|------|
| 用户模块 | 注册/登录/权限 | 无 | REST API |
| 订单模块 | 创建/支付/查询 | 用户模块 | REST API |

### 3. 接口设计

```yaml
POST /api/orders
Request:
  userId: string
  items: [{productId, quantity}]
Response:
  orderId: string
  status: "created"
```

### 4. 数据模型

```
User
  id: UUID (PK)
  email: string (unique)
  name: string
  created_at: timestamp

Order
  id: UUID (PK)
  user_id: UUID (FK → User)
  status: enum(pending/paid/shipped/delivered)
  total: decimal
  created_at: timestamp
```

### 5. 非功能需求方案

- 性能：缓存策略、数据库索引、CDN
- 安全：认证方案、权限模型、数据加密
- 可扩展：微服务拆分、消息队列、水平扩展
- 可观测：日志、监控、链路追踪

### 6. 产出物

写入 `docs/architecture/design/<system>.md`。

### 7. 守卫检查

```bash
ivy guard design --apply
```

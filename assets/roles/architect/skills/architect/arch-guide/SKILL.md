---
name: arch-guide
description: Architect Phase 4: 落地指导 — 实现指南、关键技术难点建议
---

# Architect Phase 4: 落地指导

## 目标

为开发者提供可执行的实现指南。

## 步骤

### 0. 入口状态验证

```bash
ivy state show
```

验证当前阶段为 guide。读取架构设计文档和评审记录。

### 1. 实现指南

#### 模块实现顺序

| 顺序 | 模块 | 依赖 | 预计工时 |
|------|------|------|---------|
| 1 | 用户模块 | 无 | 3 天 |
| 2 | 订单模块 | 用户模块 | 5 天 |
| 3 | 支付模块 | 订单模块 | 3 天 |

#### 关键技术难点

| 难点 | 方案 | 参考 |
|------|------|------|
| 分布式事务 | Saga 模式 | 参考文档链接 |
| 高并发扣库存 | Redis + Lua | 参考文档链接 |

### 2. 代码模板

```typescript
// 推荐的模块结构
src/modules/user/
├── user.controller.ts
├── user.service.ts
├── user.repository.ts
├── user.model.ts
└── user.spec.ts
```

### 3. 开发规范

- 命名规范
- 目录结构
- 错误处理模式
- 日志规范

### 4. 产出物

写入 `docs/architecture/implementation-guide.md`。

### 5. 守卫检查

```bash
ivy guard guide --apply
```

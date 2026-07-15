---
name: devops-env
description: DevOps Phase 1: 环境规划 — 基础设施方案、环境拓扑、资源评估
---

# DevOps Phase 1: 环境规划

## 目标

规划项目的基础设施和环境拓扑。

## 步骤

### 0. 入口状态验证

```bash
ivy state show
```

验证当前阶段为 env。

### 1. 基础设施方案

| 组件 | 方案 | 理由 |
|------|------|------|
| 计算 | K8s / ECS | 容器化、弹性伸缩 |
| 数据库 | RDS PostgreSQL | 托管、自动备份 |
| 缓存 | Redis Cluster | 高可用 |
| 存储 | S3 / OSS | 对象存储 |
| CDN | CloudFront / CDN | 加速静态资源 |

### 2. 环境拓扑

| 环境 | 用途 | 配置 |
|------|------|------|
| dev | 开发环境 | 最小配置 |
| staging | 预发布 | 等同生产配置 |
| production | 生产 | 高可用配置 |

### 3. 资源评估

| 资源 | 规格 | 数量 | 月成本 |
|------|------|------|--------|
| K8s Node | 4C8G | 3 | $200 |
| RDS | 2C4G | 1 | $100 |
| Redis | 2C4G | 1 | $50 |

### 4. 产出物

写入 `docs/devops/infrastructure.md`。

### 5. 守卫检查

```bash
ivy guard env --apply
```

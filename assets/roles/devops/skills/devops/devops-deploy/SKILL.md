---
name: devops-deploy
description: DevOps Phase 3: 部署 — 部署策略、回滚方案、健康检查
---

# DevOps Phase 3: 部署

## 目标

执行安全可靠的部署。

## 步骤

### 0. 入口状态验证

```bash
ivy state show
```

验证当前阶段为 deploy。

### 1. 部署策略选择

| 策略 | 适用场景 | 风险 |
|------|---------|------|
| 蓝绿部署 | 需要快速回滚 | 资源成本翻倍 |
| 金丝雀发布 | 需要灰度验证 | 配置复杂 |
| 滚动更新 | 常规发布 | 回滚较慢 |

### 2. 部署前检查

- [ ] 所有测试通过
- [ ] 数据库迁移已准备
- [ ] 回滚方案已确认
- [ ] 监控告警已配置

### 3. 部署执行

```bash
# Docker Compose
docker compose pull
docker compose up -d

# Kubernetes
kubectl apply -f deployment.yaml
kubectl rollout status deployment/app

# 健康检查
curl -f http://localhost:3000/health || exit 1
```

### 4. 部署后验证

- [ ] 健康检查通过
- [ ] 核心功能正常
- [ ] 错误率无异常
- [ ] 响应时间无劣化

### 5. 回滚方案

```bash
# 回滚到上一个版本
kubectl rollout undo deployment/app
docker compose up -d --no-deps --build app
```

### 6. 产出物

写入 `docs/devops/deployment.md`。

### 7. 守卫检查

```bash
ivy guard deploy --apply
```

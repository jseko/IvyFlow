---
name: devops-monitor
description: DevOps Phase 4: 监控 — Prometheus/Grafana、告警规则、日志聚合
---

# DevOps Phase 4: 监控

## 目标

搭建监控和日志系统。

## 步骤

### 0. 入口状态验证

```bash
ivy state show
```

验证当前阶段为 monitor。

### 1. 监控方案

| 组件 | 方案 | 用途 |
|------|------|------|
| 指标采集 | Prometheus | 系统和应用指标 |
| 可视化 | Grafana | 仪表盘和图表 |
| 日志聚合 | ELK / Loki | 集中式日志 |
| 链路追踪 | Jaeger / Tempo | 分布式追踪 |
| 告警 | AlertManager | 告警通知 |

### 2. 核心指标

| 指标 | 阈值 | 告警级别 |
|------|------|---------|
| CPU 使用率 | > 80% | Warning |
| 内存使用率 | > 90% | Critical |
| API 错误率 | > 1% | Critical |
| API 响应时间 | > 500ms | Warning |
| 磁盘使用率 | > 85% | Warning |

### 3. Grafana 仪表盘

- 系统概览（CPU/内存/磁盘/网络）
- 应用指标（QPS/错误率/延迟）
- 业务指标（注册数/订单数/支付率）

### 4. 日志聚合

```yaml
# Filebeat 配置
filebeat.inputs:
  - type: log
    paths:
      - /var/log/app/*.log
output.elasticsearch:
  hosts: ["localhost:9200"]
```

### 5. 产出物

写入 `docs/devops/monitoring.md`。

### 6. 守卫检查

```bash
ivy guard monitor --apply
```

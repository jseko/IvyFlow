---
name: devops-alert
description: DevOps Phase 5: 告警 — 告警规则定义、通知渠道、故障排查手册
---

# DevOps Phase 5: 告警

## 目标

配置告警规则和通知渠道，编写故障排查手册。

## 步骤

### 0. 入口状态验证

```bash
ivy state show
```

验证当前阶段为 alert。

### 1. 告警规则

```yaml
groups:
  - name: app_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status="500"}[5m]) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} for the last 5 minutes"

      - alert: HighLatency
        expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency detected"
```

### 2. 通知渠道

| 渠道 | 用途 | 配置 |
|------|------|------|
| Slack | 团队通知 | Webhook URL |
| 邮件 | 重要告警 | SMTP 配置 |
| PagerDuty | 紧急告警 | API Key |

### 3. 故障排查手册

#### 场景 1：API 响应超时

1. 检查数据库连接池
2. 检查慢查询日志
3. 检查缓存命中率
4. 检查下游服务状态

#### 场景 2：内存使用率高

1. 检查是否有内存泄漏
2. 检查 GC 频率
3. 检查是否有大对象
4. 考虑扩容

### 4. 产出物

写入 `docs/devops/alerts.md`。

### 5. 守卫检查

```bash
ivy guard alert --apply
```

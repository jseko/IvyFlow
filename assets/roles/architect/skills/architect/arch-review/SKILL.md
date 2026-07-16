---
name: arch-review
description: Architect Phase 3: 评审 — 架构评审 checklist、技术债务评估
---

# Architect Phase 3: 评审

## 目标

审查架构设计，识别风险和瓶颈。

## 步骤

### 0. 入口状态验证

```bash
ivy state show
```

验证当前阶段为 review。读取 `docs/architecture/design/<system>.md`。

### 1. 架构评审

使用 `prompt/design-checklist.md` 逐项检查。

### 2. 风险识别

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| 数据库性能瓶颈 | 高 | 中 | 读写分离、缓存 |
| 第三方服务不可用 | 中 | 低 | 降级策略 |

### 3. 技术债务评估

| 债务项 | 严重程度 | 建议 |
|--------|---------|------|
| 缺少单元测试 | 高 | 补充测试 |
| 硬编码配置 | 中 | 迁移到配置中心 |

### 4. 用户确认（阻塞点）

展示评审摘要，等待用户确认后再进入指导阶段。

### 5. 产出物

写入 `docs/architecture/review-record.md`。

### 6. 守卫检查

```bash
ivy guard review --apply
```

---
name: arch-research
description: Architect Phase 1: 方案调研 — 技术选型对比、业界方案调研、POC 验证
---

# Architect Phase 1: 方案调研

## 目标

对比技术方案，输出选型建议。

## 步骤

### 0. 入口状态验证

```bash
ivy state show
```

验证当前阶段为 research。读取 PRD 和需求分析报告。

### 1. 技术选型对比

每个技术决策对比 2-3 种方案：

| 方案 | 优势 | 劣势 | 适用场景 | 社区活跃度 |
|------|------|------|---------|-----------|
| React | 生态丰富 | 学习曲线 | 大型 SPA | 极高 |
| Vue | 上手简单 | 生态较小 | 中小项目 | 高 |
| Svelte | 性能优秀 | 社区小 | 性能敏感 | 中 |

### 2. 业界方案调研

- 同类产品的架构参考
- 开源方案的成熟度评估
- 技术发展趋势分析

### 3. POC 验证

对关键风险点进行概念验证：

- 验证目标
- 验证方法
- 验证结果
- 结论

### 4. 产出物

写入 `docs/architecture/research/<topic>.md`。

### 5. 守卫检查

```bash
ivy guard research --apply
```

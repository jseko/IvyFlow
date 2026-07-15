---
name: qa-regression
description: QA Phase 5: 回归验证 — 验证修复、回归测试核心流程
---

# QA Phase 5: 回归验证

## 目标

验证已修复的 Bug，回归测试核心流程，确保不引入新问题。

## 步骤

### 0. 入口状态验证

```bash
ivy state show
```

验证当前阶段为 regression。

### 1. Bug 修复验证

逐条验证已修复的 Bug：

| Bug ID | 修复版本 | 验证结果 | 备注 |
|--------|---------|---------|------|
| BUG-001 | v1.2.0 | Pass | |
| BUG-002 | v1.2.0 | Fail | 仍有残留问题 |

### 2. 核心流程回归

回归测试以下核心流程：

- [ ] 用户注册/登录
- [ ] 核心业务流程
- [ ] 数据增删改查
- [ ] 权限控制
- [ ] 支付流程（如有）

### 3. 自动化回归

运行全量自动化测试套件：

```bash
npm test
npx playwright test
```

### 4. 回归决策

| 决策 | 条件 |
|------|------|
| 回归通过 | 所有 P0/P1 Bug 已修复，核心流程正常 |
| 部分通过 | P0 已修复，P1 有残留 |
| 回归失败 | P0 仍有未修复，回退 |

### 5. 产出物

写入 `docs/reports/regression-report.md`。

### 6. 守卫检查

```bash
ivy guard regression --apply
```

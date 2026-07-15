---
name: qa-execute
description: QA Phase 2: 测试执行 — 手工测试指导、自动化脚本、接口测试
---

# QA Phase 2: 测试执行

## 目标

执行测试用例，记录测试结果，编写自动化脚本。

## 步骤

### 0. 入口状态验证

```bash
ivy state show
```

验证当前阶段为 execute。读取 `docs/testcases/<feature-name>.md`。

### 1. 环境准备

- [ ] 测试环境可用
- [ ] 测试数据已准备
- [ ] 依赖服务已启动

### 2. 手工测试执行

逐条执行测试用例，记录结果：

| 用例 ID | 结果 | 备注 |
|---------|------|------|
| TC-001 | Pass | |
| TC-002 | Fail | 错误提示与实际不符 |

### 3. 自动化脚本

为 P0/P1 用例编写自动化脚本：

- E2E 测试：Playwright / Cypress
- 接口测试：curl / Postman 脚本
- 单元测试：Jest / Vitest / PyTest

```typescript
// playwright/login.spec.ts
test('should login successfully', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/dashboard');
});
```

### 4. 接口测试

```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### 5. 产出物

- 测试执行记录：`test-results/<feature-name>.json`
- 自动化脚本：`tests/e2e/<feature-name>.spec.ts`

### 6. 守卫检查

```bash
ivy guard execute --apply
```

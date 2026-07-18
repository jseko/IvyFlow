# E2E 测试选择器规范（Playwright / Cypress）

> v3.2 新增：统一 E2E 测试的选择器优先级和等待策略。
> 适用框架：Playwright、Cypress

---

## 选择器优先级

**必须按以下优先级选择元素定位方式：**

| 优先级 | 选择器类型 | 示例 | 说明 |
|--------|---------|------|------|
| 1（最高） | `data-testid` | `page.locator('[data-testid="submit-btn"]')` | 专用测试属性，不受样式/文案变更影响 |
| 2 | Role 选择器 | `page.getByRole('button', { name: '提交' })` | 语义化，无障碍友好 |
| 3 | Text 内容 | `page.getByText('提交')` | 文案可能变更，谨慎使用 |
| 4（最低） | CSS 类名 | `page.locator('.submit-btn')` | 类名易随样式重构变更，最不稳定 |

---

## 等待策略

| 场景 | 推荐方式 | 避免方式 |
|------|---------|---------|
| 等待元素出现 | `waitForSelector` / `locator.waitFor()` | `waitForTimeout` 固定等待 |
| 等待网络请求 | `waitForResponse` / `waitForRequest` | 轮询检查 |
| 等待页面导航 | `waitForURL` / `waitForNavigation` | `page.waitForTimeout(3000)` |
| 等待加载状态 | `waitForLoadState('networkidle')` | 固定延迟 |

**原则**：始终等待确定性条件，不使用 `waitForTimeout` 硬编码延迟。

---

## 断言最佳实践

```javascript
// ✅ GOOD：使用 web-first 断言
await expect(page.getByText('保存成功')).toBeVisible();
await expect(page.locator('[data-testid="user-name"]')).toHaveText('张三');

// ✅ GOOD：断言 URL 变化
await expect(page).toHaveURL(/\/users\/\d+/);

// ❌ BAD：使用 isVisible() 然后手动断言
const visible = await page.getByText('保存成功').isVisible();
expect(visible).toBe(true);

// ❌ BAD：使用 expect 检查布尔值
expect(await page.locator('.dialog').isVisible()).toBe(true);
```

---

## Playwright 配置建议

```javascript
// playwright.config.js
module.exports = {
  use: {
    baseURL: 'http://localhost:5173',
    testIdAttribute: 'data-testid',  // 统一 testid 属性名
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
};
```

---

## Cypress 配置建议

```javascript
// cypress.config.js
module.exports = {
  e2e: {
    baseUrl: 'http://localhost:5173',
    testIdAttribute: 'data-testid',
    video: false,
    screenshotOnRunFailure: true,
  },
};
```

---

## 测试用例组织

```
e2e/
├── auth/
│   ├── login.spec.js       # 登录流程
│   └── register.spec.js    # 注册流程
├── user-management/
│   ├── create-user.spec.js # 创建用户
│   └── edit-user.spec.js   # 编辑用户
└── fixtures/
    └── test-data.json      # 测试数据
```

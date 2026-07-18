# D2C（Design-to-Code）转化规范

> v3.2 新增：将设计稿转化为前端代码时的命名、样式和验收规范。
> 适用场景：设计稿 → Vue/React 组件代码自动转化。

---

## 组件命名映射规则

| 设计元素 | 前端组件名 | 命名规则 |
|---------|-----------|---------|
| 页面级容器 | `XxxPage.vue` | PascalCase + `Page` 后缀 |
| 功能模块 | `XxxModule.vue` | PascalCase + `Module` 后缀 |
| 可复用组件 | `BaseXxx.vue` | `Base` 前缀表示基础组件 |
| 弹窗/对话框 | `XxxDialog.vue` | PascalCase + `Dialog` 后缀 |
| 表单组件 | `XxxForm.vue` | PascalCase + `Form` 后缀 |
| 列表/卡片 | `XxxList.vue` / `XxxCard.vue` | PascalCase + 语义后缀 |
| 布局组件 | `XxxLayout.vue` | PascalCase + `Layout` 后缀 |

---

## 样式处理

### CSS Modules vs Scoped

| 方式 | 适用场景 | 示例 |
|------|---------|------|
| **Scoped（推荐）** | 组件样式隔离，项目默认 | `<style scoped>` |
| CSS Modules | 需要动态类名或跨组件复用 | `<style module>` |
| 全局样式 | 主题变量、基础重置 | `styles/variables.css` |

### 设计稿尺寸转换

```
设计稿基准宽度：1920px（或项目约定宽度）
转换公式：设计稿 px 值 / 基准宽度 * 100vw（如使用 vw）
建议：使用 rem 或 px，配合 PostCSS 自动转换
```

---

## 事件绑定规范

| 交互类型 | 事件命名 | 示例 |
|---------|---------|------|
| 点击 | `@click="handleXxx"` | `@click="handleSubmit"` |
| 输入 | `@input="handleXxxInput"` / `v-model` | `v-model="formData.name"` |
| 切换 | `@change="handleXxxChange"` | `@change="handleStatusChange"` |
| 键盘 | `@keyup.enter="handleSearch"` | Enter 触发搜索 |
| 自定义事件 | `@xxx="handleXxx"` (kebab-case) | `@update:visible="handleVisibleChange"` |

---

## 验收 Checklist

D2C 转化完成后，对照以下清单逐项验收：

- [ ] **布局还原**：组件层级结构与设计稿一致，无明显错位
- [ ] **响应式适配**：在 1920px / 1366px / 768px 三个断点下布局正常
- [ ] **命名一致**：组件名、CSS 类名符合项目命名规范
- [ ] **样式隔离**：scoped 或 CSS Modules 正确配置，无全局污染
- [ ] **事件绑定**：所有交互元素已绑定事件处理器
- [ ] **数据绑定**：表单使用 v-model / controlled component 正确双向绑定
- [ ] **加载状态**：异步数据加载有 loading 状态展示（v-loading / skeleton）
- [ ] **空状态**：列表/表格空数据时有空状态提示
- [ ] **错误状态**：API 请求失败时有错误提示（el-message / toast）
- [ ] **无障碍（a11y）**：关键操作元素有 aria-label 或 title 属性
- [ ] **性能**：大列表使用虚拟滚动或分页，无明显的性能问题
- [ ] **组件拆分**：单文件不超过 300 行，复杂模块已合理拆分

---

## D2C 常见问题与处理

| 问题 | 处理方式 |
|------|---------|
| 设计稿缺少交互状态 | 主动补充 loading / empty / error 状态 |
| 字体大小不匹配 | 统一使用项目定义的 CSS 变量 |
| 间距不一致 | 使用项目 spacing 体系（4px / 8px / 16px / 24px / 32px） |
| 颜色值不标准 | 映射到项目主题色变量（`--color-primary` 等） |
| 响应式断点未定义 | 默认使用 768px（平板）/ 1024px（桌面）/ 1440px（大屏） |

---

## 人工审查门禁

D2C 生成的代码**必须经过人工审查**才能合并：

1. 转换完成后，先自检 Checklist（表单勾选）
2. 在本地启动开发服务器，对照设计稿逐页验收
3. 至少覆盖：正常流程、加载状态、空状态、错误状态、响应式适配
4. 审查通过后在 PR 中附验收截图

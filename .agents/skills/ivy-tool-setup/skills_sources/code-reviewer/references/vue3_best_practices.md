# Vue 3 + Element Plus Best Practices

## Composition API / `<script setup>`

- 统一使用 `<script setup>` 语法，禁止 Options API 混用
- Store 使用 `defineStore(() => { ... })` Composition API 模式
- 组件内响应式变量用 `ref()` / `reactive()`，计算属性用 `computed()`
- 生命周期用 `onMounted()` / `onUnmounted()` 等，不使用 `created/mounted` 选项

## Element Plus Auto-Import

- 组件和图标通过 `unplugin-auto-import` / `unplugin-vue-components` 自动注册
- **禁止手动 import Element Plus 组件**（如 `import { ElButton } from 'element-plus'`）
- 图标同理，禁止手动 import `@element-plus/icons-vue`
- 仅在 auto-import 未覆盖的特殊场景下手动引入

## Pinia Store 规范

- Store 文件放在 `src/stores/` 目录，一个文件一个 store
- Store 命名：`useXxxStore`（如 `useUserStore`、`useChatStore`）
- State 用 `ref()`，Action 用普通函数，Getter 用 `computed()`
- 异步 Action 内部处理错误，不向外抛出业务异常（由 axios interceptor 统一处理）
- Store 之间避免循环依赖

## API 层规范

- API 模块放在 `src/api/` 目录，按业务域拆分文件（如 `auth.js`、`chat.js`、`customer.js`）
- 统一使用 `src/utils/request.js` 的 axios 实例，禁止自行创建 axios
- API 函数命名：动词 + 资源名（如 `getCustomers`、`createTask`）
- 返回值不做二次包装，直接返回 `request.get/post` 的 Promise

## 路由与权限

- 路由定义在 `src/router/index.js`，权限通过 `meta.permission` 声明
- 路由守卫在 `beforeEach` 中检查 `localStorage.getItem('permissions')`
- ADMIN 角色绕过所有权限检查
- 页面级权限用路由 `meta.permission`，按钮级权限用 `v-permission` 指令

## 常见反模式

- ❌ 在 `<script setup>` 中使用 `this`
- ❌ 手动 import Element Plus 组件或图标（应依赖 auto-import）
- ❌ 在 Store 中直接操作 DOM 或调用 `ElMessage`（应在组件层处理 UI 反馈）
- ❌ 在 API 函数中自行创建 axios 实例绕过 interceptor
- ❌ 将业务逻辑写在 `<template>` 中（应提取到 `<script setup>`）
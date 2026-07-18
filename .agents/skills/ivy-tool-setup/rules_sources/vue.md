---
description: Vue 组件编码约束 — 命名、模板规则、Props/Emits、状态管理
globs: **/*.vue
---

# Vue 编码约束

## 组件组织
- 每个 `.vue` 文件只包含一个组件
- 文件名使用 PascalCase（`UserProfile.vue`）
- 基础/无状态组件以 `Base`/`App`/`V` 为前缀（`BaseButton.vue`）
- 与父组件紧密耦合的子组件以父组件名为前缀（`UserProfileAvatar.vue`）
- 组件 Props 类型化：使用 `defineProps<T>()` 或对象格式含 `type`/`required`/`validator`

## 模板规则
- `v-for` 必须配合 `:key` 使用唯一标识符
- 禁止在 `v-for` 元素上同时使用 `v-if`，改为使用 `computed` 过滤数据
- 自定义事件使用 kebab-case 命名并显式声明（`defineEmits(['close-window'])`）
- Props 在 script 中使用 camelCase，模板中传递使用 kebab-case

## 响应式与性能
- `computed` 必须保持纯函数，无副作用
- 大列表（> 1000 项）使用虚拟滚动
- 路由组件使用懒加载（`() => import()`）
- 避免在模板中使用复杂表达式，提取到 `computed` 或 method

## 状态管理
- 全局共享状态使用 Pinia（Vue 3）/ Vuex（Vue 2）
- Store 按业务领域模块化拆分
- 组件本地状态使用 `ref`/`reactive`，不要放在全局 store 中
- 持久化状态需处理版本迁移和缓存失效

## 禁止模式
- 禁止修改 Props（Props 是只读的）
- 禁止在 `watch`/`watchEffect` 中修改被监听的数据（会造成无限循环）
- 禁止在 `computed` 中执行副作用（API 调用、DOM 操作）
- 禁止在组件内直接操作 DOM（使用 `ref` 和 `$refs`）
- 禁止混用 Options API 和 Composition API 在同一个组件中

## 样式约定
- 使用 `<style scoped>` 避免样式泄露
- 全局样式放在 `src/styles/` 目录，通过 `main.js` 引入
- 深度选择器使用 `:deep()` 而非 `/deep/` 或 `>>>`

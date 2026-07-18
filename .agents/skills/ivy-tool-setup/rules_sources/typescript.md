---
description: TypeScript/JavaScript 编码约束 — 类型安全、命名、禁止模式
globs: **/*.{ts,tsx,js,jsx}
---

# TypeScript/JavaScript 编码约束

## 编译配置
- 必须启用 `strict: true`（包含 `noImplicitAny`、`strictNullChecks`）
- 禁止使用 `allowJs: true` + `checkJs: true` 混合模式（新项目统一用 `.ts`）
- 禁止使用 `@ts-ignore` 和 `@ts-nocheck`，特殊情况下使用 `@ts-expect-error` 并注释原因

## 类型定义
- 对象结构使用 `interface`，联合/交叉/映射类型使用 `type`
- API 返回数据必须定义完整的 interface/type，禁止 `as any` 断言
- 对外部输入使用 `unknown` 而非 `any`，通过 type guard 收窄类型
- 避免过度使用泛型，只有当确实需要抽象时使用
- 禁止导出 `any` 类型给外部消费者

## 禁止模式
- 禁止使用 `any` 类型（除非对外部输入使用了 type guard 后断言）
- 禁止使用 `var`，只使用 `const` 和 `let`
- 禁止使用 `==`，一律使用 `===`
- 禁止使用数字枚举（`enum`），优先使用字符串字面量联合类型
- 禁止使用 `export default`，统一使用命名导出

## 命名约定
- 文件/目录：PascalCase（组件）、camelCase（工具/hooks/store）
- 变量/函数：camelCase
- 类型/接口：PascalCase
- 常量：UPPER_SNAKE_CASE
- 布尔变量：`is`/`has`/`should` 前缀
- React Hook 必须以 `use` 开头

## 导入规范
- 顺序：第三方库 → 路径别名导入 → 相对导入，组间空行分隔
- 按字母顺序排列
- 使用路径别名（`@/`）代替深层相对路径
- 禁止循环导入

## 运行时安全
- 外部数据（API 响应、localStorage、URL 参数）必须进行运行时类型校验
- 使用 Zod、Yup 或自定义 type guard 进行校验
- 不要仅依赖 TypeScript 编译期检查保证运行时类型安全

## 代码组织
- 组件：每个文件只导出单个组件（index.ts 除外）
- 工具函数：纯函数优先，避免副作用
- React/Vue 组件 props 必须显式定义类型

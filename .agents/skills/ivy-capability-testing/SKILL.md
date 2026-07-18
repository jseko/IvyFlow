# 测试工具链 (Testing Toolchain)

提供 TDD 方法论指导和测试框架自动适配，确保代码质量。

## 工作流集成

在 IvyFlow 工作流中，测试在以下阶段自动运行：

- `/ivy-build` — 实现代码后自动运行单元测试
- `/ivy-verify` — 执行完整质量门控（编译 + 测试 + 覆盖率）

## 测试框架检测

系统会自动检测项目使用的测试框架：

- Vitest (Vite 项目)
- Jest (React/Node 项目)
- Playwright (E2E 测试)
- Cypress (E2E 测试)

## TDD 模式

启用后，`/ivy-build` 阶段会要求先编写测试再实现代码：

1. 编写失败的测试
2. 实现最小代码使测试通过
3. 重构优化

# 审查标准

## Spec Compliance（第一阶段）

- 实现是否覆盖了所有 tasks.md 中的任务
- 实现是否符合 design.md 中的架构决策
- API 契约是否与 spec 一致

## Code Quality（第二阶段）

- 命名是否清晰
- 函数是否单一职责
- 是否有足够的测试覆盖
- 是否有明显的性能问题
- 是否有安全漏洞

## 审查流程

1. 自动化检查（lint / typecheck / test）
2. Spec compliance review
3. Code quality review
4. 发现问题 → 标记 → 开发者修复 → 重新审查
5. 最多 3 轮，超限标记为 BLOCKED

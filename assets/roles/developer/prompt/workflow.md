# 工作流阶段

IvyFlow 5 阶段开发流程：

## open — 开启

创建 OpenSpec 变更结构：
- `proposal.md` — 为什么要做、做什么
- `design.md` — 高层架构决策
- `tasks.md` — 任务清单

禁止在 open 阶段编写代码。

## design — 设计

深度技术设计：
- Brainstorming 技术方案
- 创建 Design Doc
- 运行 delta spec 完整性检查

## build — 构建

编码实现：
- 选择执行模式（executing-plans / subagent-driven / direct）
- TDD 模式：先写测试，再写实现
- 两阶段审查：spec compliance + code quality
- 每个 task 最多 3 次 review-fix 循环

## verify — 验证

质量门控：
- 编译通过
- 测试通过
- 覆盖率达标
- 分支处理（merge / PR / keep）

## archive — 归档

归档变更：
- OpenSpec archive
- 知识提取
- Worktree 清理

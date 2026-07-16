# 代码理解 (Code Intelligence)

使用 GitNexus 语义索引理解项目代码结构，减少无效的文件搜索和代码阅读。

## 何时使用

- 需要理解项目架构、模块关系或函数调用链时
- 需要评估代码变更的影响范围时
- 需要追踪 bug 的执行路径时
- 探索不熟悉的代码区域时

## 使用方式

在 AI 编程工具中，GitNexus 会自动通过 MCP 工具提供代码智能：

- `gitnexus_query` — 按概念搜索执行流程
- `gitnexus_impact` — 分析代码变更的影响范围
- `gitnexus_context` — 查看符号的完整上下文（调用者、被调用者）

## 索引维护

运行 `npx gitnexus analyze` 更新语义索引。

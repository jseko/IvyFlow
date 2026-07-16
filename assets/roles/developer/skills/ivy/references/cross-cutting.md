# Cross-cutting Concerns

> 跨阶段适用的横切关注点。详细策略见 IvyFlow v0.2 设计文档第 6 章。

## 安全

- 不在仓库中提交密钥/token/PEM。
- 工具调用前检查目标路径是否在工作区内（路径穿越防护）。
- AI 扫描 ≠ 专业 SAST 工具，关键安全决策需人工评审。

## 可观测性与成本

- Token 预算分级：quick ~26K / standard ~64K / full ~82K。
- 1.2x 告警，1.5x 硬上限，2x 自动降级到 quick。
- 异常退出时输出最小 trace（path、phase、command）即可，不上报 telemetry。

## 知识记忆

- 标签匹配 ≥ 2 项时检索同主题历史记录。
- 同主题保留最新 3 条，超过移至 archive。
- 6 个月未访问的记忆自动归档。

## 离线优先

- 所有命令应能在断网环境运行（除显式联网的 `openspec init` 等步骤）。
- `ivy doctor` 严格 local invariant，不读取网络/远程 API。

# 代码智能层（GitNexus 统一封装）

> v3.2 新增：GitNexus 的所有集成点统一通过本层调用。各 Agent 步骤只调用抽象接口，Fallback 逻辑在本层内聚。

---

## 层初始化（P0.4 阶段）

代码智能层在 P0.4 中初始化，CI_MODE 取值：
- `full`：GitNexus 可用且 index up-to-date
- `stale`：GitNexus 存在但 index 过期，结果标注"尽力"
- `no`：GitNexus 未安装，全局降级 AI 分析

---

## 抽象接口定义

以下接口供各步骤调用，**各步骤不直接调用 gitnexus 原始工具**：

| 接口 | CI_MODE=full 时行为 | CI_MODE=no 时行为 | 返回 |
|------|-------------------|------------------|------|
| `ci_impact(target, direction)` | 调用 `gitnexus_impact()` | AI 凭调用关系推断 | 影响节点列表 + 风险等级 |
| `ci_query(query)` | 调用 `gitnexus_query()` | AI 搜索上下文代码 | 相关符号/执行流 |
| `ci_context(name)` | 调用 `gitnexus_context()` | AI 分析方法上下文 | 360° 视图 |
| `ci_detect_changes()` | 调用 `gitnexus_detect_changes()` | `git diff --name-status` | 变更文件清单 |
| `ci_clusters()` | `READ gitnexus://.../clusters` | 读取 `knowledge/dev/cluster-mapping.md` | 功能集群 |
| `ci_processes()` | `READ gitnexus://.../processes` | 读取 `knowledge/dev/architecture-overview.md` | 执行流列表 |

---

## Fallback 策略矩阵

| 故障场景 | 检测方式 | 降级行为 | 用户可见提示 |
|---------|---------|---------|------------|
| MCP 工具异常 / 超时 | 系统返回错误 | 跳过该调用，用 AI 分析替代 | ℹ️ GitNexus 工具暂不可用，已切换 AI 分析 |
| Index 过期（stale） | `gitnexus status` 警告 | 仍使用，结果加"⚠️尽力"标注 | ⚠️ 索引过期于 {日期}，结果仅供参考 |
| 未安装 GitNexus | `command -v gitnexus` 失败 | 全局降级为 AI 分析 | ℹ️ GitNexus 未安装，已切换 AI 分析模式 |
| 不在 git 仓库 | `git rev-parse` 失败 | 跳过所有 CI 接口 | ℹ️ 非 git 仓库，跳过代码智能分析 |

---

## GitNexus 价值对比

| 能力 | CI_MODE=no | CI_MODE=full | 提升 |
|------|-----------|-------------|------|
| 影响面评估 | AI 经验推断，可能遗漏 | 图数据库精确遍历 | 低 → 高 |
| 代码搜索 | 文本搜索 + AI 理解 | BM25 + 语义混合搜索 | 中 → 高 |
| 变更文件清单 | `git diff` 文件级 | 精确到符号级 | 低 → 精确 |
| Token 消耗 / 次 | ~3000–5000 tokens | ~200 tokens | GitNexus 胜 |

---

## §10.2 GitNexus 自动生成知识（v3.2 新增）

CI_MODE=full 时，代码智能层可自动生成以下知识文件：

### ci_clusters → cluster-mapping.md

```
ci_clusters() 返回功能集群后：
  1. 将集群结构写入 knowledge/dev/cluster-mapping.md
  2. 格式：集群名 → 包含文件列表 → 对外接口
  3. 标注生成时间戳和 CI_MODE
  4. 已有文件时对比差异，仅更新变更部分
```

### ci_processes → architecture-overview.md

```
ci_processes() 返回执行流列表后：
  1. 将执行流写入 knowledge/dev/architecture-overview.md
  2. 格式：模块分层图 + 关键调用链
  3. 标注生成时间戳
  4. 已有文件时合并更新
```

**触发时机**：
- 步骤九归档成功后自动执行（CI_MODE=full 时）
- 用户手动触发：`/update-knowledge`
- 首次初始化项目时（P0.4 检测到 CI_MODE=full）

**CI_MODE=no 时的行为**：跳过自动生成，knowledge/dev/ 文件由用户手动维护。

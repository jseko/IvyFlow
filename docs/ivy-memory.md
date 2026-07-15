# ivy memory — 记忆系统管理

## 功能介绍

`ivy memory` 管理 IvyFlow 的三层记忆系统。记忆在工作流中自动流转——open 阶段读取、design 阶段参考、archive 阶段写入。

### 三层记忆架构

| 层级 | 安装方式 | 功能 |
|------|----------|------|
| **核心（Core）** | 默认安装 | 事件时间线、项目事实、全文检索 |
| **扩展（Extended）** | 可选启用 | 向量搜索、记忆关联、知识图谱 |
| **插件（Plugin）** | 独立安装 | Council、Digital Twin、Org Intelligence |

### 扩展功能

| 功能 | 说明 |
|------|------|
| `vector-search` | 向量语义搜索 |
| `memory-linking` | 记忆关联 |
| `knowledge-graph` | 知识图谱 |
| `procedural-memory` | 程序记忆 |

### 记忆类型

| 类型 | 说明 | 写入时机 |
|------|------|---------|
| **decision** | 架构决策记录（ADR） | `ivy archive` 从 design.md 自动提取 |
| **constraint** | 项目约束（技术/流程/资源） | `ivy archive` 自动提取 |
| **risk** | 风险评估记录 | `ivy archive` 自动提取 |
| **fact** | 已确认的项目事实 | `ivy archive` 自动提取 |
| **evidence** | 验证证据 | `ivy archive` 自动提取 |

---

## 操作步骤

### 查看记忆状态

```bash
ivy memory status
```

输出示例：
```
🧠 Memory System Status
  Core Memory:
    Semantic:  12 records
    Episodic:  45 records
  Enabled Extensions:
    ✅ Vector Search
    ✅ Memory Linking
```

### 启用扩展功能

```bash
ivy memory enable vector-search
ivy memory enable memory-linking
ivy memory enable knowledge-graph
```

### 垃圾回收

```bash
# 预览（不删除）
ivy memory gc --dry-run

# 执行清理
ivy memory gc
```

### 知识关联

```bash
# 查看记忆之间的关联
ivy knowledge links

# 创建关联
ivy knowledge link <source-id> <target-id> --relation <type>

# 遍历关联图
ivy knowledge traverse <id>
```

---

## 工作流集成

### Agent 交互方式

记忆系统通过工作流自动流转，Agent 在各阶段按以下方式交互：

```
open 阶段（Step 0.5）
  ↓
ivy memory status          # 查看摘要
  ↓
只读取与当前 change 相关的记忆   # 避免上下文暴涨
  ↓
design 阶段（Step 0.5）
  ↓
ivy memory status          # 再次确认
  ↓
在设计中引用已有 ADR          # 保持一致性
  ↓
archive 阶段
  ↓
ivy archive --change <name>  # 自动提取决策/约束/风险/事实
  ↓
记忆写入 .ivy/memory/
```

### 上下文防暴涨策略

| 机制 | 配置 | 说明 |
|------|------|------|
| **Skill 指令限制** | "只读相关记忆" | open/design 阶段要求 Agent 只读取匹配当前模块的记忆 |
| **事件清理** | `episodic_max_days: 365` | 1 年后自动清理事件记录 |
| **自动压缩** | `auto_compress_threshold: 1000` | 超过 1000 条语义记录自动压缩 |
| **硬上限** | `semantic_max_records: 2000` | 语义记录硬上限 |
| **手动 GC** | `ivy memory gc --dry-run` | 用户可随时预览和清理 |

---

## 使用案例

### 案例 1：查看记忆系统概况

```bash
ivy memory status
```

### 案例 2：启用向量搜索

```bash
ivy memory enable vector-search
```

### 案例 3：清理过期记忆

```bash
ivy memory gc --dry-run   # 预览
ivy memory gc             # 执行
```

### 案例 4：Agent 在 open 阶段读取记忆

Agent 在执行 `/ivyflow` 的 open 阶段时，会自动运行 `ivy memory status` 检查项目已有决策和约束，确保新 change 不违反已有 ADR。

### 案例 5：完整记忆生命周期

```
1. ivy workflow start "add-user-auth"
2. /ivyflow "实现用户认证"        → open 阶段读取记忆
3. /ivyflow-design                → design 阶段引用 ADR
4. /ivyflow-build                 → 编码实现
5. /ivyflow-verify                → 验证
6. ivy archive --change add-user-auth  → 记忆自动写入
```

---

## 相关命令

- `ivy knowledge` — 知识链接管理
- `ivy archive` — 变更归档（写入记忆）
- `ivy council` — 记忆智囊团

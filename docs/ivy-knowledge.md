# ivy knowledge — 知识链接管理

## 功能介绍

`ivy knowledge` 管理记忆记录之间的知识链接，支持创建、查询、遍历和删除链接。

### 子命令

| 子命令 | 说明 |
|--------|------|
| `knowledge link` | 创建手动链接 |
| `knowledge links` | 查询记录的所有链接 |
| `knowledge traverse` | 遍历知识链接路径 |
| `knowledge unlink` | 删除链接 |

### 链接关系类型

| 关系 | 说明 |
|------|------|
| `influences` | 影响关系 |
| `implements` | 实现关系 |
| `precedes` | 前置关系 |
| `supersedes` | 替代关系 |
| `evidences` | 证据关系 |

## 操作步骤

### 创建链接

```bash
ivy knowledge link \
  --source decision-001 \
  --target decision-002 \
  --relation influences \
  --desc "Auth decision influenced API design"
```

### 查询链接

```bash
ivy knowledge links decision-001
```

### 遍历链接

```bash
# 正向遍历到决策类型
ivy knowledge traverse decision-001 --to decision

# 遍历到证据类型
ivy knowledge traverse decision-001 --to evidence
```

### 删除链接

```bash
# 删除记录中第 0 个链接
ivy knowledge unlink decision-001 --index 0
```

## 使用案例

### 案例 1：建立决策关联

```bash
ivy knowledge link \
  --source decision-auth \
  --target decision-db-schema \
  --relation influences \
  --desc "Auth decision shaped database user table design"
```

### 案例 2：追踪决策影响

```bash
ivy knowledge traverse decision-auth --to decision
# 查看认证决策影响了哪些后续决策
```

### 案例 3：审计知识图谱

```bash
ivy knowledge links decision-001
# 查看所有出入链接
```

## 相关命令

- `ivy trace` — 知识链接追溯
- `ivy memory` — 记忆系统管理

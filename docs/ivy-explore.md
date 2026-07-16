# ivy explore — 只读探索模式

## 功能介绍

`ivy explore` 启动只读探索模式，显示当前阶段允许和禁止的操作。帮助用户了解在当前阶段能做什么、不能做什么。

## 操作步骤

```bash
ivy explore
```

输出示例：

```
🔍 IvyFlow Explore Mode (Read-Only)

Current Phase: BUILD
Allowed Actions:
  ✅ Write implementation code (.ts, .js, .py, etc.)
  ✅ Edit test files
  ✅ Read any file
  ❌ Modify proposal/design documents
  ❌ Add new features outside scope

Tip: Use /ivyflow "your request" to start a guided workflow
```

## 使用案例

### 案例 1：不确定当前阶段能做什么

```bash
ivy explore
# 清楚看到当前阶段允许和禁止的操作
```

### 案例 2：新成员上手

```bash
ivy explore
# 了解当前工作流状态和操作边界
```

## 相关命令

- `ivy status` — 状态查询
- `ivy state show` — 生命周期状态

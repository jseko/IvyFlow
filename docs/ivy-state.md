# ivy state — 生命周期检查点

## 功能介绍

`ivy state` 管理 IvyFlow 的生命周期检查点，支持查看、设置和恢复状态。检查点模型绑定到 Change，记录阶段转换决策。

### 检查点

```
open → design → build → verify → archive
```

## 操作步骤

### 查看当前状态

```bash
ivy state show
```

### 查看指定 Change

```bash
ivy state show --change add-user-auth
```

### 查看待处理决策点

```bash
ivy state show --pending
```

### 设置检查点

```bash
# 转换到 BUILD 阶段
ivy state set build --change add-user-auth

# 带转换理由
ivy state set build --change add-user-auth --rationale "Design review approved"

# 带证据引用
ivy state set build --change add-user-auth --refs "evidence-001,evidence-002"
```

### 恢复状态

```bash
ivy state recover --change add-user-auth
```

## 使用案例

### 案例 1：手动阶段转换

```bash
# 设计完成，进入构建
ivy state set build --change add-login --rationale "PRD and design doc approved"
```

### 案例 2：重启后恢复

```bash
# 终端重启后恢复工作状态
ivy state recover --change add-payment
```

### 案例 3：审查待处理决策

```bash
ivy state show --pending
# 查看有哪些决策点需要处理
```

## 相关命令

- `ivy guard run` — 守卫检查
- `ivy workflow status` — 工作流状态

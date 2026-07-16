# ivy workflow — 工作流管理

## 功能介绍

`ivy workflow` 管理工作流生命周期，包括启动、状态查看、预设管理、证据展示和归档。

### 子命令

| 子命令 | 说明 |
|--------|------|
| `workflow start` | 启动工作流（创建状态 + 可选隔离） |
| `workflow status` | 显示当前工作流状态 |
| `workflow preset` | 列出或自动检测工作流预设 |
| `workflow evidence` | 显示转换证据 |
| `workflow archive` | 归档已完成的 Change |
| `workflow show` | 显示工作流帮助（默认） |

## 操作步骤

### 启动工作流

```bash
# 基本启动
ivy workflow start add-user-auth

# 创建隔离工作树
ivy workflow start add-user-auth --isolate
```

### 查看状态

```bash
ivy workflow status
ivy workflow status --change add-user-auth
```

### 预设管理

```bash
# 列出所有预设
ivy workflow preset

# 自动检测预设
ivy workflow preset --detect
ivy workflow preset --detect --change add-user-auth
```

### 证据展示

```bash
ivy workflow evidence --change add-user-auth

# 检查归档就绪
ivy workflow evidence --change add-user-auth --check-archive
```

### 工作流归档

```bash
ivy workflow archive add-user-auth

# 归档并清理工作树
ivy workflow archive add-user-auth --clean
```

## 工作流预设

| 预设 | 适用场景 |
|------|----------|
| `full` | 完整 5 阶段工作流 |
| `hotfix` | Bug 修复（≤2 文件，跳过头脑风暴） |
| `tweak` | 小改动（≤3 任务，跳过头脑风暴） |

## 使用案例

### 案例 1：启动新功能开发

```bash
ivy workflow start user-dashboard --isolate
# 创建隔离工作树，避免干扰主分支
```

### 案例 2：查看当前进度

```bash
ivy workflow status
# 显示当前阶段、转换历史
```

### 案例 3：归档前检查

```bash
ivy workflow evidence --change add-auth --check-archive
# 确认所有证据就绪后再归档
```

## 相关命令

- `ivy state` — 生命周期检查点
- `ivy guard` — 阶段守卫
- `ivy archive` — 变更归档

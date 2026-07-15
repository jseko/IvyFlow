# ivy role — 角色管理

## 功能介绍

`ivy role` 管理 IvyFlow 的多角色系统，支持在 5 个角色之间切换。

### 五大角色

| 角色 | 工作流 | 说明 |
|------|--------|------|
| 💻 **Developer** | open → design → build → verify → archive | 全栈开发 |
| 📋 **PM** | collect → analyze → prd → review → accept | 需求分析 |
| 🧪 **QA** | testcase → execute → bug → report → regression | 测试管理 |
| 🏗️ **Architect** | research → design → review → guide | 架构设计 |
| 🚀 **DevOps** | env → cicd → deploy → monitor → alert | 运维管理 |

## 操作步骤

### 查看当前角色

```bash
ivy role show
```

### 列出所有角色

```bash
ivy role list
```

### 切换角色

```bash
ivy role set pm
ivy role set qa
ivy role set architect
ivy role set devops
ivy role set developer
```

## 使用案例

### 案例 1：查看当前角色

```bash
ivy role show
# 输出：💻 全栈开发
#       编码 + 设计 + 测试
```

### 案例 2：切换到 PM 编写 PRD

```bash
ivy role set pm
# 之后使用 /pmflow 命令开始 PM 工作流
```

### 案例 3：在开发流程中切换角色

```bash
# 先以 PM 角色完成需求
ivy role set pm

# 再以 Developer 角色实现
ivy role set developer

# 最后以 QA 角色测试
ivy role set qa
```

## 相关命令

- `ivy pipeline` — 多角色流水线
- `ivy init` — 安装所有角色

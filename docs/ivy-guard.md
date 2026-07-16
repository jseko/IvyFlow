# ivy guard — 三重阶段守卫

## 功能介绍

`ivy guard` 是 IvyFlow 的核心防线，通过三层独立机制阻止 AI Agent 在不该写代码的时候写代码。它是纵深防御体系——从 Agent 本身到代码仓库，每个层面都能捕获违规行为。

### 三层守卫体系

| 层级 | 机制 | 拦截什么 |
|------|------|----------|
| **PreToolUse Hook** | 文件写入前的实时拦截 | OPEN、DESIGN、ARCHIVE 阶段的代码编辑 |
| **Rule 文件** | AI 平台加载的阶段感知规则 | Agent 侧的全局约束 |
| **Git Pre-Push Hook** | 阻止非 ARCHIVE 的推送 | Git 层的绕过防护 |

### 阶段权限

| 阶段 | 允许的操作 | 禁止的操作 |
|------|-----------|-----------|
| **OPEN** | 读文件、编辑 .md（方案） | 写代码（.ts、.js、.py 等） |
| **DESIGN** | 读文件、编辑 .md（设计） | 写实现代码 |
| **BUILD** | 写代码、编辑测试 | 修改方案/设计文档 |
| **VERIFY** | 跑测试、修编译错误 | 添加新功能 |
| **ARCHIVE** | 读文件、运行报告 | 写任何代码或文档 |

## 操作步骤

### 守卫验证

查看三层守卫安装状态：

```bash
ivy guard validate
```

### 演示场景

展示 3 个硬编码守卫场景：

```bash
ivy guard validate --demo
```

### 硬阻塞检查

对指定阶段运行守卫检查：

```bash
# 检查 BUILD 阶段是否合规
ivy guard run build --change add-user-auth

# 检查并自动转换到下一阶段
ivy guard run build --apply --change add-user-auth
```

## 使用案例

### 案例 1：确认守卫安装完整

```bash
ivy guard validate
# 输出：Hook ✅ Rule ✅ GitHook ✅
```

### 案例 2：阶段转换前守卫检查

```bash
# DESIGN → BUILD 转换前检查
ivy guard run design --apply --change add-login
# 通过后自动转换到 BUILD 阶段
```

### 案例 3：BUILD 阶段写代码验证

```bash
# 在 BUILD 阶段
ivy guard run build --change add-payment
# 验证通过，允许编辑代码文件
```

### 案例 4：拦截违规操作

当 Agent 在 OPEN 阶段尝试写 .ts 文件时：

```
❌ IvyFlow 规则拦截（OPEN 阶段只允许编辑 .md）
```

## 相关命令

- `ivy validate` — 阶段验证
- `ivy state set` — 手动设置阶段
- `ivy workflow status` — 工作流状态

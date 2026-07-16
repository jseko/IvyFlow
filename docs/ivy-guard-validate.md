# ivy guard validate — 守卫层验证

## 功能介绍

`ivy guard validate` 检查三重守卫层（PreToolUse Hook、Rule 文件、Git Pre-Push Hook）的安装状态，并提供场景演示。

## 操作步骤

### 基本验证

```bash
ivy guard validate
```

输出示例：

```
🛡️ Triple-Defense Guard Status

Hook Layer:    ✅ Installed (claude-code, cursor)
Rule Layer:    ✅ Installed (12 rules active)
GitHook Layer: ✅ Installed (pre-push hook configured)

Status: ALL 3 LAYERS ACTIVE — Full protection
```

### 场景演示

```bash
ivy guard validate --demo
```

演示 3 个硬编码守卫场景：
1. OPEN 阶段尝试写代码文件 → 被 Hook 拦截
2. DESIGN 阶段尝试提交代码 → 被 Rule 拦截
3. BUILD 阶段尝试推送非 ARCHIVE 分支 → 被 GitHook 拦截

## 使用案例

### 案例 1：安装后验证

```bash
ivy init --yes
ivy guard validate
# 确认三层守卫全部安装成功
```

### 案例 2：排查守卫问题

```bash
ivy guard validate
# 如果有层级显示 ❌，运行 ivy doctor --fix 修复
```

### 案例 3：新人培训演示

```bash
ivy guard validate --demo
# 展示守卫如何拦截违规操作
```

## 相关命令

- `ivy guard run` — 硬阻塞阶段守卫
- `ivy doctor` — 健康检查

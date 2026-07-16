# ivy status — 状态查询

## 功能介绍

`ivy status` 查看 IvyFlow 当前项目的工作流状态，包括项目配置摘要、守卫层状态、当前阶段和 AI 采纳率快照。

### 核心能力

- 项目级摘要：显示平台和安装范围
- 守卫状态：三重守卫（Hook、Rule、GitHook）安装状态
- 变更详情：指定 Change 时显示当前阶段和采纳率

## 操作步骤

### 查看项目状态

```bash
ivy status
```

输出示例：

```
IvyFlow project (claude-code,cursor/project)
🛡️  守卫：三重完整 [Hook ✅ Rule ✅ GitHook ✅]
  Pass --change <name> to inspect a specific change.
```

### 查看指定 Change 状态

```bash
ivy status --change add-user-auth
```

输出示例：

```
IvyFlow project (claude-code,cursor/project)
🛡️  守卫：三重完整 [Hook ✅ Rule ✅ GitHook ✅]
Change: add-user-auth
Phase:  build
Adoption: ~245 lines (medium confidence, commit-diff)
```

## 使用案例

### 案例 1：确认初始化是否成功

```bash
ivy status
# 如果输出包含 Guard 三重完整，说明安装成功
```

### 案例 2：查看当前工作流进度

```bash
ivy status --change add-login
# 确认 Change 当前处于哪个阶段
```

### 案例 3：检查 AI 代码贡献

```bash
ivy status --change add-payment
# 查看 Adoption 行数和置信度
```

## 相关命令

- `ivy init` — 初始化项目
- `ivy state show` — 查看生命周期状态
- `ivy workflow status` — 工作流详细状态

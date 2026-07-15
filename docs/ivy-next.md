# ivy next — 下一技能解析

## 功能介绍

`ivy next` 在阶段转换后解析下一个应该加载的技能，帮助 Agent 了解当前阶段应该执行什么。

## 操作步骤

```bash
ivy next add-user-auth
```

输出示例：

```
Next skill for 'add-user-auth':
  Phase: build
  Skill: ivy-build
  Description: Execute implementation tasks with TDD enforcement
```

## 使用案例

### 案例 1：阶段转换后了解下一步

```bash
ivy state set build --change add-auth
ivy next add-auth
# 输出：Next skill: ivy-build
```

### 案例 2：自动化工作流

```bash
NEXT_SKILL=$(ivy next add-auth | grep Skill | awk '{print $2}')
# 加载对应技能
```

## 相关命令

- `ivy handoff` — 上下文交接
- `ivy state set` — 阶段转换

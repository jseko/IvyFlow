# ivy council — 记忆智囊团

## 功能介绍

`ivy council` 提供基于记忆系统的智囊团分析，支持单项目和跨项目模式。通过多个视角分析记忆记录，回答关于项目的问题。

### 子命令

| 子命令 | 说明 |
|--------|------|
| `council ask` | 向智囊团提问 |
| `council list` | 列出已注册的视角 |
| `council register` | 注册自定义视角 |

## 操作步骤

### 向智囊团提问

```bash
# 单项目模式
ivy council ask "What are the key architectural decisions?"

# 指定输出格式
ivy council ask "What risks were identified?" --format json

# 指定视角
ivy council ask "How is auth implemented?" --perspectives security,architecture

# 设置最低置信度
ivy council ask "What dependencies are critical?" --min-conf 0.8

# 输出到文件
ivy council ask "Summarize all decisions" --output council-report.yaml
```

### 跨项目模式

```bash
ivy council ask "What patterns are common across projects?" --cross-project
ivy council ask "Compare auth implementations" --org
```

### 列出视角

```bash
ivy council list
ivy council list --json
```

### 注册视角

```bash
ivy council register
```

## 内置视角

| 视角 | 分析维度 |
|------|----------|
| architecture | 架构决策和模式 |
| security | 安全相关决策和风险 |
| quality | 代码质量和测试 |
| performance | 性能相关考量 |
| maintainability | 可维护性和技术债务 |

## 使用案例

### 案例 1：了解项目架构决策

```bash
ivy council ask "What were the key architecture decisions and why?"
```

### 案例 2：安全审查

```bash
ivy council ask "What security risks have been identified?" --perspectives security
```

### 案例 3：跨项目模式分析

```bash
ivy council ask "Which projects use JWT for authentication?" --cross-project
```

### 案例 4：归档前审查

```bash
ivy council ask "Are there any unresolved risks?" --min-conf 0.7
```

## 相关命令

- `ivy memory` — 记忆系统管理
- `ivy knowledge` — 知识链接管理

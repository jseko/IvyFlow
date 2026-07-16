# ivy rules — 规则管理

## 功能介绍

`ivy rules` 管理 IvyFlow 的工作流规则，包括查看、覆盖、生成、分析和验证规则。支持从检测到的技术栈自动生成上下文规则。

### 子命令

| 子命令 | 说明 |
|--------|------|
| `rules --list` | 列出所有活跃规则 |
| `rules --info <name>` | 查看规则详情 |
| `rules --override` | 覆盖规则参数 |
| `rules --remove` | 移除用户覆盖 |
| `rules generate` | 从技术栈生成规则 |
| `rules analyze` | 分析已生成规则 |
| `rules validate` | 验证规则有效性 |
| `rules audit` | 规则使用洞察 |

## 操作步骤

### 列出所有规则

```bash
ivy rules --list
```

### 查看规则详情

```bash
ivy rules --info stuck_detection
```

### 覆盖规则参数

```bash
ivy rules --override stuck_detection.build=25
```

### 移除覆盖

```bash
ivy rules --remove stuck_detection.build
```

### JSON 输出

```bash
ivy rules --list --json
```

### 生成规则

```bash
ivy rules generate
ivy rules generate --format json
```

### 分析规则

```bash
ivy rules analyze
ivy rules analyze --format json
```

### 验证规则

```bash
ivy rules validate
ivy rules validate --format json
```

### 规则审计

```bash
ivy rules audit
ivy rules audit stuck_detection
ivy rules audit --format json
ivy rules audit --days 60
```

## 规则层级

| 层级 | 说明 |
|------|------|
| **core** | 核心规则，始终部署 |
| **context** | 上下文规则，与技术栈绑定 |
| **optional** | 可选规则，仅推荐 |

## 使用案例

### 案例 1：调整卡住检测阈值

```bash
# 将 BUILD 阶段卡住阈值从默认改为 25 天
ivy rules --override stuck_detection.build=25
```

### 案例 2：技术栈变更后重新生成规则

```bash
ivy capability detect --refresh
ivy rules generate
ivy rules validate
```

### 案例 3：审查规则使用情况

```bash
ivy rules audit --days 30
```

## 相关命令

- `ivy capability detect` — 技术栈检测
- `ivy suggest` — 工作流建议

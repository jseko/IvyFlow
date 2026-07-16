# ivy validate — 阶段验证

## 功能介绍

`ivy validate` 验证当前 Change 的阶段（phase）和阶段历史（phase_history）是否符合阶段机（Phase Machine）定义的合法状态和转换规则。

### 核心能力

- 阶段合法性检查：确认 phase 值是否为有效阶段
- 转换合规检查：验证 phase_history 中的每次转换是否合法
- 安全检查：验证安全配置是否完整

## 操作步骤

### 基本验证

```bash
ivy validate
```

### 跳过安全检查

```bash
ivy validate --security false
```

## 阶段机转换规则

```
OPEN → DESIGN
DESIGN → BUILD | OPEN（回退）
BUILD → VERIFY | DESIGN（回退）
VERIFY → ARCHIVE | BUILD（回退）
ARCHIVE → []（终态）
```

## 使用案例

### 案例 1：检查阶段是否有效

```bash
ivy validate
# 输出通过/失败状态
```

### 案例 2：CI 流水线中集成

```bash
ivy validate && echo "Phase is valid" || echo "Phase violation detected"
```

## 相关命令

- `ivy state show` — 查看生命周期状态
- `ivy guard run` — 硬阻塞阶段守卫
- `ivy doctor` — 健康检查

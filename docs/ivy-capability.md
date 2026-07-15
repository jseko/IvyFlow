# ivy capability — 能力检测与管理

## 功能介绍

`ivy capability` 检测和管理项目技术能力，包括技术栈识别、能力列表、健康评估和验证配置。

### 子命令

| 子命令 | 说明 |
|--------|------|
| `capability detect` | 检测项目技术栈和能力 |
| `capability list` | 列出已检测的能力 |
| `capability health` | 能力健康评估（3D：覆盖、漂移、风险） |
| `capability profile` | 显示验证配置 |
| `capability verify` | 能力-生命周期集成检查 |

## 操作步骤

### 检测技术栈

```bash
ivy capability detect
ivy capability detect --refresh
ivy capability detect --format json
```

### 列出能力

```bash
ivy capability list
ivy capability list --recommended
```

### 健康评估

```bash
ivy capability health
ivy capability health --gaps-only
ivy capability health --recommendations
ivy capability health --format json
```

### 验证配置

```bash
ivy capability profile
ivy capability profile --format json
```

### 集成检查

```bash
ivy capability verify
```

## 三阶段编译器模型

| 阶段 | 说明 |
|------|------|
| **detect** | 扫描源码，识别技术栈 |
| **compile** | 纯函数计算，无 I/O |
| **emit** | 写入结果文件 |

## 使用案例

### 案例 1：项目初始化后检测

```bash
ivy init --yes
ivy capability detect
```

### 案例 2：技术栈变更后重新检测

```bash
npm install nextjs
ivy capability detect --refresh
```

### 案例 3：健康评估

```bash
ivy capability health
# 输出覆盖度、漂移度、风险度三维评估
```

### 案例 4：查看推荐技能

```bash
ivy capability list --recommended
# 查看当前技术栈推荐的技能包
```

## 相关命令

- `ivy fingerprint` — 技术栈检测
- `ivy rules generate` — 规则生成

# ivy fingerprint — 技术栈检测

## 功能介绍

`ivy fingerprint` 检测并展示项目的技术栈，附带置信度评分。自动识别语言、框架、构建工具、测试框架、包管理器和项目类型。

### 检测维度

| 维度 | 说明 |
|------|------|
| projectType | 项目类型（frontend/backend/fullstack/library/cli） |
| language | 编程语言 |
| frontend | 前端框架 |
| backend | 后端框架 |
| buildTool | 构建工具 |
| testFramework | 测试框架 |
| packageManager | 包管理器 |

## 操作步骤

### 基本检测

```bash
ivy fingerprint
```

输出示例：

```
🔍 检测到技术栈：
  TypeScript  React+Vite  Vitest  npm  frontend
  置信度：language(95%)  frontend(90%)  test(85%)
```

### JSON 输出

```bash
ivy fingerprint --json
```

### 强制刷新

```bash
ivy fingerprint --refresh
```

## 使用案例

### 案例 1：了解项目技术栈

```bash
ivy fingerprint
```

### 案例 2：项目迁移后重新检测

```bash
ivy fingerprint --refresh
```

### 案例 3：自动化脚本

```bash
ivy fingerprint --json | jq '.language.value[]'
```

## 相关命令

- `ivy capability detect` — 能力检测
- `ivy rules generate` — 规则生成

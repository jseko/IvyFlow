# ivy sync — 平台同步

## 功能介绍

`ivy sync` 将 `.ai-rules/` 目录中的规则同步到各平台特定格式（Claude Code、Cursor、CodeBuddy 等）。

## 操作步骤

### 预览同步（不写入）

```bash
ivy sync
```

### 应用同步

```bash
ivy sync --apply
```

### 指定平台

```bash
ivy sync --platforms claude-code,cursor --apply
```

## 同步格式

| 平台 | 格式 |
|------|------|
| Claude Code | `.claude/rules/` |
| Cursor | `.cursor/rules/` |
| CodeBuddy | `.codebuddy/rules/` |
| GitHub Copilot | `.github/copilot-instructions.md` |

## 使用案例

### 案例 1：规则变更后同步

```bash
ivy rules generate
ivy sync --apply
```

### 案例 2：仅同步特定平台

```bash
ivy sync --platforms claude-code --apply
```

## 相关命令

- `ivy rules` — 规则管理
- `ivy init` — 初始化安装

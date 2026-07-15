# ivy explain — 建议溯源

## 功能介绍

`ivy explain` 展示工作流建议的溯源信息，解释建议的产生原因、关联数据和分析逻辑。纯只读操作，不会修改任何数据。

## 操作步骤

### 解释指定建议

```bash
ivy explain --id <suggestion-id>
```

### 按 Change 过滤

```bash
ivy explain --change add-user-auth
```

### 按类型过滤

```bash
ivy explain --type stuck
ivy explain --type phase_review
```

### JSON 输出

```bash
ivy explain --id <id> --json
```

## 使用案例

### 案例 1：理解建议来源

```bash
ivy suggest --json | jq -r '.suggestions[0].id' | xargs ivy explain --id
# 了解第一条建议的完整溯源
```

### 案例 2：审查卡住建议原因

```bash
ivy explain --type stuck
```

### 案例 3：排查误报

```bash
ivy explain --id suspicious-suggestion --json
# 查看数据分析逻辑，判断是否为误报
```

## 相关命令

- `ivy suggest` — 工作流建议
- `ivy review` — 建议审查

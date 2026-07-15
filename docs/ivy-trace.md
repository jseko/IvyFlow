# ivy trace — 知识链接追溯

## 功能介绍

`ivy trace` 沿着知识链接正向或反向追溯记忆记录，支持影响评估。

## 操作步骤

### 正向追溯

```bash
ivy trace <record-id>
ivy trace <record-id> --direction forward
```

### 反向追溯

```bash
ivy trace <record-id> --direction backward
```

### 影响评估（实验性）

```bash
ivy trace <record-id> --impact
```

### JSON 输出

```bash
ivy trace <record-id> --json
```

## 使用案例

### 案例 1：追溯决策影响链

```bash
# 查看某个决策影响了哪些后续决策
ivy trace decision-001 --direction forward
```

### 案例 2：追溯证据来源

```bash
# 查看某个证据的上游来源
ivy trace evidence-042 --direction backward
```

### 案例 3：变更影响评估

```bash
ivy trace decision-auth --impact
# 评估修改认证决策的影响范围
```

## 相关命令

- `ivy knowledge traverse` — 知识图谱遍历
- `ivy audit` — 证据审计

# Phase State Machine

> 从 `src/core/phase-machine.ts` 派生。CI 通过 `npm run sync-phases:check` 校验本文件与 enum 一致。

## 状态枚举

- `open`：需求/构思阶段。允许触达：design / build。
- `design`：设计阶段。允许触达：build / open。
- `build`：实现阶段。允许触达：verify / design。
- `verify`：验证阶段。允许触达：archive / build。**禁止 verify → design**。
- `archive`：终态。无后继。

## 流转图

```
open    → design, build
design  → build, open
build   → verify, design
verify  → archive, build      （verify → design 被禁止）
archive → （终态）
```

## 关键不变量

1. 任何 change 在尚未到达 `archive` 之前，禁止 `git push`（Git pre-push hook 兜底）。
2. `open` / `design` / `archive` 阶段禁止编辑代码文件（Rule + PreToolUse Hook 强约束）。
3. 采纳率快照仅在 `archive` 阶段生成，无 `--force-snapshot`。

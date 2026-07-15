Bug 修复快捷路径 — 跳过 brainstorming 和完整 plan，直接进入 build 阶段。

## 适用条件（必须全部满足）

1. 修复已有功能的 bug，不新增 capability
2. 不涉及接口变更或架构调整
3. 改动范围可预估（通常 ≤ 2 个文件）

## 用法

```
/ivyflow-hotfix "修复登录页面 token 过期未刷新"
```

## 特点

- 跳过 brainstorming 和完整 plan
- 默认 TDD 模式关闭
- commit message 格式：`fix: <简述修复>`
- 包含根因消除检查

## 升级条件（满足任一即升级为完整流程）

- 改动涉及 3+ 文件
- 涉及架构变更（新模块、新接口、新依赖）
- 涉及数据库 schema 变更
- 修复引入新的 public API
- 修复范围超出单一函数/模块

升级时使用 `/ivyflow` 重新启动完整工作流。

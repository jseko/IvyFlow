小改动快捷路径 — 跳过 brainstorming 和完整 plan，轻量 build + 轻量 verify。

## 适用条件（必须全部满足）

1. 不新增 capability
2. 不改变架构
3. 不涉及接口变化
4. 通常不超过 3 个 tasks

## 用法

```
/ivyflow-tweak "更新 README 中的安装说明"
/ivyflow-tweak "调整按钮颜色为主题色"
```

## 特点

- 跳过 brainstorming 和完整 plan
- 默认 TDD 模式关闭
- commit message 格式：`tweak: <简述变更>`
- 轻量验证（≤ 3 tasks、≤ 4 files）

## 升级条件（满足任一即升级为完整流程）

- 改动涉及 5+ 文件
- 涉及多个模块的协调修改
- 需要新增测试用例 5+
- 涉及配置项的新增或删除（非值修改）
- 需要新增 capability 或 delta spec

升级时使用 `/ivyflow` 重新启动完整工作流。

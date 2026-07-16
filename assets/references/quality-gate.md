# 质量门控模板

## 准入条件（进入 Phase 前必须满足）

| Phase | 准入条件 |
|-------|---------|
| design | proposal.md 存在且非空 |
| build | design.md 存在，handoff 已生成 |
| verify | 所有 tasks 已完成 |
| archive | 验证报告通过 |

## 准出条件（离开 Phase 前必须满足）

| Phase | 准出条件 |
|-------|---------|
| open | proposal.md + design.md + tasks.md 已创建 |
| design | design doc 已创建，用户已确认方案 |
| build | 所有 tasks 已勾选，编译通过，测试通过 |
| verify | 质量门控全部通过，分支已处理 |
| archive | 归档脚本执行成功 |

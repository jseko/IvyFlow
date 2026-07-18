# Proposal Template

用于生成 proposal.md 的标准模板。

---

## Why

<!-- 1-2 句话说明问题和动机 -->
<!-- 从用户需求中提取：解决什么问题？为什么需要这个功能？ -->

## What Changes

<!-- 功能点列表，从用户需求中提取 -->
- 新增功能 A
- 新增功能 B
- 修改功能 C

## Capabilities

### New Capabilities

<!-- 根据功能点拆解为能力列表，每个能力对应一个 spec -->
<!-- 使用 kebab-case 命名，如：user-management, role-management -->
- `capability-name-1`: [能力描述]
- `capability-name-2`: [能力描述]

### Modified Capabilities

<!-- 如果修改现有功能，列出修改的能力；否则留空或注释 -->
<!-- 检查 openspec/specs/ 目录中的现有 spec 名称 -->

## 业务流程图

<!-- 每个 Capability 附带 ASCII 业务流程图，展示核心 Happy Path -->
<!-- 判断节点用 <...?> 格式，异常流独立列出 -->

```
{capability-name-1} 核心流程：

用户 ──→ [操作步骤1] ──→ [操作步骤2] ──→ <判断条件？>
                                            │是           │否
                                            ▼             ▼
                                      [正常结果]     [异常处理]
```

## Impact

**后端影响**：
<!-- 列出新增/修改的类、接口、配置等 -->
- 新增 X 个实体类
- 新增 X 个 Repository 接口
- 新增 X 个 Service 接口及实现类
- 新增 X 个 Controller 类
- 修改配置文件
- 数据库新增 X 张表

**前端影响**：
<!-- 列出新增/修改的页面、组件、状态管理等 -->
- 新增 X 个页面
- 新增 X 个组件
- 新增 X 个 Vuex/Redux 模块
- 新增 X 个 API 调用

**依赖影响**：
<!-- 列出新增/修改的外部依赖 -->
- 无新增外部依赖
<!-- 或 -->
- 新增依赖：[依赖名称] [版本] - [用途]

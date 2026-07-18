# 编译错误修复记录模板

> 本模板供步骤五使用，当编译修复 3 轮后仍有未解决错误时，生成此文档。

---

## 文档结构

```markdown
# 编译错误修复记录：{提案名称}

> 构建工具：{BUILD_TOOL}
> 技术栈：{BACKEND_STACK} + {FRONTEND_STACK}

---

## 修复摘要
- 总错误数：X 个
- 已修复：X 个
- 未修复：X 个
- 修复轮次：X 轮

---

## 修复详情

### 第 1 轮修复
#### 错误 1: {错误简述}
**文件位置**：`UserService.java:45`
**错误信息**：`error: ';' expected`
**修复方式**：在第 45 行末尾添加分号
**修复后状态**：✅ 编译通过

---

### 第 N 轮修复（未通过）
#### 错误 X: {错误简述}
**文件位置**：`UserService.java` ↔ `RoleService.java`
**错误信息**：`The dependencies of some of the beans form a cycle`
**尝试的修复方式**：
1. 使用 @Lazy 注解延迟加载
2. 重构依赖关系
**修复后状态**：❌ 仍然失败
**建议**：需要重新设计依赖关系，建议引入中间层或使用事件驱动模式解耦
```

---

## 降级提示用户

```
❌ 编译修复 3 轮后仍有未解决错误

修复记录已写入：openspec/changes/{提案名称}/build-resolver-001.md

剩余错误：
- {未修复错误摘要列表}

请手动介入修复后，告知我重新执行编译验证。
```

---

## java-build-resolver Agent 调用提示词

```
请使用 java-build-resolver agent 分析并解决项目编译报错：

## 项目信息
- 技术栈：Spring Boot 1.5.9 + Java 8
- 构建工具：Maven（./mvnw）
- 编码：UTF-8
- 后端目录：{BACKEND_DIR}

## 诊断步骤
1. 运行构建命令获取完整错误信息
2. 分析错误类型，匹配已知修复模式（见下表）

## 已知修复模式（按优先级）

| 优先级 | 错误模式 | 典型修复 |
|--------|---------|---------|
| P0 | 实体类/Repository 字段不匹配 | 检查 Entity 注解（@Column, @JoinColumn, @Table 等）和数据类型 |
| P0 | 缺少 import / 找不到符号 | 通常是新增文件导致，检查包路径和 import 语句 |
| P1 | Bean 循环依赖 | 使用 @Lazy 或重构依赖 |
| P1 | 方法签名不一致 | 检查 Service/Controller 调用方与实际定义是否匹配 |
| P2 | 配置属性不存在 | Spring Boot 1.5.x 不支持的部分新版本配置项 |
| P2 | 依赖版本冲突 | 检查 Maven 依赖树，排除冲突项 |

## 修复约束
- 仅做最小必要修复，不重构无关代码
- 不使用 @SuppressWarnings 抑制警告
- 不使用 // @ts-ignore、eslint-disable 等方式绕过
- 修复后必须重新编译验证
- 同类型错误连续 3 次无法修复 → 停止并生成修复报告

## 输出
将修复记录写入：openspec/changes/{提案名称}/build-resolver-001.md
格式：[FIXED] File:Line | Error | Fix | Remaining errors
```

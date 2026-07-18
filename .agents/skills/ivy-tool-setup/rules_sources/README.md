# Rules 源文件

声明式编码约束模板，供 `ivy-tool-setup` skill 在工作流初始化期间部署到目标工具目录使用。

## 设计原则

- **声明式而非教程式**：规则是约束（"做 X" / "禁止 Y"），而不是教程（无 BAD/GOOD 示例）
- **Agent 去重**：代码示例和任务模板属于 Agent 模板，不属于规则
- **最小化 Token**：目标为每个规则 40-80 行，保持上下文窗口的精简

## 规则文件

| 文件 | 目标 | 行数 | 适用条件 |
|------|------|------|---------|
| `java.md` | Java + Spring Boot 约束 | 73 | 后端使用 Java |
| `go.md` | Go 约束 | 58 | 后端使用 Go |
| `python.md` | Python 约束 | 64 | 后端使用 Python |
| `typescript.md` | TypeScript 约束 | 49 | 前端使用 TS/JS |
| `vue.md` | Vue 组件约束 | 43 | 前端使用 Vue |

## Agent 对应关系

每个规则文件与 Agent 模板配合使用，Agent 负责 HOW，规则负责 WHAT：

| 规则 | Agent 模板 | 关系 |
|------|-----------|------|
| `java.md` | `spring-agent.md` | 互补 |
| `go.md` | `go-agent.md` | 互补 |
| `python.md` | `python-agent.md` | 互补 |
| `typescript.md` | `frontend-agent.md` / `react-agent.md` | 互补 |
| `vue.md` | `frontend-agent.md` | 互补 |

## 筛选逻辑

在 skill 执行期间，`ivy-tool-setup` 根据项目技术栈检测选择应用哪些规则：
- 扫描 `pom.xml`/`build.gradle` 判断后端语言/框架 → 部署对应后端规则
- 扫描 `package.json` 判断前端框架 → 部署对应前端规则
- 条件不满足的规则被跳过

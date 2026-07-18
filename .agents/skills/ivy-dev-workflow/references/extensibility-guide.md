# 扩展性指引

> 当需要支持新技术栈、构建工具或测试框架时，按以下步骤依次更新 SKILL.md 及相关引用文件。

---

## 新增后端技术栈

以添加 Ruby on Rails 为例：

1. **更新 references/detection-rules.md**：添加配置文件到技术栈的映射行
2. **更新 SKILL.md 步骤三代码实现规范**：在"后端实现"表格添加一行（参考 `references/agent-mapping.md`）
3. **更新 references/build-commands.md**：添加编译命令
4. **更新 references/build-commands.md 测试部分**：添加测试命令
5. **更新 SKILL.md 步骤五错误分类处理**：添加技术栈特有的错误模式（如有）

---

## 新增前端技术栈

以添加 Svelte 为例：

1. **更新 references/detection-rules.md**：添加到 `package.json deps` 段
2. **更新 references/agent-mapping.md**：添加对应 Agent 和 Skill
3. **更新 references/build-commands.md**：添加前端测试命令和测试文件位置
4. **更新 templates/test-cases-prompt.md**：添加框架到组件测试方式映射

---

## 新增构建工具

1. **更新 references/detection-rules.md**：添加配置文件到构建工具的映射
2. **更新 references/build-commands.md**：添加编译命令、单元测试、集成测试、覆盖率命令
3. **验证**：在对应技术栈的真实项目中测试新增命令

---

## 新增测试框架

1. **更新 references/detection-rules.md**：添加测试框架推断逻辑
2. **更新 references/build-commands.md**：添加测试文件目录和文件命名规范
3. **更新 templates/test-code-prompt.md**：添加框架特定的测试模板和断言方式
4. **更新 templates/test-cases-prompt.md**：添加框架到集成测试方式映射

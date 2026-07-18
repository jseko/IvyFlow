# Ivy 工具项目初始化 Skill

自动化初始化 AI 编程工具（Claude、CodeBuddy、Qoder、Trae）的项目工作区，包括安装 openspec、创建知识库文档、部署专业 agents、迁移优化 skills 和 rules。

## 功能概述

本 skill 提供完整的 AI 编程工具项目初始化流程：

1. **安装 openspec CLI** - 自动检测并安装 openspec 工具
2. **初始化项目目录** - 创建工具特定的目录结构
3. **生成知识库文档** - 自动识别技术栈并生成项目文档
4. **部署专业 Agents** - 创建 5 个专业 agent（前端、后端、编译、审查）
5. **迁移优化 Skills** - 从源目录筛选并优化适用的 skills
6. **迁移优化 Rules** - 从源目录筛选并优化适用的 rules

## 支持的工具

| 工具名 | CLI 参数 | 目录路径 |
|--------|----------|----------|
| Claude | `claude` | `.claude/` |
| CodeBuddy | `codebuddy` | `.codebuddy/` |
| Qoder | `qoder` | `.qoder/` |
| Trae | `trae` | `.trae/` |

## 使用方法

### 基本用法

在项目根目录执行：

```bash
# 方式 1：通过 Claude 对话触发
"初始化 AI 工具项目"
"配置 Claude 工作区"
"创建 agent"

# 方式 2：直接调用 skill（如果支持）
/ivy-tool-setup
```

### 交互式流程

Skill 会引导你完成以下选择：

1. **选择工具** - Claude / CodeBuddy / Qoder / Trae
2. **确认技术栈** - 自动检测并让你确认
3. **选择 Agents** - 选择需要部署的专业 agents
4. **选择 Skills** - 选择需要迁移的 skills
5. **选择 Rules** - 选择需要迁移的 rules

### 自动化模式

如果你希望完全自动化执行（使用默认选项）：

```bash
# 设置环境变量
export AI_TOOL_SETUP_AUTO=true
export AI_TOOL_SETUP_TOOL=claude

# 然后触发 skill
```

## 目录结构

执行完成后，会生成以下目录结构：

```
{工具项目相对路径}/
├── agents/                    # 专业 agents
│   ├── frontend-agent.md
│   ├── spring-agent.md
│   ├── java-build-resolver.md
│   ├── java-reviewer.md
│   └── typescript-reviewer.md
├── skills/                    # 优化后的 skills
│   ├── springboot-patterns/
│   ├── security-review/
│   ├── dev-process/
│   └── code-reviewer/
├── rules/                     # 优化后的 rules
│   ├── java-conventions.md
│   ├── typescript.md
│   └── ...
├── docs/                      # 文档目录
│   └── setup-report.md
├── skills_sources/            # Skills 暂存目录
└── rules_sources/             # Rules 暂存目录
```

## Agent 说明

### 1. Frontend Agent (frontend-agent.md)
- **角色**: 资深前端研发专家
- **专长**: Vue 3 + TypeScript 生态
- **能力**: Composition API、响应式系统、类型编程、工程化

### 2. Spring Agent (spring-agent.md)
- **角色**: Spring Boot 后端架构师
- **专长**: 企业级 Java 应用开发
- **能力**: SOLID 原则、Spring 生态、数据库优化、安全认证

### 3. Java Build Resolver (java-build-resolver.md)
- **角色**: Java 编译问题修复专家
- **专长**: Maven/Gradle 构建错误解决
- **能力**: 编译错误、依赖冲突、配置问题修复

### 4. Java Reviewer (java-reviewer.md)
- **角色**: Java 代码审查专家
- **专长**: 代码质量和最佳实践审查
- **能力**: SOLID 审查、性能分析、安全检查

### 5. TypeScript Reviewer (typescript-reviewer.md)
- **角色**: TypeScript 代码审查专家
- **专长**: 类型安全和前端最佳实践
- **能力**: 类型检查、Vue/React 模式、性能优化

## 脚本工具

### detect-tech-stack.sh
自动检测项目技术栈并生成 JSON 配置。

```bash
./scripts/detect-tech-stack.sh [output-file]

# 输出示例: tech-stack.json
{
  "frontend": {
    "frameworks": "vue3,typescript,element-plus",
    "directory": "frontend",
    "build_tool": "vite",
    "package_manager": "pnpm"
  },
  "backend": {
    "frameworks": "java17,spring-boot-3.5.0,mybatis-plus",
    "directory": "backend",
    "build_tool": "maven"
  },
  "database": {
    "systems": "mysql,redis,elasticsearch"
  }
}
```

### optimize-skill.sh
优化 skill 文件以适配项目技术栈。

```bash
./scripts/optimize-skill.sh <skill-file> <tech-stack-json> [output-file]

# 示例
./scripts/optimize-skill.sh \
  ./skills/springboot-patterns/SKILL.md \
  tech-stack.json
```

**优化内容**:
- 更新框架版本号
- 替换目录路径
- 调整构建命令
- 移除无关内容
- 添加项目上下文

### optimize-rule.sh
优化 rule 文件以适配项目编码规范。

```bash
./scripts/optimize-rule.sh <rule-file> <tech-stack-json> [output-file]

# 示例
./scripts/optimize-rule.sh \
  ./rules/java-conventions.md \
  tech-stack.json
```

**优化内容**:
- 更新技术版本
- 调整编码规范
- 补充项目约束
- 移除无关规则
- 添加优化标记

## 技术栈检测

Skill 会自动检测以下技术栈：

### 前端检测
- **框架**: Vue 2/3, React, Angular
- **UI 库**: Element Plus, Ant Design, Ant Design Vue
- **构建工具**: Vite, Webpack
- **包管理器**: npm, yarn, pnpm, bun
- **语言**: TypeScript, JavaScript

### 后端检测
- **语言**: Java (版本检测)
- **框架**: Spring Boot (版本检测)
- **ORM**: MyBatis, MyBatis-Plus, JPA
- **构建工具**: Maven, Gradle

### 数据库检测
- **关系型**: MySQL, PostgreSQL
- **缓存**: Redis
- **搜索**: Elasticsearch
- **文档**: MongoDB

## 三阶段迁移流程

### Skills 迁移

**阶段 1: 暂存 (Staging)**
```bash
cp -r .claude/skills/* {工具项目相对路径}/skills_sources/
```

**阶段 2: 筛选 (Filtering)**
- 根据技术栈判断适用性
- 只拷贝适用的 skills

**阶段 3: 优化 (Optimization)**
- 更新版本号和路径
- 移除无关内容
- 添加项目上下文

### Rules 迁移

**阶段 1: 暂存 (Staging)**
```bash
cp .claude/rules/*.md {工具项目相对路径}/rules_sources/
```

**阶段 2: 筛选 (Filtering)**
- 根据文件扩展名和技术栈判断
- 只拷贝适用的 rules

**阶段 3: 优化 (Optimization)**
- 更新技术版本
- 调整编码规范
- 补充项目约束

## 验证清单

执行完成后，请检查：

- [ ] `openspec --version` 正常输出版本号
- [ ] `{工具项目相对路径}/` 目录已生成
- [ ] 项目知识库文档（如 `CLAUDE.md`）已生成且内容完整
- [ ] `agents/` 目录下存在 5 个 agent `.md` 文件
- [ ] `skills/` 目录下有经过优化的 skills
- [ ] `rules/` 目录下有经过优化的 rules
- [ ] `skills_sources/` 和 `rules_sources/` 暂存目录存在
- [ ] 所有脚本文件具有执行权限

## 错误处理

### 常见错误

**1. openspec 未安装**
```bash
Error: openspec 命令未找到
解决: npm install -g @fission-ai/openspec@latest
```

**2. Node.js 版本过低**
```bash
Error: Node.js 版本需要 >= 16
解决: 升级 Node.js 到 16 或更高版本
```

**3. 目录已存在**
```bash
Warning: 目录 .claude/ 已存在
选项: 
  1. 跳过初始化
  2. 备份并重新初始化
  3. 合并内容
```

**4. 源目录不存在**
```bash
Warning: .claude/skills/ 不存在
结果: 跳过 skills 迁移步骤
```

### 回滚机制

如果执行过程中出现错误，skill 会自动回滚：

1. 删除已创建的目录
2. 恢复备份文件
3. 记录错误日志
4. 提示用户手动检查

## 扩展性

### 添加新工具支持

在 `SKILL.md` 的工具映射表中添加：

```markdown
| 新工具名 | `newTool` | `.newtool/` |
```

### 添加新 Agent

1. 在 `templates/` 目录创建 agent 模板
2. 在 SKILL.md 的步骤四中添加部署逻辑
3. 更新 README.md 的 Agent 说明

### 添加新检测规则

在 `scripts/detect-tech-stack.sh` 中添加检测逻辑：

```bash
# 检测新框架
if grep -q '"new-framework"' "$package_json"; then
    frameworks+=("new-framework")
    log_success "检测到 New Framework"
fi
```

## 最佳实践

1. **首次使用**: 建议使用交互模式，仔细确认每个选项
2. **重复执行**: 使用自动化模式，提高效率
3. **定期更新**: 当项目技术栈变化时，重新运行 skill
4. **保留暂存**: 不要删除 `skills_sources/` 和 `rules_sources/`，便于后续调整
5. **版本控制**: 将生成的配置文件纳入 Git 版本控制

## 常见问题 (FAQ)

**Q: 可以为多个工具同时初始化吗？**
A: 可以，多次运行 skill 并选择不同的工具即可。

**Q: 如何更新已部署的 agents？**
A: 直接编辑 `agents/` 目录下的文件，或重新运行 skill 并选择覆盖。

**Q: Skills 和 Rules 可以手动添加吗？**
A: 可以，直接在对应目录下创建文件即可。

**Q: 如何卸载？**
A: 删除 `{工具项目相对路径}/` 目录即可。

**Q: 支持自定义技术栈吗？**
A: 支持，可以手动编辑 `tech-stack.json` 文件。

## 贡献指南

欢迎贡献新的 agents、skills 和 rules！

1. Fork 本项目
2. 创建特性分支
3. 提交变更
4. 发起 Pull Request

## 许可证

MIT License

## 更新日志

### v1.0.0 (2026-05-08)
- 初始版本发布
- 支持 Claude、Claude、Qoder、Trae 四种工具
- 提供 5 个专业 agents
- 实现三阶段迁移流程
- 自动技术栈检测
- 完整的错误处理和回滚机制

## 联系方式

- 问题反馈: [GitHub Issues]
- 文档: [在线文档]
- 社区: [讨论区]

---

**注意**: 本 skill 会修改项目文件，建议在使用前备份重要数据或使用版本控制系统。

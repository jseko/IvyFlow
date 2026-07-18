# Paths Configuration

本文件定义 ivy-dev-workflow skill 中使用的所有路径配置。

---

## Skill 基础路径

```
SKILL_BASE_DIR=.chat/v1/ivy-dev-workflow
```

## 模板文件路径

| 模板用途 | 相对路径 | 说明 |
|---------|---------|------|
| Proposal 模板 | `templates/proposal-template.md` | proposal.md 结构模板 |
| Design 模板 | `templates/design-template.md` | design.md 完整模板（20 章） |
| Spec 模板 | `templates/spec-template.md` | spec.md 结构模板 |
| Tasks 模板 | `templates/tasks-template.md` | tasks.md 格式参考 |
| Test Cases 提示词 | `templates/test-cases-prompt.md` | 测试用例生成提示词 |
| Review 提示词 | `templates/review-prompt.md` | 代码审查提示词 |
| Build Resolver 模板 | `templates/build-resolver.md` | 编译错误修复记录模板 |
| Test Code 提示词 | `templates/test-code-prompt.md` | 测试代码补全提示词 |
| Implementation Report 模板 | `templates/implementation-report.md` | 功能实现报告模板 |
| Steering 产品模板 | `templates/product-template.md` | 产品架构文档模板 |
| Steering 技术模板 | `templates/tech-template.md` | 技术架构文档模板 |
| Steering 结构模板 | `templates/structure-template.md` | 项目结构文档模板 |
| 需求模板 | `templates/requirements-template.md` | 需求文档模板 |

## 参考文档路径

| 文档用途 | 相对路径 | 说明 |
|---------|---------|------|
| 工具映射 | `references/tool-mapping.md` | AI 工具名 → CLI 参数映射 |
| 检测规则 | `references/detection-rules.md` | 技术栈检测规则 |
| Agent 映射 | `references/agent-mapping.md` | Agent/Skill 选择映射 |
| Agent 规范 | `references/agent-specs.md` | §4/§6/§7 Agent 规范 + §5.4 Prompt 模板 |
| 代码智能层 | `references/code-intelligence-layer.md` | §2 接口定义 + Fallback 策略 |
| 横切关注点 | `references/cross-cutting.md` | §8 安全 + §9 可观测性 + §10 知识引擎 |
| 概览与风险 | `references/overview.md` | §11 文件总览 + §12 ADR + §13 风险矩阵 |
| 构建命令 | `references/build-commands.md` | 编译、测试命令映射 |
| 扩展指南 | `references/extensibility-guide.md` | 新增技术栈扩展步骤 |
| 路径配置 | `references/paths-config.md` | 本文件 |

## OpenSpec 项目路径

| 路径用途 | 路径模式 | 说明 |
|---------|---------|------|
| Change 根目录 | `openspec/changes/{提案名称}/` | 每个 change 的根目录 |
| Proposal 文件 | `openspec/changes/{提案名称}/proposal.md` | 需求提案文件 |
| Design 文件 | `openspec/changes/{提案名称}/design.md` | 技术设计文件 |
| Specs 目录 | `openspec/changes/{提案名称}/specs/` | 功能规格目录 |
| Spec 文件 | `openspec/changes/{提案名称}/specs/{capability}/spec.md` | 单个功能规格文件 |
| Tasks 文件 | `openspec/changes/{提案名称}/tasks.md` | 任务清单文件 |
| Test Cases 文件 | `openspec/changes/{提案名称}/test-cases.md` | 测试用例文件 |

## 项目配置文件路径

| 配置用途 | 路径模式 | 说明 |
|---------|---------|------|
| 项目 CLAUDE.md | `CLAUDE.md` | 项目根目录的配置文档 |
| 模块 CLAUDE.md | `{BACKEND_DIR}/CLAUDE.md` | 后端模块配置文档 |
| 项目 Rules | `.claude/rules/*.md` | 项目编码规范 |

## 使用方式

在 SKILL.md 中引用路径时，使用以下格式：

```markdown
<!-- 引用模板 -->
读取模板：`templates/design-template.md`

<!-- 引用参考文档 -->
参见 [`references/agent-mapping.md`](references/agent-mapping.md)

<!-- 生成文件路径 -->
写入：`openspec/changes/{提案名称}/proposal.md`
```

## 路径变量

在运行时，以下变量会被替换：

- `{提案名称}`：用户需求生成的 kebab-case 提案名称
- `{BACKEND_DIR}`：后端目录（如 `blog-api`）
- `{FRONTEND_DIR}`：前端目录（如 `blog-app`）
- `{capability}`：能力名称（kebab-case）

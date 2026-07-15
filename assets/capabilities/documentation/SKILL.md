# 文档生成 (Documentation Generation)

从工作流产物自动生成项目文档。

## 自动生成内容

在 `/ivy-archive` 阶段完成后自动生成：

- **CHANGELOG.md** — 基于变更记录生成版本日志
- **API 文档** — 基于代码变更提取 API 变更

## 知识提取

系统会自动从设计文档中提取：

- 技术决策 (ADR)
- 约束条件
- 风险记录
- 项目事实

提取的知识保存在 `.ivy/knowledge/` 目录中。

## 模板自定义

文档生成使用 Handlebars 模板，可在 `templates/` 目录中自定义：

- `api-doc.hbs` — API 文档模板
- `changelog.hbs` — 变更日志模板

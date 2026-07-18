# 项目上下文模板
# 此模板用于在步骤三（知识库文档增强）和步骤四（Agent 项目特定配置）中注入项目信息
# 占位符格式：{{PLACEHOLDER}}

## 技术栈

- 前端：{{FRONTEND_TECH_STACK}}
- 后端：{{BACKEND_TECH_STACK}}
- 数据库：{{DATABASE_SYSTEMS}}
- 构建工具：{{BUILD_TOOLS}}

## 包结构

- 前端：{{FRONTEND_STRUCTURE}}
- 后端：{{BACKEND_PACKAGE}}

## 编码规范

- 前端：{{FRONTEND_STANDARD}}
- 后端：{{BACKEND_STANDARD}}
- 缩进：{{INDENT_FRONTEND}} 空格（前端）、{{INDENT_BACKEND}} 空格（后端）
- 命名：camelCase (变量/方法)、PascalCase (类/组件)、UPPER_SNAKE_CASE (常量)

## 特殊约定

{{PROJECT_CONVENTIONS}}

## 常用命令

### 前端

```bash
cd {{FRONTEND_DIR}}
{{PACKAGE_MANAGER}} install
{{PACKAGE_MANAGER}} run dev
{{PACKAGE_MANAGER}} run build
```

### 后端

```bash
cd {{BACKEND_DIR}}
{{BUILD_COMMAND_CLEAN}}
{{BUILD_COMMAND_RUN}}
{{BUILD_COMMAND_TEST}}
```

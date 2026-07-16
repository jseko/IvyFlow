# ivy init — 安装与初始化

## 功能介绍

`ivy init` 是 IvyFlow 的入口命令，用于在当前项目中初始化 IvyFlow 工作流约束系统。通过 4 步交互式向导或自动化模式，检测项目技术栈、适配 AI 编码平台、安装 5 个角色技能包和规则，完成一键部署。

### 核心能力

- **交互式 4 步向导**：Scope → Language/TechStack → CodeGraph/OpenSpec → Platforms → Install
- **自动技术栈检测**：识别项目语言、框架、构建工具、测试框架
- **30 平台适配**：覆盖 Claude Code、Cursor、GitHub Copilot 等
- **5 角色全安装**：Developer、PM、QA、Architect、DevOps
- **快捷模式**：`--quick` 跳过向导自动安装
- **国际化**：支持中文/English 切换

## 操作步骤

### 基本安装

```bash
npm install -g ivyflow-cli
cd your-project
ivy init
```

### 交互式向导步骤

1. **Scope**：选择 `project`（当前项目，推荐）或 `global`（全局）
2. **Language + TechStack**：选择工作语言（中文/English），自动检测并展示项目技术栈
3. **CodeGraph + OpenSpec**：选择是否安装语义代码智能和规范驱动开发工具
4. **Platforms + Install**：勾选要适配的 AI 编码平台，自动安装所有组件

### 非交互式快捷模式

```bash
# 快捷模式：自动选择推荐配置
ivy init --quick

# 交互模式（默认）
ivy init --standard

# 企业模式（等同于 standard）
ivy init --enterprise

# 接受所有默认值
ivy init --yes

# 安装所有能力包和平台
ivy init --all

# 指定平台
ivy init --platforms claude,cursor

# 覆盖已有文件
ivy init --overwrite

# 跳过 OpenSpec 安装（离线环境）
ivy init --skip-openspec
```

### CI 环境

非 TTY 环境下自动降级为 `--quick` 模式，无需手动指定。

## 安装后产物

```
.claude/
├── commands/          # 20 个命令（5 个角色 + 公共命令）
├── skills/
│   ├── ivy-role/      # 角色调度器（自动识别当前角色）
│   ├── ivy/           # Developer 阶段技能（8 + references）
│   ├── pm/            # PM 阶段技能（6）
│   ├── qa/            # QA 阶段技能（6）
│   ├── architect/     # Architect 阶段技能（5）
│   └── devops/        # DevOps 阶段技能（6）
└── rules/             # 阶段守卫 + 安全 + 编码规则

.ivy/
└── project.yaml       # 角色、语言、能力、工作流配置
```

## 使用案例

### 案例 1：新项目快速初始化

```bash
cd my-new-project
ivy init --yes
```

### 案例 2：已有项目指定平台安装

```bash
cd existing-project
ivy init --platforms claude,cursor --quick
```

### 案例 3：离线环境安装

```bash
ivy init --skip-openspec --quick
```

## 相关命令

- `ivy role set` — 切换当前角色
- `ivy status` — 查看当前工作流状态
- `ivy uninstall` — 卸载 IvyFlow
- `ivy doctor` — 健康检查

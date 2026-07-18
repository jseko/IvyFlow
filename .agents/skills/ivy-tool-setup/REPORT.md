# Ivy Tool Setup Skill 汇报文档

> 生成日期：2026-06-03 | 版本：2.0.0

---

## 一、概述

`ivy-tool-setup` 是 AI 编程工具项目初始化的一键配置技能，覆盖从环境检测到生产级代码智能层部署的完整链路。支持 Claude、CodeBuddy、Qoder、Trae 四种主流 AI 编程工具，以及 Spring Boot、Vue、React、TypeScript 等全栈技术栈。

**核心能力（8 步流程）：**

```
步骤 0          步骤 1              步骤 2-3          步骤 4-5           步骤 6-7
环境检测   →   核心工具安装    →   目录+知识库   →   Agents+Wiki    →   Skills+Rules
(Node/Git/    (openspec +       (.claude/        (5 个专业 Agent    (筛选→拷贝
 Java/Maven)   GitNexus+MCP)      CLAUDE.md)       + 知识图谱 Wiki)    →优化)
```

---

## 二、架构设计

### 2.1 分层架构

```
┌─────────────────────────────────────────────────────┐
│                   调用层                              │
│  /ivy-tool-setup [--step=N] [--tool=X] [--force]    │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│                 执行引擎层                            │
│  execute_step() → 步骤路由 → 错误捕获 → 回滚管理      │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│                 功能模块层                            │
│  ┌──────────┬──────────┬──────────┬──────────────┐  │
│  │ 环境检测  │ 包安装   │ 目录管理  │ 模板引擎      │  │
│  │ detect_* │ npm -g   │ mkdir -p │ sed 变量替换  │  │
│  └──────────┴──────────┴──────────┴──────────────┘  │
│  ┌──────────┬──────────┬──────────┬──────────────┐  │
│  │ 知识库    │ Agent部署│ Wiki生成  │ Skill/Rule   │  │
│  │ openspec  │ 5 agents │ gitnexus  │ 迁移+优化     │  │
│  │ init      │ 模板填充  │ wiki      │ 筛选+拷贝     │  │
│  └──────────┴──────────┴──────────┴──────────────┘  │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│                 基础设施层                            │
│  ┌──────────┬──────────┬──────────┬──────────────┐  │
│  │ 日志系统  │ 回滚系统  │ 验证系统  │ 幂等性保证    │  │
│  │ log()    │ rollback │ verify   │ safe_copy()  │  │
│  └──────────┴──────────┴──────────┴──────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 2.2 关键设计决策

| 决策 | 方案 | 理由 |
|------|------|------|
| D1: 幂等性 | `mkdir -p` + 文件存在性检查 + 覆盖询问 | 支持重复执行，安全可靠 |
| D2: 工具检测 | 目录优先级 `.codebuddy` > `.claude` > `.qoder` > `.trae` | CodeBuddy 配置最丰富，优先作为源 |
| D3: 错误分级 | Fatal（终止）/ Warning（继续）/ Info（提示） | 避免非关键错误阻断整体流程 |
| D4: 模板引擎 | `sed` 占位符替换 + 技术栈 JSON | 最小依赖，兼容所有 Unix 环境 |
| D5: GitNexus 集成 | `gitnexus setup` 自动检测编辑器 | 一键注册 MCP，无需手动配置 |
| D6: Wiki 生成 | DeepSeek API + 并发控制 | 成本可控，支持 OpenAI 兼容接口 |

---

## 三、各步骤详细分析

### 步骤 0：环境检测

**检测矩阵：**

| 检测项 | 命令 | 通过条件 | 失败级别 |
|--------|------|---------|---------|
| Node.js | `node --version` | >= 18.0.0 | Fatal（< 16）/ Warning（16-17） |
| npm | `npm --version` | 已安装 | Fatal |
| Git | `git --version` | 已安装 | Fatal |
| Git 仓库 | `git rev-parse --git-dir` | 是 Git 仓库 | Warning |
| Java | `java -version` | 已安装（仅 Java 项目） | Warning |
| Maven/Gradle | `mvn --version` | 已安装（仅 Java 项目） | Warning |
| 包管理器 | lock 文件检测 | 对应 PM 可用 | Warning |

**设计亮点：**
- 分层致命度：仅 Node.js 和 Git 缺失为 Fatal，其他为 Warning 不阻断流程
- 自动包管理器检测：根据 `pnpm-lock.yaml` / `yarn.lock` 智能选择
- 安装引导：致命错误时输出平台特定的安装命令（brew / apt / nvm）

### 步骤 1：安装 openspec + GitNexus

**子步骤流程（14 步）：**

```
检测已有安装 → npm 全局安装 → 验证安装 → openspec init
→ gitnexus setup（MCP 注册）→ context7 MCP 注册（.mcp.json）
→ gitnexus analyze（代码索引）
→ 自动安装 4 个 Agent Skills → 注册 Hooks
→ gitnexus wiki（仓库 Wiki）→ 配置自定义模板路径
→ gitnexus status（验证 CI_MODE）
```

**GitNexus 自动安装内容：**

| 资源 | 数量 | 详情 |
|------|------|------|
| Agent Skills | 4 | `gitnexus-exploring` / `debugging` / `impact-analysis` / `refactoring` |
| Hooks | 2 | PreToolUse（查询前丰富上下文）、PostToolUse（提交后重建索引） |
| Wiki 文档 | N 页 | `.gitnexus/wiki/` 下按模块生成架构文档 |

**CI_MODE 状态机：**
```
gitnexus status
  ├── up-to-date → CI_MODE=full   （精确符号级分析）
  ├── stale      → CI_MODE=stale  （索引过期，标注"尽力"）
  └── error      → CI_MODE=no     （降级为 AI 推断）
```

### 步骤 2：初始化项目目录

- 支持 4 种工具目录：`.claude/` / `.codebuddy/` / `.qoder/` / `.trae/`
- 每个工具创建 4 个子目录：`agents` / `skills` / `rules` / `agent-memory`
- 幂等性保证：`mkdir -p` + 目录存在性验证

### 步骤 3：创建项目知识库文档

**6 个子步骤：**

1. 已有文档检测（避免覆盖）
2. `openspec init` 生成基础文档（PROJECT.md / ARCHITECTURE.md / TECH_STACK.md / CONVENTIONS.md）
3. 缺失文档模板补全
4. 追加「AI 工具增强配置」章节（Agent 列表 + Skills 列表 + Rules 列表 + 使用方式）
5. 注入「项目特定配置」（技术栈 + 包结构 + 编码规范 + 特殊约定）
6. 从 `tech-stack.json` 自动提取项目信息填充

### 步骤 4：创建 Agent 文件

**5 个专业 Agent：**

| Agent | 触发条件 | 适用场景 |
|-------|---------|---------|
| `frontend-agent` | 检测到 Vue/React/TypeScript | 组件开发、类型定义、性能优化 |
| `spring-agent` | 检测到 Spring Boot | API 设计、服务层开发、架构决策 |
| `java-build-resolver` | 检测到 Java 项目 | 编译错误修复、依赖冲突解决 |
| `java-reviewer` | 检测到 Java 项目 | 代码质量审查、最佳实践检查 |
| `typescript-reviewer` | 检测到 TypeScript | 类型安全检查、前端代码审查 |

**模板变量替换策略：**
- 项目名称：从当前目录名提取
- 技术栈版本：从 `pom.xml` / `package.json` 自动检测
- 包名：从 Java 源文件 `package` 声明推断（`com.shimh` 等）
- 编码规范：Google Java Style / Airbnb TypeScript

### 步骤 5：生成 Wiki 文档

**执行前置条件：**
- GitNexus 索引状态 `up-to-date`
- `DEEPSEEK_API_KEY` 环境变量已配置

**并发数调优：**

| 项目规模 | 并发数 | 说明 |
|---------|--------|------|
| < 50 文件 | 3（默认） | 小型项目 |
| 50-200 文件 | 5 | 中型项目（推荐） |
| > 200 文件 | 5-8 | 大型项目，需 API 配额充足 |

**失败处理矩阵（5 种错误类型 → 具体解决方案）：**

| 错误 | 原因 | 解决 |
|------|------|------|
| 401 | API Key 无效 | 检查 `DEEPSEEK_API_KEY` |
| 429 | 限流 | 降低 `--concurrency` |
| Connection refused | 网络/端点 | 检查 `--base-url` |
| Index not found | 索引损坏 | `gitnexus analyze --force` |
| 内容为空 | 模型不可用 | 更换 `--model` |

### 步骤 6-7：迁移并优化 Skills / Rules

**Skills 筛选逻辑：**

```
通用（始终包含）：
  security-review / dev-process / code-reviewer

条件包含（基于技术栈）：
  Spring Boot → springboot-patterns / api-design
  Vue/React   → frontend-patterns
```

**Rules 筛选逻辑：**

```
Java / Spring Boot：
  java.md / spring-boot-rest-api-rules.md
  java-controller-conventions.md / java-service-conventions.md
  java-entity-conventions.md / java-dto-conventions.md
  java-apiresponse-conventions.md / java-global-exception-handler.md

TypeScript / Vue：
  typescript.md / vue.md / vue3.md / eslint.md（条件）
```

**优化脚本（optimize-skill.sh / optimize-rule.sh）执行：**
1. 更新版本号（Java 17 / Spring Boot 3.5.0 / Vue 3.4）
2. 替换工具名称引用
3. 更新依赖路径
4. 检查依赖完整性
5. 格式化文档（prettier）

---

## 四、设计原则执行情况

| 原则 | 实现方式 | 验证点 |
|------|---------|--------|
| **幂等性** | `mkdir -p`、文件存在性检查、覆盖询问 | 重复执行不报错 |
| **智能检测** | `detect_tool()` / `detect_tech_stack()` / `should_deploy_agent()` | 自动识别技术栈并按需部署 |
| **渐进式执行** | `--step=N` 分步执行、 `--force` 强制模式、 `--skip` 跳过 | 支持断点续跑 |
| **可扩展性** | 声明式工具配置映射、Agent 模板系统、自定义配置钩子 | 新增工具只需修改配置 |
| **错误恢复** | 三级错误分类（Fatal/Warning/Info）、`rollback()` 分步回滚 | 失败可回滚到上一步 |
| **可验证** | `verify_setup()` 完整性检查、自动生成 `setup-report.md` | 安装后可自动验证 |

---

## 五、技术实现亮点

### 5.1 GitNexus + Context7 双 MCP 代码智能层

```
MCP Server 注册（步骤 1.7-1.8）
  ├── gitnexus setup（一键 MCP 注册）
  │   └── 自动检测：Claude Code / Cursor / Codex / Windsurf / OpenCode
  │       └── 写入全局 MCP 配置 → 所有项目共用
  └── context7 MCP 注册（项目级 .mcp.json）
      └── 编辑器通用：Claude Code / Cursor / Windsurf 均可共用
          └── 提供最新第三方库文档查询能力

gitnexus analyze（代码索引）
  └── 全量/增量扫描 → Leiden 社区检测 → 功能聚类
      ├── 4 个 Agent Skills 自动安装
      ├── PreToolUse + PostToolUse Hooks 自动注册
      └── --skills 参数 → 每个社区生成专属 SKILL.md

gitnexus wiki（架构文档生成）
  └── 知识图谱数据 → LLM（DeepSeek）→ 结构化 Wiki 页面
      ├── README.md（索引）
      ├── architecture.md（架构概览）
      ├── module-*.md（模块详细文档）
      └── dependencies.md（依赖关系图）
```

### 5.2 多工具双向迁移

源目录检测优先级：`.codebuddy` > `.claude` > `.qoder` > `.trae`

支持 6 种迁移方向：Claude ↔ CodeBuddy / Qoder / Trae 之间的任意组合

### 5.3 知识库文档增强

```
基础文档（openspec init 生成）
  + AI 工具增强配置章节（Agents / Skills / Rules 清单 + 使用方式）
  + 项目特定配置章节（技术栈 / 包结构 / 编码规范 / 特殊约定）
  = 完整的项目知识库文档
```

### 5.4 模板变量替换

从项目文件自动提取变量值，无需用户手动填写：
- 包名 → Java 源文件 `package` 声明
- 版本号 → `pom.xml` / `package.json`
- 项目名 → 目录名 `basename $(pwd)`

---

## 六、错误处理与回滚

### 6.1 错误分类体系

| 级别 | 图标 | 行为 | 示例 |
|------|------|------|------|
| Fatal（致命） | ❌ | 立即终止，输出安装引导 | Node.js 缺失、权限不足 |
| Warning（警告） | ⚠️ | 记录日志，继续执行 | Java 未安装、skill 拷贝失败 |
| Info（提示） | ℹ️ | 仅提示，不记录 | 文件已存在（幂等跳过） |

### 6.2 回滚策略

```
execute_step()
  ├── 步骤成功 → 记录日志，继续下一步
  └── 步骤失败 → rollback(step_num)
      ├── 步骤 2：rm -rf agents/ skills/ rules/ agent-memory/
      ├── 步骤 4：rm -rf agents/*.md
      ├── 步骤 5：rm -rf skills/*
      └── 步骤 6：rm -rf rules/*
```

### 6.3 日志系统

- 路径：`$BASE_DIR/setup.log`
- 格式：`[时间戳] [级别] 消息`
- 级别：ERROR（stderr）/ WARN（stdout + 警告图标）/ INFO（stdout + 勾号）

---

## 七、验证体系

### 7.1 完整性检查清单（7 大类）

| 检查项 | 验证内容 | 通过标准 |
|--------|---------|---------|
| openspec | `openspec --version` | 命令可用 |
| 目录结构 | `agents/` `skills/` `rules/` `agent-memory/` | 4 目录均存在 |
| 知识库文档 | `CLAUDE.md` 存在 + 含增强配置 + 项目特定配置 | 3 项全部满足 |
| Agents | YAML frontmatter 格式正确 | 无缺失 frontmatter |
| Agent Memory | 子目录 + README.md | 全部存在 |
| Skills | 目录数 > 0 | 已迁移 |
| Rules | 文件数 > 0 | 已迁移 |

### 7.2 自动报告生成

执行完成后自动生成 `setup-report.md`，包含：
- 执行时间和工具类型
- 技术栈检测结果
- 部署的 Agents / Skills / Rules 清单
- 验证结果摘要

---

## 八、扩展性设计

### 8.1 新增工具支持

在 `TOOL_CONFIG` 关联数组中添加一行即可：
```bash
["newtool"]=".newtool"
```

### 8.2 新增 Agent 模板

1. `templates/` 目录创建新模板（`new-agent.md`）
2. `should_deploy_agent()` 函数添加部署条件
3. 更新文档

### 8.3 用户自定义配置

项目根目录创建 `.ai-tool-setup-config.sh`，可自定义：
- `custom_skill_filter()` — 自定义 skill 筛选规则
- `custom_optimize_skill()` — 自定义优化逻辑

---

## 九、使用统计（基于 SKILL.md 结构分析）

| 指标 | 数值 |
|------|------|
| 总行数 | 2,091 行 |
| 步骤数 | 8（步骤 0-7） |
| bash 脚本块 | 40+ |
| Agent 模板数 | 5 |
| Skill 迁移目标 | 6（通用 3 + 条件 3） |
| Rule 迁移目标 | 9（Java 9 + TS/Vue 4） |
| 错误处理分支 | 15+ |
| 验证检查项 | 14（7 大类） |
| 支持工具数 | 4（Claude / CodeBuddy / Qoder / Trae） |
| 迁移方向 | 6 种双向组合 |

---

## 十、总结与建议

### 优势

1. **完整链路覆盖**：从环境检测到 Agent/Wiki/Skills/Rules 一步到位
2. **GitNexus + Context7 双 MCP 集成**：代码智能层自动建立索引、注册 MCP，同时提供实时文档查询能力
3. **多工具互操作**：支持 4 种工具间的 Skills/Rules 双向迁移
4. **错误恢复健壮**：三级错误分级 + 分步回滚
5. **可验证可审计**：自动生成 setup-report.md 报告

### 潜在改进方向

1. **并行化**：步骤 4（Agent 部署）、步骤 5（Wiki 生成）、步骤 6-7（Skills/Rules 迁移）之间无依赖，可并行执行
2. **配置文件驱动**：将硬编码的 Agent/Skill/Rule 列表抽取为 YAML/JSON 配置，降低维护成本
3. **增量更新**：当前步骤 6-7 是全量拷贝+优化，可改为 diff 式增量更新，仅同步变更的 Skill/Rule
4. **Dry-run 模式**：在执行前展示将要创建/修改的文件清单，供用户预览确认
5. **Windows 兼容**：当前 bash 脚本仅适用 Unix/macOS，可增加 PowerShell 版本

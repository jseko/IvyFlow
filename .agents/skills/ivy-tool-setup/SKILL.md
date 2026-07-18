---
name: ivy-tool-setup
description: AI 编程工具项目初始化 - 环境检测（Node.js/Git/Java/Maven）→ 安装 openspec + GitNexus + Context7 MCP → 创建知识库 → 部署 agents → 生成 Wiki 文档 → 迁移优化 skills 和 rules
version: 2.0.0
author: AI Tool Setup Team
tags: [setup, initialization, openspec, gitnexus, agents, skills, rules]
---

# Ivy Tool Setup Skill

## ⚠️ 执行原则（必读）

**所有命令必须在用户调用 skill 时的当前工作目录执行，绝对不要使用 `cd` 切换目录！**

- ✅ 正确：直接执行 `openspec init --tools Codex --force`
- ❌ 错误：执行 `cd .. && openspec init --tools Codex --force`

**原因：** 用户在哪个目录调用 skill，就应在哪个目录创建工具目录 `$BASE_DIR`（agents/skills/rules 存放其中）；知识库主文件（`AGENTS.md` / `CODEBUDDY.md` / `CURSOR.md` 等）始终位于**项目根目录**。

---

## 概述

本 skill 用于为 AI 编程工具（Codex、CodeBuddy、Qoder、Trae、Cursor、Windsurf、Cline 等）初始化项目环境，自动完成以下任务：

1. **环境检测** - 检测 Node.js、Git、Java、Maven 等运行时和工具版本
2. **安装核心工具** - 安装 openspec + GitNexus 代码智能层
3. **初始化项目目录** - 根据工具类型创建标准目录结构
4. **创建项目知识库文档** - 执行 openspec init 生成项目文档
5. **创建 Agent 文件** - 部署 5 个专业 agent
6. **生成 Wiki 文档** - 通过 gitnexus wiki 生成仓库架构 Wiki
7. **迁移并优化 Skills** - 从其他工具目录筛选、拷贝并优化 skills
8. **迁移并优化 Rules** - 从其他工具目录筛选、拷贝并优化 rules

## 设计原则

- **幂等性** - 可重复执行，自动跳过已完成步骤
- **智能检测** - 自动识别工具类型和技术栈
- **渐进式执行** - 支持分步执行和故障恢复
- **可扩展性** - 易于添加新工具和模板支持

## 使用方法

**⚠️ 重要：请在项目根目录执行此 skill**

本 skill 会在**当前工作目录**创建 AI 工具目录结构（`.Codex/`、`.codebuddy/`、`.qoder/`、`.trae/`、`.cursor/`、`.windsurf/`、`.cline/`），知识库主文件（`AGENTS.md` / `CODEBUDDY.md` 等）生成到项目根目录。

- ✅ 正确：在项目根目录执行（包含 `pom.xml`、`package.json` 或主要源码的目录）
- ❌ 错误：在子模块目录执行（如 `backend/`、`frontend/` 等）

### 完整执行
```
/ivy-tool-setup
```

### 分步执行
```
/ivy-tool-setup --step=0  # 仅环境检测
/ivy-tool-setup --step=1  # 仅安装 openspec + gitnexus
/ivy-tool-setup --step=2  # 仅初始化目录
/ivy-tool-setup --step=3  # 仅创建知识库
/ivy-tool-setup --step=4  # 仅创建 agents
/ivy-tool-setup --step=5  # 仅生成 Wiki 文档
/ivy-tool-setup --step=6  # 仅迁移 skills
/ivy-tool-setup --step=7  # 仅迁移 rules
```

### 指定工具类型
```
/ivy-tool-setup --tool=Codex
/ivy-tool-setup --tool=codebuddy
```

---

## 执行流程

当用户调用此 skill 时，按照以下步骤执行：

**⚠️ 关键原则：所有命令必须在当前工作目录执行，不要使用 `cd ..` 或切换目录**

### 步骤零：环境检测

**目标：** 在安装任何工具之前，确保运行时环境和基础工具满足要求

**⚠️ 重要：所有命令在当前工作目录执行，不要使用 `cd` 切换目录**

**执行逻辑：**

1. **检测 Node.js**
   ```bash
   node --version 2>/dev/null
   ```
   - 版本 >= 18.0.0 → ✅ 通过（GitNexus 要求 >= 18）
   - 版本 >= 16.0.0 但 < 18 → ⚠️ 警告：openspec 可用，但 GitNexus 不可用
   - 未安装或 < 16.0.0 → ❌ 致命错误，提示用户安装 Node.js >= 18

   安装引导（Node.js 缺失时）：
   ```
   ❌ Node.js 未安装或版本过低（当前：{version}，需要：>= 18.0.0）

   请先安装 Node.js：
   - macOS:  brew install node@20
   - Linux:  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
             sudo apt-get install -y nodejs
   - 或使用 nvm:  nvm install 20 && nvm use 20

   安装完成后重新执行 /ivy-tool-setup
   ```

2. **检测 npm**
   ```bash
   npm --version 2>/dev/null
   ```
   - 已安装 → ✅ 通过
   - 未安装 → ❌ 提示安装 Node.js（npm 随 Node.js 一起安装）

3. **检测 Git**
   ```bash
   git --version 2>/dev/null
   git rev-parse --git-dir 2>/dev/null
   ```
   - Git 已安装且当前目录是 Git 仓库 → ✅ 通过
   - Git 已安装但非 Git 仓库 → ⚠️ 警告：GitNexus 需要 Git 仓库才能建立索引
   - Git 未安装 → ❌ 致命错误

   安装引导（Git 缺失时）：
   ```
   ❌ Git 未安装

   请先安装 Git：
   - macOS:  brew install git
   - Linux:  sudo apt-get install git
   ```

4. **检测 Java（Spring Boot 项目）**
   ```bash
   if [ -f "pom.xml" ] || [ -f "build.gradle" ]; then
     java -version 2>&1 | head -1
     mvn --version 2>/dev/null | head -1 || gradle --version 2>/dev/null | head -1
   fi
   ```
   - 检测到 pom.xml/build.gradle → 验证 Java 和 Maven/Gradle 可用
   - Java 未安装 → ⚠️ 警告：后端编译（步骤五）将失败
   - Maven/Gradle 未安装 → ⚠️ 警告：无法执行后端构建
   - 非 Java 项目 → 跳过此检测

5. **检测前端包管理器（前端项目）**
   ```bash
   if [ -f "package.json" ]; then
     if [ -f "pnpm-lock.yaml" ]; then
       DETECTED_PM="pnpm"
     elif [ -f "yarn.lock" ]; then
       DETECTED_PM="yarn"
     else
       DETECTED_PM="npm"
     fi
     $DETECTED_PM --version 2>/dev/null
   fi
   ```
   - 根据 lock 文件自动选择包管理器
   - 对应包管理器不可用 → ⚠️ 警告

**检测结果展示模板：**
```
[步骤 0/7] 环境检测

Node.js:  ✅ v20.11.0（满足 >= 18.0.0）
npm:      ✅ v10.2.4
Git:      ✅ v2.43.0（仓库：blog-vue-springboot）
Java:     ✅ OpenJDK 1.8.0_402（Maven 3.9.6）
包管理器:  ✅ pnpm v8.15.0

✅ 环境检测通过，可以继续安装
```

**错误处理：**
- Node.js 缺失/版本过低 → 致命错误，终止，输出安装引导
- Git 缺失 → 致命错误，终止
- Java/Maven 缺失 → 警告，不终止但标记后续编译步骤不可用
- 前端包管理器缺失 → 警告，不终止

---

### 步骤一：安装 openspec + GitNexus

**目标：** 安装 openspec（需求开发工作流引擎）和 GitNexus（代码智能层），两者都是 npm 全局包

**前置条件：** 步骤零环境检测通过（Node.js >= 18）

**⚠️ 重要：所有命令在当前工作目录执行，不要使用 `cd` 切换目录**

**执行逻辑：**

1. **检测 openspec 是否已安装**
   ```bash
   which openspec && openspec --version
   ```
   - 已安装且可用 → 输出版本号，跳过 openspec 安装
   - 未安装 → 继续安装流程

2. **检测 GitNexus 是否已安装**
   ```bash
   which gitnexus && gitnexus --version
   ```
   - 已安装且可用 → 输出版本号，跳过 GitNexus 安装
   - 未安装 → 继续安装流程

3. **安装 openspec（npm 全局安装）**
   ```bash
   npm install -g @fission-ai/openspec@latest
   ```

   安装失败处理：
   | 失败类型 | 解决方案 |
   |---------|---------|
   | 权限错误（EACCES） | `sudo npm install -g @fission-ai/openspec@latest` |
   | 网络超时 | 添加 `--registry=https://registry.npmmirror.com` 重试 |

4. **安装 GitNexus（npm 全局安装）**
   ```bash
   npm install -g gitnexus@latest
   ```

   安装失败处理：
   | 失败类型 | 解决方案 |
   |---------|---------|
   | 权限错误（EACCES） | `sudo npm install -g gitnexus@latest` |
   | Node.js 版本 < 18 | 回到步骤零升级 Node.js（GitNexus 硬性要求 >= 18） |
   | 网络超时 | 添加 `--registry=https://registry.npmmirror.com` 重试 |

5. **验证安装**
   ```bash
   openspec --version
   gitnexus --version
   ```

6. **初始化 openspec**

   执行 openspec init 配置当前 AI 工具：

   **关键约束：只执行一次，只针对当前 `$TOOL`，绝对不使用 `--tools all`，否则会同时为多个工具生成目录。**
   ```bash
   case "$TOOL" in
     "Codex")    openspec init --tools Codex --force ;;
     "codebuddy") openspec init --tools codebuddy --force ;;
     "qoder")     openspec init --tools qoder --force ;;
     "trae")      openspec init --tools trae --force ;;
     "cursor")    openspec init --tools cursor --force ;;
     "windsurf")  openspec init --tools windsurf --force ;;
     "cline")     openspec init --tools cline --force ;;
   esac
   ```

   **实测验证（openspec v1.3.1）：** `--tools codebuddy` 会正确生成 `.codebuddy/` 目录和 skills/commands，`--tools Codex` 会正确生成 `.Codex/` 目录。openspec **不会**在根目录生成 `AGENTS.md` 或 `CODEBUDDY.md` 等知识库文件——那些是 `gitnexus analyze` 和手动操作产生的。

   ```bash
   # 确定目标知识库文件名（供后续步骤使用，$KB_FILE 已在步骤二设置，此处无需重复）
   ```

7. **注册 GitNexus MCP Server（项目级 + 全局兜底）**

   GitNexus 必须写入项目级 `.mcp.json`，这样 Codex、CodeBuddy、Cursor、Windsurf 等工具都能随项目共享同一 MCP 配置；`gitnexus setup` 只作为全局兜底，不替代项目级写入。

   **首选方式 — 项目级 `.mcp.json`（编辑器通用，推荐）：**
   ```bash
   if [ -f ".mcp.json" ]; then
     if grep -q '"gitnexus"' .mcp.json; then
       echo "✓ GitNexus MCP Server 已存在于 .mcp.json，跳过注册"
     elif command -v jq &> /dev/null; then
       jq '.mcpServers = (.mcpServers // {}) | .mcpServers += {"gitnexus": {"command": "npx", "args": ["-y", "gitnexus@latest", "mcp"]}}' .mcp.json > .mcp.json.tmp
       mv .mcp.json.tmp .mcp.json
       echo "✓ GitNexus MCP Server 已追加到 .mcp.json"
     else
       echo "⚠️  jq 未安装，请手动添加以下配置到 .mcp.json："
       echo '  "gitnexus": {"command": "npx", "args": ["-y", "gitnexus@latest", "mcp"]}'
     fi
   else
     cat > .mcp.json << 'EOF'
   {
     "mcpServers": {
       "gitnexus": {
         "command": "npx",
         "args": ["-y", "gitnexus@latest", "mcp"]
       }
     }
   }
   EOF
     echo "✓ 已创建 .mcp.json 并注册 GitNexus MCP Server"
   fi
   ```

   **全局兜底 — `gitnexus setup`（可选）：**
   ```bash
   gitnexus setup || true
   ```

   `gitnexus setup` 会自动检测当前系统已安装的编辑器（Codex / Cursor / Codex / Windsurf / OpenCode），并将 GitNexus MCP Server 注册到对应的全局 MCP 配置文件中。它用于增强本机可用性，但不能代替项目级 `.mcp.json`。

   **Codex 手动兜底：**
   ```bash
   if command -v Codex &> /dev/null && ! Codex mcp list 2>/dev/null | grep -q "gitnexus"; then
     Codex mcp add gitnexus -- npx -y gitnexus@latest mcp
     echo "✓ GitNexus MCP Server 已注册到 Codex"
   fi
   ```

8. **注册 Context7 MCP Server（实时文档查询）**

   Context7 为 AI 编程助手提供最新第三方库文档查询能力，可获取最新 API 语法、配置示例和版本迁移指南。采用项目级 `.mcp.json` 配置，兼容 Codex、Cursor、Windsurf 等主流编辑器，保证 Agent 通用性。

   **首选方式 — 项目级 `.mcp.json`（编辑器通用，推荐）：**

   ```bash
   # 检查 .mcp.json 是否已存在
   if [ -f ".mcp.json" ]; then
     # 检查是否已包含 context7 配置
     if grep -q "context7" .mcp.json; then
       echo "✓ Context7 MCP Server 已存在于 .mcp.json，跳过注册"
     else
       # 使用 jq 合并 context7 配置
       if command -v jq &> /dev/null; then
         jq '.mcpServers += {"context7": {"command": "npx", "args": ["-y", "@upstash/context7-mcp@latest"]}}' .mcp.json > .mcp.json.tmp
         mv .mcp.json.tmp .mcp.json
         echo "✓ Context7 MCP Server 已追加到 .mcp.json"
       else
         echo "⚠️  jq 未安装，请手动添加以下配置到 .mcp.json："
         echo '  "context7": {"command": "npx", "args": ["-y", "@upstash/context7-mcp@latest"]}'
       fi
     fi
   else
     # 创建新的 .mcp.json（通用项目级 MCP 配置文件）
     cat > .mcp.json << 'EOF'
   {
     "mcpServers": {
       "context7": {
         "command": "npx",
         "args": ["-y", "@upstash/context7-mcp@latest"]
       }
     }
   }
   EOF
     echo "✓ 已创建 .mcp.json 并注册 Context7 MCP Server"
   fi
   ```

   **Context7 功能说明：**
   | 功能 | 说明 |
   |------|------|
   | 实时文档查询 | 获取最新第三方库文档（API、配置、代码示例） |
   | 版本迁移指南 | 支持跨版本 API 变更查询 |
   | 多库覆盖 | 支持 React、Next.js、Tailwind、Prisma、Express 等主流框架/SDK |
   | Agent 通用 | 项目级 `.mcp.json` 配置，Codex / Cursor / Windsurf 均可共用 |

   **其他编辑器手动配置：**
   - **Cursor** (`~/.cursor/mcp.json`)：
     ```json
     {"mcpServers": {"context7": {"command": "npx", "args": ["-y", "@upstash/context7-mcp@latest"]}}}
     ```
   - **Codex** (`~/.codex/config.toml`)：
     ```toml
     [mcp_servers.context7]
     command = "npx"
     args = ["-y", "@upstash/context7-mcp@latest"]
     ```
   - **OpenCode** (`~/.config/opencode/opencode.json`)：
     ```json
     {"mcp": {"context7": {"command": "npx", "args": ["-y", "@upstash/context7-mcp@latest"]}}}
     ```

   **验证注册：**
   ```bash
   # 检查 .mcp.json 内容
   if [ -f ".mcp.json" ]; then
     echo "✓ .mcp.json 存在"
     if command -v jq &> /dev/null; then
       jq '.mcpServers.gitnexus' .mcp.json
       jq '.mcpServers.context7' .mcp.json
     else
       grep -q '"gitnexus"' .mcp.json && echo "✓ gitnexus 已配置" || echo "⚠️ gitnexus 未配置"
       grep -q '"context7"' .mcp.json && echo "✓ context7 已配置" || echo "⚠️ context7 未配置"
     fi
   fi
   ```

9. **建立代码索引（gitnexus analyze）**

   > **关键问题：** `gitnexus analyze` 硬编码将 skills 写入 `.Codex/skills/gitnexus/`、将上下文写入 `AGENTS.md` 和 `AGENTS.md`，不区分当前工具类型。非 Codex 工具**必须使用** `--skip-skills --skip-agents-md` 参数阻止此行为，然后由本 skill 自行将 skills 安装到正确的 `$BASE_DIR/skills/gitnexus/`。

   **执行命令（按工具类型选择）：**

   ```bash
   # Codex 工具：gitnexus analyze 默认行为即可，skills 和 AGENTS.md 写入正确位置
   if [ "$TOOL" = "Codex" ]; then
     gitnexus analyze --skip-embeddings
   else
     # 非 Codex 工具：禁止 gitnexus 写入 .Codex/ 和 AGENTS.md
     gitnexus analyze --skip-embeddings --skip-skills --skip-agents-md
   fi
   ```

   **常用参数：**
   | 参数 | 用途 | 示例 |
   |------|------|------|
   | `--force` | 强制全量重建索引（忽略增量缓存） | `gitnexus analyze --force` |
   | `--skip-skills` | **非 Codex 工具必加** — 跳过安装 skills 到 `.Codex/skills/gitnexus/` | `gitnexus analyze --skip-skills` |
   | `--skip-agents-md` | **非 Codex 工具必加** — 跳过生成 `AGENTS.md` 和 `AGENTS.md` | `gitnexus analyze --skip-agents-md` |
   | `--index-only` | 纯索引模式，跳过所有文件注入 | `gitnexus analyze --index-only` |
   | `--skills` | 基于 Leiden 社区检测生成仓库专属 skill 文件 | `gitnexus analyze --skills` |
   | `--embeddings` | 启用向量嵌入生成（更慢但搜索更精准） | `gitnexus analyze --embeddings` |
   | `--skip-embeddings` | 跳过向量嵌入生成（快速索引） | `gitnexus analyze --skip-embeddings` |
   | `--verbose` | 输出详细日志（含被跳过的文件） | `gitnexus analyze --verbose` |

   **大项目优化建议：**
   - 首次索引建议使用 `--skip-embeddings` 加速（向量嵌入后续可按需补充）
   - 团队协作项目建议将 `.gitnexus/` 加入 `.gitignore`

10. **安装 GitNexus Skills 到正确位置**

   > **根因：** `gitnexus analyze` 的 `installSkillsTo()` 函数硬编码目标为 `.Codex/skills/gitnexus/`，`--skip-skills` 只是跳过安装但无法指定其他目标目录。因此非 Codex 工具需要在步骤 9 跳过自动安装后，手动将 skills 安装到 `$BASE_DIR/skills/gitnexus/`。

   **Codex 工具：** 步骤 9 已自动安装到 `.Codex/skills/gitnexus/`，跳过此步骤。

   **非 Codex 工具 — 手动安装 GitNexus Skills：**

   ```bash
   if [ "$TOOL" != "Codex" ]; then
     # 从 gitnexus npm 包的 skills 目录拷贝到 $BASE_DIR/skills/gitnexus/
     GITNEXUS_SKILLS_SRC="$(npm root -g)/gitnexus/skills"
     TARGET_SKILLS_DIR="$BASE_DIR/skills/gitnexus"

     # 检查 gitnexus skills 源目录是否存在
     if [ -d "$GITNEXUS_SKILLS_SRC" ]; then
       # 如果 $BASE_DIR/skills/gitnexus 已存在（之前的迁移残留），先清理
       if [ -d "$BASE_DIR/skills/gitnexus-exploring" ] || [ -d "$BASE_DIR/skills/gitnexus-debugging" ]; then
         # 旧版安装方式：gitnexus-* 是独立目录，统一移入 gitnexus/ 子目录
         mkdir -p "$TARGET_SKILLS_DIR"
         for old_skill in "$BASE_DIR/skills"/gitnexus-*; do
           [ -d "$old_skill" ] || continue
           skill_name=$(basename "$old_skill")
           if [ ! -d "$TARGET_SKILLS_DIR/$skill_name" ]; then
             mv "$old_skill" "$TARGET_SKILLS_DIR/$skill_name"
             echo "✓ 重组旧版 Skill: $skill_name → $TARGET_SKILLS_DIR/$skill_name"
           fi
         done
       fi

       # 安装 gitnexus 内置 skills（6 个标准 skills）
       mkdir -p "$TARGET_SKILLS_DIR"
       for skill_src in "$GITNEXUS_SKILLS_SRC"/*/; do
         [ -d "$skill_src" ] || continue
         skill_name=$(basename "$skill_src")
         target_dir="$TARGET_SKILLS_DIR/$skill_name"
         if [ ! -d "$target_dir" ]; then
           cp -r "$skill_src" "$target_dir"
           echo "✓ 安装 GitNexus Skill: $skill_name → $target_dir"
         else
           echo "⊘ GitNexus Skill 已存在，跳过: $skill_name"
         fi
       done

       # 处理 flat file 格式的 skills（*.md 单文件）
       for skill_file in "$GITNEXUS_SKILLS_SRC"/*.md; do
         [ -f "$skill_file" ] || continue
         skill_name=$(basename "$skill_file" .md)
         target_dir="$TARGET_SKILLS_DIR/$skill_name"
         if [ ! -d "$target_dir" ]; then
           mkdir -p "$target_dir"
           cp "$skill_file" "$target_dir/SKILL.md"
           echo "✓ 安装 GitNexus Skill (flat): $skill_name → $target_dir/SKILL.md"
         fi
       done
     else
       echo "⚠️  GitNexus skills 源目录不存在: $GITNEXUS_SKILLS_SRC"
       echo "  请确认 gitnexus 已全局安装: npm install -g gitnexus"
     fi
   fi
   ```

   **GitNexus 标准技能列表：**
   | Skill | 用途 |
   |-------|------|
   | `gitnexus-exploring` | 使用知识图谱导航陌生代码库 |
   | `gitnexus-debugging` | 通过调用链路追踪 Bug |
   | `gitnexus-impact-analysis` | 变更前分析影响范围 |
   | `gitnexus-refactoring` | 使用依赖映射规划安全重构 |
   | `gitnexus-guide` | 工具、资源和 schema 参考 |
   | `gitnexus-cli` | 索引、状态、清理、Wiki CLI 命令 |

   **Codex Hooks（仅 Codex 工具自动注册）：**
   - `PreToolUse` — 搜索前自动用图谱上下文丰富查询
   - `PostToolUse` — 提交后自动重建索引
   - 非 Codex 工具无法使用 Codex Hooks 机制

   **仓库专属 Skills（使用 `--skills` 参数时）：**

   `gitnexus analyze --skills` 也会硬编码写入 `.Codex/skills/generated/`。非 Codex 工具需要在执行后迁移：

   ```bash
   # 仅在使用 --skills 参数时需要
   if [ "$TOOL" != "Codex" ] && [ -d ".Codex/skills/generated" ]; then
     mkdir -p "$BASE_DIR/skills/generated"
     if [ ! -d "$BASE_DIR/skills/generated" ] || [ -z "$(find "$BASE_DIR/skills/generated" -name '*.md' 2>/dev/null)" ]; then
       cp -r .Codex/skills/generated/* "$BASE_DIR/skills/generated/" 2>/dev/null
       echo "✓ 迁移仓库专属 Skills: .Codex/skills/generated/ → $BASE_DIR/skills/generated/"
     fi
     rm -rf .Codex/skills/generated
     echo "✓ 清理 .Codex/skills/generated/"
   fi
   ```

11. **验证索引状态**
    ```bash
    gitnexus status
    ```
    - 输出 `up-to-date` → CI_MODE=full ✅（精确符号级分析）
    - 输出 `stale` → CI_MODE=stale ⚠️（索引过期，结果标注"尽力"）
    - 输出错误 → CI_MODE=no ℹ️（降级为 AI 推断模式）

12. **GitNexus 其他运维命令**

    | 命令 | 用途 |
    |------|------|
    | `gitnexus list` | 列出所有已索引的仓库 |
    | `gitnexus clean` | 删除当前仓库的索引 |
    | `gitnexus clean --all --force` | 删除所有仓库的索引 |
    | `gitnexus serve` | 启动本地 HTTP Server，Web UI 可自动检测并浏览所有已索引仓库（Bridge 模式） |
    | `gitnexus wiki [path]` | 从知识图谱生成 LLM 驱动的仓库 Wiki 文档 |

    **多仓库架构说明**：GitNexus 使用全局注册表 `~/.gitnexus/registry.json` 管理所有已索引仓库。一个 MCP Server 可以服务多个仓库，无需按项目配置 MCP。当只有一个已索引仓库时，所有工具 `repo` 参数可选。

13. **生成仓库 Wiki 文档（gitnexus wiki）**

    **前置条件：** `gitnexus analyze` 已完成且索引状态为 `up-to-date`。

    Wiki 生成利用知识图谱数据，通过 LLM 为仓库的每个功能模块生成结构化的文档页面。适合大型项目的架构文档自动生成。

    **基础用法（使用 DeepSeek API）：**
    ```bash
    npx gitnexus wiki --base-url https://api.deepseek.com/v1 --model deepseek-v4-pro
    ```

    **常用参数：**
    | 参数 | 用途 | 示例 |
    |------|------|------|
    | `--base-url` | 指定 LLM API 端点（支持 OpenAI 兼容接口） | `--base-url https://api.deepseek.com/v1` |
    | `--model` | 指定 LLM 模型名称 | `--model deepseek-v4-pro` |
    | `--force` | 强制全量重新生成所有 Wiki 页面（忽略已有缓存） | `gitnexus wiki --force` |
    | `--concurrency` | 调整并发 LLM 调用数（默认 3，避免 API 限流） | `--concurrency 5` |

    **完整命令示例：**
    ```bash
    # 首次生成（使用 DeepSeek API，5 并发加速）
    npx gitnexus wiki --base-url https://api.deepseek.com/v1 --model deepseek-v4-pro --concurrency 5

    # 索引更新后增量生成（仅更新变更模块）
    npx gitnexus wiki --base-url https://api.deepseek.com/v1 --model deepseek-v4-pro

    # 强制全量重新生成
    npx gitnexus wiki --base-url https://api.deepseek.com/v1 --model deepseek-v4-pro --force --concurrency 5
    ```

    **API Key 配置：**
    ```bash
    # 通过环境变量设置 API Key
    export DEEPSEEK_API_KEY="your-api-key"

    # 或在命令前传入
    DEEPSEEK_API_KEY="your-api-key" npx gitnexus wiki --base-url https://api.deepseek.com/v1 --model deepseek-v4-pro
    ```

    **并发数调优建议：**
    | 场景 | 推荐并发数 | 说明 |
    |------|-----------|------|
    | 小型项目（< 50 文件） | 3（默认） | 默认值足够，避免浪费 |
    | 中型项目（50-200 文件） | 5 | 平衡速度与 API 限流 |
    | 大型项目（> 200 文件） | 5-8 | 需确认 API 配额充足 |
    | API 频繁限流 | 2 | 降低并发避免触发限流 |

    **生成内容：**

    Wiki 生成后输出到 `.gitnexus/wiki/` 目录，包含：
    - `README.md` — Wiki 索引页，列出所有模块
    - `architecture.md` — 整体架构概览
    - `module-*.md` — 每个功能模块的详细文档（入口点、数据流、关键符号）
    - `dependencies.md` — 模块间依赖关系图

    **验证生成结果：**
    ```bash
    # 查看 Wiki 目录结构
    ls -la .gitnexus/wiki/

    # 统计生成的页面数
    find .gitnexus/wiki -name "*.md" | wc -l
    ```

14. **配置自定义模板路径**（保持原有逻辑）

    检查项目是否有 `.spec-workflow/templates/` 目录：
    ```bash
    if [ -d ".spec-workflow/templates" ]; then
      echo "✓ 检测到项目自定义模板目录"
      if [ -f "openspec/config.yaml" ]; then
        cp openspec/config.yaml openspec/config.yaml.bak
      fi
      CUSTOM_TEMPLATES=""
      if [ -f ".spec-workflow/templates/design-template.md" ]; then
        CUSTOM_TEMPLATES="${CUSTOM_TEMPLATES}  design: ../.spec-workflow/templates/design-template.md\n"
      fi
      if [ -f ".spec-workflow/templates/tasks-template.md" ]; then
        CUSTOM_TEMPLATES="${CUSTOM_TEMPLATES}  tasks: ../.spec-workflow/templates/tasks-template.md\n"
      fi
      if [ -f ".spec-workflow/templates/requirements-template.md" ]; then
        CUSTOM_TEMPLATES="${CUSTOM_TEMPLATES}  proposal: ../.spec-workflow/templates/requirements-template.md\n"
      fi
      if [ -n "$CUSTOM_TEMPLATES" ]; then
        cat >> openspec/config.yaml << EOF

# 自定义模板配置（由 ivy-tool-setup 自动添加）
templates:
${CUSTOM_TEMPLATES}
EOF
        echo "✓ 已配置自定义模板路径到 openspec/config.yaml"
      fi
    else
      echo "⚠️  未检测到 .spec-workflow/templates/ 目录，使用 openspec 默认模板"
    fi
    ```

**输出示例：**
```
[步骤 1/7] 安装 openspec + GitNexus

✓ openspec 已安装: v1.3.1（跳过安装）
✓ GitNexus 已安装: v1.6.5（跳过安装）
✓ 初始化 openspec (Codex)...
→ 配置 GitNexus MCP Server...
✓ GitNexus MCP Server 已注册（项目级 .mcp.json）
✓ gitnexus setup 全局兜底完成
→ 配置 Context7 MCP Server（实时文档查询）...
✓ Context7 MCP Server 已注册（项目级 .mcp.json）
→ 建立代码索引...
✓ gitnexus analyze
  - 扫描文件: 247 个
  - 索引符号: 1,832 个
  - 检测社区: 12 个功能聚类
  - 索引时间: 12.3s
✓ GitNexus 自动安装内容:
  - 4 个 Agent Skills: gitnexus-exploring, gitnexus-debugging, gitnexus-impact-analysis, gitnexus-refactoring
  - Codex Hooks: PreToolUse + PostToolUse 已注册
✓ gitnexus status: up-to-date → CI_MODE=full
→ 生成 Wiki 文档...
✓ gitnexus wiki --base-url https://api.deepseek.com/v1 --model deepseek-v4-pro --concurrency 5
  - 生成模块文档: 12 页
  - 依赖关系图: 1 页
  - 架构概览: 1 页
  - Wiki 目录: .gitnexus/wiki/
✓ 检测到项目自定义模板目录
✓ 已配置自定义模板路径到 openspec/config.yaml
  - design: ../.spec-workflow/templates/design-template.md
  - tasks: ../.spec-workflow/templates/tasks-template.md
  - proposal: ../.spec-workflow/templates/requirements-template.md
```

---

### 步骤二：初始化项目目录

**目标：** 根据工具类型创建标准目录结构

**⚠️ 重要：在当前工作目录创建 `$BASE_DIR` 目录（`.Codex/`、`.codebuddy/`、`.qoder/` 或 `.trae/`），不要切换到父目录**

**执行逻辑：**

1. **检测当前 AI 工具类型**

   **交互式选择工具：**

   如果用户已指定工具（如提到 "Codex"、"codebuddy"、"qoder"、"trae"、"cursor"、"windsurf"、"cline"），直接使用指定的工具。

   如果用户未指定工具，自动检测当前 IDE 环境：
   ```bash
   # 自动检测逻辑
   if [ -d ".codebuddy" ]; then TOOL="codebuddy"; BASE_DIR=".codebuddy"
   elif [ -d ".Codex" ]; then TOOL="Codex"; BASE_DIR=".Codex"
   elif [ -d ".qoder" ]; then TOOL="qoder"; BASE_DIR=".qoder"
   elif [ -d ".trae" ]; then TOOL="trae"; BASE_DIR=".trae"
   else
     # 无法自动检测，询问用户
     echo "请选择 AI 编程工具："
   fi
   ```

   如果自动检测失败，询问用户选择：

   ```
   请选择 AI 编程工具：
   1) Codex     (.Codex/)
   2) codebuddy  (.codebuddy/)
   3) qoder      (.qoder/)
   4) trae       (.trae/)
   5) cursor     (.cursor/)
   6) windsurf   (.windsurf/)
   7) cline      (.cline/)

   请输入选项 [1]:
   ```

   根据用户选择设置：
   ```bash
   # 用户输入后设置
   case "$choice" in
     1) TOOL="Codex";    BASE_DIR=".Codex";    KB_FILE="AGENTS.md" ;;
     2) TOOL="codebuddy"; BASE_DIR=".codebuddy"; KB_FILE="CODEBUDDY.md" ;;
     3) TOOL="qoder";     BASE_DIR=".qoder";     KB_FILE="QODER.md" ;;
     4) TOOL="trae";      BASE_DIR=".trae";      KB_FILE="TRAE.md" ;;
     5) TOOL="cursor";    BASE_DIR=".cursor";    KB_FILE="CURSOR.md" ;;
     6) TOOL="windsurf";  BASE_DIR=".windsurf";  KB_FILE="WINDSURF.md" ;;
     7) TOOL="cline";     BASE_DIR=".cline";     KB_FILE="CLINE.md" ;;
     *) TOOL="codebuddy"; BASE_DIR=".codebuddy"; KB_FILE="CODEBUDDY.md" ;;
   esac
   ```

2. **创建目录结构**

   所有工具使用统一的目录结构，通过 `$BASE_DIR` 变量动态创建：
   ```bash
   mkdir -p "$BASE_DIR"/{agents,skills,rules,agent-memory}
   ```

3. **验证目录创建**
   ```bash
   for dir in agents skills rules agent-memory; do
     if [ ! -d "$BASE_DIR/$dir" ]; then
       echo "错误：目录创建失败 - $BASE_DIR/$dir"
       exit 1
     fi
   done
   ```

**幂等性保证：**
- 使用 `mkdir -p` 确保目录已存在时不报错
- 检查文件是否存在再创建，避免覆盖

**输出示例：**
```
[步骤 2/7] 初始化项目目录
✓ 检测到工具类型: Codex
✓ 创建目录: .Codex/agents
✓ 创建目录: .Codex/skills
✓ 创建目录: .Codex/rules
✓ 创建目录: .Codex/agent-memory
✓ 目录结构初始化完成
```

---

### 步骤三：创建项目知识库文档

**目标：** 在项目根目录创建知识库主文件（`CODEBUDDY.md` / `AGENTS.md` 等），注入项目上下文和 AI 工具配置说明

> **重要：** `openspec init` 已在步骤一执行，负责生成 `$BASE_DIR/` 目录结构（skills/commands）。`openspec init` 不会生成根目录知识库文件，本步骤负责创建。

**执行逻辑：**

1. **检查是否已存在知识库文档**
   ```bash
   if [ -f "$KB_FILE" ]; then
     echo "⚠️  检测到已存在知识库文档: $KB_FILE，将追加内容"
   fi
   ```

2. **创建知识库主文件**

   知识库文件始终位于**项目根目录**，不是工具目录内。例如 CodeBuddy 模式为 `CODEBUDDY.md`（项目根目录），不是 `.codebuddy/CODEBUDDY.md`。

   ```bash
   # $KB_FILE 已在步骤二设置
   if [ ! -f "$KB_FILE" ]; then
     touch "$KB_FILE"
     echo "✓ 创建知识库文件: $KB_FILE"
   fi
   ```

3. **注入 GitNexus 上下文区块（非 Codex 工具必须）**

   > **原因：** `gitnexus analyze` 使用 `--skip-agents-md` 时不会生成 `AGENTS.md`/`AGENTS.md`，但知识库文件需要包含 GitNexus 使用指引。对于 Codex 工具，gitnexus 自动写入 `AGENTS.md` 即可；对于非 Codex 工具，需要手动向 `$KB_FILE` 注入 GitNexus 区块，**路径必须指向 `$BASE_DIR/skills/`**。

   ```bash
   if [ "$TOOL" != "Codex" ]; then
     # 获取 gitnexus 索引统计（如果索引已建立）
     GN_STATS=""
     if [ -d ".gitnexus" ]; then
       GN_STATS=$(gitnexus status 2>/dev/null | head -3 || echo "")
     fi

     cat >> "$KB_FILE" << GNCTX_EOF

   <!-- gitnexus:start -->
   # GitNexus — Code Intelligence

   This project is indexed by GitNexus as **$(basename $(pwd))**. Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

   > If any GitNexus tool warns the index is stale, run \`npx gitnexus analyze\` in terminal first.

   ## Always Do

   - **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run \`gitnexus_impact({target: "symbolName", direction: "upstream"})\` and report the blast radius to the user.
   - **MUST run \`gitnexus_detect_changes()\` before committing** to verify your changes only affect expected symbols.
   - **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
   - When exploring unfamiliar code, use \`gitnexus_query({query: "concept"})\` to find execution flows.
   - When you need full context on a specific symbol, use \`gitnexus_context({name: "symbolName"})\`.

   ## Never Do

   - NEVER edit a function, class, or method without first running \`gitnexus_impact\` on it.
   - NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
   - NEVER rename symbols with find-and-replace — use \`gitnexus_rename\` which understands the call graph.
   - NEVER commit changes without running \`gitnexus_detect_changes()\` to check affected scope.

   ## Resources

   | Resource | Use for |
   |----------|---------|
   | \`gitnexus://repo/$(basename $(pwd))/context\` | Codebase overview, check index freshness |
   | \`gitnexus://repo/$(basename $(pwd))/clusters\` | All functional areas |
   | \`gitnexus://repo/$(basename $(pwd))/processes\` | All execution flows |

   ## CLI

   | Task | Read this skill file |
   |------|---------------------|
   | Understand architecture | \`$BASE_DIR/skills/gitnexus/gitnexus-exploring/SKILL.md\` |
   | Blast radius analysis | \`$BASE_DIR/skills/gitnexus/gitnexus-impact-analysis/SKILL.md\` |
   | Trace bugs | \`$BASE_DIR/skills/gitnexus/gitnexus-debugging/SKILL.md\` |
   | Rename / refactor | \`$BASE_DIR/skills/gitnexus/gitnexus-refactoring/SKILL.md\` |
   | Tools & schema reference | \`$BASE_DIR/skills/gitnexus/gitnexus-guide/SKILL.md\` |
   | Index, status, wiki CLI | \`$BASE_DIR/skills/gitnexus/gitnexus-cli/SKILL.md\` |

   <!-- gitnexus:end -->
   GNCTX_EOF
     echo "✓ GitNexus 上下文区块已注入到 $KB_FILE（路径指向 $BASE_DIR/skills/）"
   else
     echo "⊘ Codex 工具跳过（gitnexus 自动生成 AGENTS.md）"
   fi
   ```

3. **注入项目上下文（根据技术栈动态选择）**

   读取步骤四检测到的技术栈信息，根据项目类型注入不同的上下文：

   ```bash
   # 检测技术栈类型
   HAS_JAVA=false; HAS_FRONTEND=false; HAS_TYPESCRIPT=false; HAS_GO=false; HAS_PYTHON=false
   [ -f "pom.xml" ] || [ -f "build.gradle" ] && HAS_JAVA=true
   [ -f "package.json" ] && HAS_FRONTEND=true
   [ -f "tsconfig.json" ] && HAS_TYPESCRIPT=true
   [ -f "go.mod" ] && HAS_GO=true
   [ -f "requirements.txt" ] || [ -f "pyproject.toml" ] && HAS_PYTHON=true
   ```

   **通用上下文（所有项目都注入）：**
   ```bash
   cat >> "$KB_FILE" << 'UNIVERSAL_EOF'

   ## 项目特定配置

   **编码规范：**
   - 缩进：按项目 .editorconfig 或 .prettierrc 配置
   - 命名：camelCase (变量/方法)、PascalCase (类/接口/组件)
   - 模块化：单一职责，每个文件一个核心类/模块
   UNIVERSAL_EOF
   ```

   **Java/Spring Boot 上下文（仅 Java 项目注入）：**
   ```bash
   if [ "$HAS_JAVA" = true ]; then
     # 推断包名
     JAVA_PACKAGE=$(find . -path "*/src/main/java" -name "*.java" -type f 2>/dev/null \
       | head -1 | xargs grep -oP 'package\s+\K[^;]+' 2>/dev/null | cut -d. -f1-3)
     [ -z "$JAVA_PACKAGE" ] && JAVA_PACKAGE="com.example"

     cat >> "$KB_FILE" << JAVA_EOF

     **Java 后端配置：**
     - 包结构：${JAVA_PACKAGE}.controller/、service/、mapper/、entity/、dto/
     - 编码规范：Alibaba Java 开发手册 / Google Java Style Guide
     - 缩进：4 空格
     - Service 方法使用动词开头（create、update、delete、get、list、find）
     - Controller 统一使用 \`/api/\` 前缀
     - API 响应统一使用 \`ApiResponse<T>\` 包装
     - 异常处理：使用全局异常处理器
     JAVA_EOF
   fi
   ```

   **TypeScript/前端 上下文（仅前端/TS 项目注入）：**
   ```bash
   if [ "$HAS_TYPESCRIPT" = true ] || [ "$HAS_FRONTEND" = true ]; then
     cat >> "$KB_FILE" << TS_EOF

     **TypeScript/前端配置：**
     - 编码规范：Airbnb JavaScript/TypeScript Style Guide
     - 缩进：2 空格
     - 组件文件名使用 PascalCase
     - 类型安全：严格 TypeScript 模式，避免 \`any\`
     - API 调用统一通过 \`src/api/\` 模块
     - 状态管理按项目实际选择（Pinia/Vuex/Zustand/等）
     TS_EOF
   fi
   ```

   **Go 上下文（仅 Go 项目注入）：**
   ```bash
   if [ "$HAS_GO" = true ]; then
     cat >> "$KB_FILE" << GO_EOF

     **Go 配置：**
     - 编码规范：Effective Go / Go Code Review Comments
     - 缩进：gofmt 标准（Tab）
     - 项目布局遵循 golang-standards/project-layout
     GO_EOF
   fi
   ```

   **Python 上下文（仅 Python 项目注入）：**
   ```bash
   if [ "$HAS_PYTHON" = true ]; then
     cat >> "$KB_FILE" << PY_EOF

     **Python 配置：**
     - 编码规范：PEP 8 / Black formatter
     - 缩进：4 空格
     - 类型注解：Python 3.10+ style（使用 `X | Y` 替代 `Union[X, Y]`）
     PY_EOF
   fi
   ```

4. **追加 AI 工具增强配置说明**

   根据步骤四实际部署的 Agents 和 Skills 列表动态生成（而非硬编码）：

   ```bash
   # 获取实际部署的 agents
   DEPLOYED_AGENTS=()
   if [ -d "$BASE_DIR/agents" ]; then
     DEPLOYED_AGENTS=($(ls "$BASE_DIR/agents/"*.md 2>/dev/null | xargs -I{} basename {} .md))
   fi

   # 获取实际部署的 skills
   DEPLOYED_SKILLS=()
   if [ -d "$BASE_DIR/skills" ]; then
     DEPLOYED_SKILLS=($(ls -d "$BASE_DIR/skills"/*/ 2>/dev/null | xargs -I{} basename {}))
   fi

   # 追加增强配置
   cat >> "$KB_FILE" << 'ENHANCE_EOF'

   ## AI 工具增强配置

   本项目已配置 AI 编程工具增强，包括专业 Agents、开发 Skills 和编码 Rules。

   ### 专业 Agents

   项目配置了以下专业 agents，在开发过程中会根据任务自动激活：
   ENHANCE_EOF

   for agent in "${DEPLOYED_AGENTS[@]}"; do
     echo "   - **${agent}**" >> "$KB_FILE"
   done

   cat >> "$KB_FILE" << 'ENHANCE_EOF2'

   ### 开发 Skills

   ENHANCE_EOF2

   for skill in "${DEPLOYED_SKILLS[@]}"; do
     echo "   - **${skill}**" >> "$KB_FILE"
   done

   cat >> "$KB_FILE" << 'ENHANCE_EOF3'

   ### 编码 Rules

   项目配置了针对当前技术栈的编码规范，AI 在编写代码时会自动遵守。

   ### 使用方式

   1. **自动激活**：AI 根据任务类型自动选择合适的 agent
   2. **手动调用**：明确要求使用特定 agent
   3. **规范遵守**：所有生成的代码自动遵守配置的 rules
   4. **技能参考**：需要时可以要求参考特定 skill
   ENHANCE_EOF3
   ```

5. **清理非目标工具的遗留知识库文件**

   确保只保留当前工具的知识库主文件，删除其他工具的文件，避免 AI 工具混淆。
   ```bash
   ALL_KB_FILES=("AGENTS.md" "CODEBUDDY.md" "QODER.md" "TRAE.md" "CURSOR.md" "WINDSURF.md" "CLINE.md" "AGENTS.md")

   for kb in "${ALL_KB_FILES[@]}"; do
     if [ "$kb" != "$KB_FILE" ] && [ -f "$kb" ]; then
       rm "$kb"
       echo "✓ 清理遗留文件: $kb"
     fi
   done
   ```

**错误处理：**
- 如果 `openspec init` 命令不存在，提示用户手动创建文档
- 如果文档生成失败，提供模板文件供用户填写

**输出示例：**
```
[步骤 3/7] 创建项目知识库文档
✓ 执行 /init 命令...
✓ 生成文档: PROJECT.md
✓ 生成文档: ARCHITECTURE.md
✓ 生成文档: TECH_STACK.md
✓ 生成文档: CONVENTIONS.md
✓ 知识库文档创建完成
```

---

### 步骤四：创建 Agent 文件

**目标：** 根据项目技术栈，部署匹配的专业 agent 到 `$BASE_DIR/agents/` 目录

**可用 Agent 模板：**

| Agent 模板 | 适用技术栈 | 说明 |
|-----------|-----------|------|
| `frontend-agent.md` | Vue/React 前端 | 前端开发专家 |
| `typescript-reviewer.md` | TypeScript 项目 | TypeScript 代码审查专家 |
| `spring-agent.md` | Spring Boot 后端 | Spring Boot 后端架构师 |
| `java-reviewer.md` | Java 后端 | Java 代码审查专家 |
| `java-build-resolver.md` | Java/Maven/Gradle | Java 构建问题解决专家 |
| `go-agent.md` | Go 项目 | Go 开发专家 |
| `python-agent.md` | Python 项目 | Python 开发专家 |
| `node-agent.md` | Node.js 后端 | Node.js 后端开发专家 |
| `react-agent.md` | React 前端 | React 开发专家 |

**执行逻辑：**

1. **检测项目技术栈**

   ```bash
   HAS_JAVA=false; HAS_FRONTEND=false; HAS_TYPESCRIPT=false; HAS_GO=false; HAS_PYTHON=false; HAS_NODE=false; HAS_REACT=false
   [ -f "pom.xml" ] || [ -f "build.gradle" ] && HAS_JAVA=true
   [ -f "package.json" ] && HAS_FRONTEND=true
   [ -f "tsconfig.json" ] && HAS_TYPESCRIPT=true
   [ -f "go.mod" ] && HAS_GO=true
   [ -f "requirements.txt" ] || [ -f "pyproject.toml" ] && HAS_PYTHON=true
   # Node.js 后端（无前端框架）
   if [ "$HAS_FRONTEND" = true ] && [ "$HAS_TYPESCRIPT" = false ] && ! grep -qE '"vue"|"react"|"angular"' package.json 2>/dev/null; then
     HAS_NODE=true
   fi
   # React 项目
   grep -q '"react"' package.json 2>/dev/null && HAS_REACT=true
   ```

2. **根据技术栈选择 Agent 模板**

   | 技术栈 | 部署的 Agents |
   |--------|--------------|
   | Spring Boot 后端 | spring-agent, java-reviewer, java-build-resolver |
   | Vue/React 前端 | frontend-agent, typescript-reviewer |
   | React 前端 | react-agent, typescript-reviewer |
   | TypeScript/Node.js | typescript-reviewer, node-agent |
   | Go 项目 | go-agent |
   | Python 项目 | python-agent |
   | 全栈（前端+Java后端） | 合并前端和后端的 agents |

   ```bash
   SELECTED_AGENTS=()

   # 通用：TypeScript 项目始终部署 typescript-reviewer
   if [ "$HAS_TYPESCRIPT" = true ]; then
     SELECTED_AGENTS+=("typescript-reviewer")
   fi

   # Java/Spring Boot
   if [ "$HAS_JAVA" = true ]; then
     SELECTED_AGENTS+=("spring-agent" "java-reviewer" "java-build-resolver")
   fi

   # 前端（Vue/Angular，非 React）
   if [ "$HAS_FRONTEND" = true ] && [ "$HAS_REACT" = false ]; then
     SELECTED_AGENTS+=("frontend-agent")
   fi

   # React
   if [ "$HAS_REACT" = true ]; then
     SELECTED_AGENTS+=("react-agent")
   fi

   # Node.js 后端（纯 Node，无前端框架）
   if [ "$HAS_NODE" = true ]; then
     SELECTED_AGENTS+=("node-agent")
   fi

   # Go
   if [ "$HAS_GO" = true ]; then
     SELECTED_AGENTS+=("go-agent")
   fi

   # Python
   if [ "$HAS_PYTHON" = true ]; then
     SELECTED_AGENTS+=("python-agent")
   fi

   # 去重
   SELECTED_AGENTS=($(echo "${SELECTED_AGENTS[@]}" | tr ' ' '\n' | sort -u | tr '\n' ' '))
   ```

3. **拷贝 Agent 模板文件**

   从 skill 的 `templates/` 目录拷贝到项目的 `agents/` 目录：
   ```bash
   SKILL_DIR="$BASE_DIR/skills/ivy-tool-setup"

   for agent in "${SELECTED_AGENTS[@]}"; do
     if [ -f "$SKILL_DIR/templates/${agent}.md" ]; then
       # 跳过已存在的 agent
       if [ -f "$BASE_DIR/agents/${agent}.md" ]; then
         echo "⊘ Agent 已存在，跳过: ${agent}.md"
         continue
       fi
       cp "$SKILL_DIR/templates/${agent}.md" "$BASE_DIR/agents/${agent}.md"
       echo "✓ 部署 Agent: ${agent}.md"
     else
       echo "⚠️  Agent 模板不存在: ${agent}.md（跳过）"
     fi
   done
   ```

4. **自定义 Agent 配置**

   替换模板中的通用占位符：
   ```bash
   # 替换项目名称
   sed -i "s/{{PROJECT_NAME}}/$(basename $(pwd))/g" "$BASE_DIR/agents/"*.md 2>/dev/null

   # 替换工具目录（Agent Memory 路径）
   sed -i "s|{{TOOL_DIR}}|$BASE_DIR|g" "$BASE_DIR/agents/"*.md 2>/dev/null
   ```

5. **创建 Agent Memory 目录**

   为每个已部署的 agent 创建独立的持久化记忆目录：
   ```bash
   for agent in "${SELECTED_AGENTS[@]}"; do
     if [ -f "$BASE_DIR/agents/${agent}.md" ]; then
       mkdir -p "$BASE_DIR/agent-memory/$agent"
       echo "✓ 创建 Memory 目录: $BASE_DIR/agent-memory/$agent"
     fi
   done
   ```

**幂等性保证：**
- 检查 agent 文件是否已存在
- 如果存在，询问是否覆盖或跳过

**输出示例：**
```
[步骤 4/7] 创建 Agent 文件
✓ 检测技术栈: Vue3 + Spring Boot (全栈项目)
✓ 部署 Agent: frontend-agent.md
✓ 部署 Agent: spring-agent.md
✓ 部署 Agent: java-build-resolver.md
✓ 部署 Agent: java-reviewer.md
✓ 部署 Agent: typescript-reviewer.md
✓ 替换模板占位符
✓ 创建 Memory 目录: .Codex/agent-memory/frontend-agent
✓ 创建 Memory 目录: .Codex/agent-memory/spring-agent
✓ 创建 Memory 目录: .Codex/agent-memory/java-build-resolver
✓ 创建 Memory 目录: .Codex/agent-memory/java-reviewer
✓ 创建 Memory 目录: .Codex/agent-memory/typescript-reviewer
✓ 共部署 5 个 Agent
```

---

### 步骤五：生成 Wiki 文档

**目标：** 使用 GitNexus 知识图谱生成仓库架构 Wiki 文档

**前置条件：**
- GitNexus 已安装且索引状态为 `up-to-date`（步骤一已完成）
- DeepSeek API Key 已配置（环境变量 `DEEPSEEK_API_KEY`）

**执行逻辑：**

1. **检查前置条件**
   ```bash
   # 检查 GitNexus 索引状态
   gitnexus status 2>/dev/null
   ```
   - 输出 `up-to-date` → ✅ 继续
   - 输出 `stale` → ⚠️ 先执行 `gitnexus analyze` 更新索引
   - 输出错误/未安装 → ❌ 返回步骤一安装 GitNexus

2. **检查 API Key 配置**
   ```bash
   if [ -z "$DEEPSEEK_API_KEY" ]; then
     echo "⚠️  未检测到 DEEPSEEK_API_KEY 环境变量"
     echo "请设置：export DEEPSEEK_API_KEY=\"your-api-key\""
     echo "获取 API Key: https://platform.deepseek.com/api_keys"
     exit 1
   fi
   ```

3. **检测项目规模以推荐并发数**
   ```bash
   FILE_COUNT=$(gitnexus analyze --dry-run 2>/dev/null | grep "扫描文件" | grep -oE '[0-9]+' || echo "0")

   if [ "$FILE_COUNT" -lt 50 ]; then
     CONCURRENCY=3
   elif [ "$FILE_COUNT" -lt 200 ]; then
     CONCURRENCY=5
   else
     CONCURRENCY=8
   fi
   echo "项目规模: ${FILE_COUNT} 文件，推荐并发数: ${CONCURRENCY}"
   ```

4. **检查是否已存在 Wiki（幂等性）**
   ```bash
   if [ -d ".gitnexus/wiki" ] && [ "$(find .gitnexus/wiki -name '*.md' | wc -l)" -gt 0 ]; then
     echo "⚠️  检测到已存在 Wiki 文档（$(find .gitnexus/wiki -name '*.md' | wc -l) 页）"
     echo "  - 增量更新（推荐）: 跳过此提示，仅更新变更模块"
     echo "  - 全量重新生成: 使用 --force 参数"
   fi
   ```

5. **执行 Wiki 生成**
   ```bash
   npx gitnexus wiki \
     --base-url https://api.deepseek.com/v1 \
     --model deepseek-v4-pro \
     --concurrency ${CONCURRENCY:-5}
   ```

6. **验证生成结果**
   ```bash
   if [ -d ".gitnexus/wiki" ]; then
     PAGE_COUNT=$(find .gitnexus/wiki -name "*.md" | wc -l | tr -d ' ')
     echo "✓ Wiki 文档生成完成: ${PAGE_COUNT} 页"
     echo "✓ Wiki 目录: .gitnexus/wiki/"
     echo ""
     echo "生成内容:"
     find .gitnexus/wiki -name "*.md" | sort | while read f; do
       echo "  - $(basename "$f")"
     done
   else
     echo "❌ Wiki 生成失败，请检查 API Key 和网络连接"
     exit 1
   fi
   ```

7. **生成失败处理**

   | 失败类型 | 原因 | 解决方案 |
   |---------|------|---------|
   | `401 Unauthorized` | API Key 无效或过期 | 检查 `DEEPSEEK_API_KEY` 是否正确 |
   | `429 Too Many Requests` | API 限流 | 降低 `--concurrency` 至 2-3 |
   | `Connection refused` | 网络问题 / API 端点不可用 | 检查网络，确认 `--base-url` 正确 |
   | `Index not found` | 索引未建立或已损坏 | 执行 `gitnexus analyze --force` 重建索引 |
   | 生成内容为空 | LLM 模型不可用 | 尝试更换 `--model` 参数 |

**输出示例：**
```
[步骤 5/7] 生成 Wiki 文档

→ 检查前置条件...
✓ gitnexus status: up-to-date
✓ DEEPSEEK_API_KEY 已配置
→ 检测项目规模...
  项目规模: 247 文件，推荐并发数: 5
→ 执行 Wiki 生成...
✓ gitnexus wiki --base-url https://api.deepseek.com/v1 --model deepseek-v4-pro --concurrency 5
  - 生成模块文档: 12 页
  - 架构概览: 1 页
  - 依赖关系图: 1 页
  - 耗时: 45.2s
✓ Wiki 文档生成完成: 14 页
✓ Wiki 目录: .gitnexus/wiki/
```

---

### 步骤六：迁移并优化 Skills

**目标：** 从其他 AI 工具目录筛选、拷贝并优化 skills 到当前工具目录

**执行逻辑：**

1. **检测源工具目录**
   ```bash
   # 检测源工具目录（优先级：codebuddy > Codex > cursor > windsurf > qoder > trae > cline）
   SOURCE_TOOL_DIR=""
   for tool_dir in ".codebuddy" ".Codex" ".cursor" ".windsurf" ".qoder" ".trae" ".cline"; do
     if [ -d "$tool_dir/skills" ] && [ "$tool_dir" != "$BASE_DIR" ]; then
       SOURCE_TOOL_DIR="$tool_dir"
       break
     fi
   done

   if [ -z "$SOURCE_TOOL_DIR" ]; then
     echo "⚠️  未找到可迁移的源工具目录，跳过 skills 迁移"
     exit 0
   fi

   echo "✓ 检测到源工具目录: $SOURCE_TOOL_DIR"
   echo "✓ 目标工具目录: $BASE_DIR"
   ```

2. **筛选并拷贝到目标目录**

**可用 Skills 列表（按技术栈分类）：**

| Skill | 适用技术栈 | 说明 |
|-------|-----------|------|
| `security-review` | 通用 | 安全审查清单和模式 |
| `dev-process` | 通用 | 开发流程规范 |
| `code-reviewer` | 通用 | 代码审查流程 |
| `playwright-best-practices` | **前端/全栈/Web 项目** | Playwright E2E 测试最佳实践（选择器、等待、断言、POM、CI/CD、Flaky 修复）。检测到前端框架、已有 E2E 配置或 `e2e/` 目录时自动安装 |
| `springboot-patterns` | Spring Boot | Spring Boot 架构模式和最佳实践 |
| `api-design` | 后端 API | REST API 设计规范 |
| `frontend-patterns` | Vue/React | 前端开发模式 |

2. **筛选并拷贝到目标目录**

   **筛选逻辑（按技术栈动态选择）：**

   ```bash
   SELECTED_SKILLS=()

   # 通用 skills（始终包含）
   for skill in "security-review" "dev-process" "code-reviewer"; do
     if [ -d "$SOURCE_TOOL_DIR/skills/$skill" ]; then
       SELECTED_SKILLS+=("$skill")
     fi
   done

   # 前端/全栈/Web 项目 → playwright-best-practices（E2E 测试知识库）
   NEEDS_E2E=false
   if [ -f "package.json" ] && grep -qE '"vue"|"react"|"angular"|"playwright"|"cypress"' package.json 2>/dev/null; then
     NEEDS_E2E=true
   fi
   if [ -f "playwright.config.js" ] || [ -f "playwright.config.ts" ] || [ -f "cypress.config.js" ] || [ -f "cypress.config.ts" ]; then
     NEEDS_E2E=true
   fi
   if [ -d "e2e" ] || [ -d "tests/e2e" ] || [ -d "cypress" ]; then
     NEEDS_E2E=true
   fi
   if [ "$NEEDS_E2E" = true ] && [ -d "$SOURCE_TOOL_DIR/skills/playwright-best-practices" ]; then
     SELECTED_SKILLS+=("playwright-best-practices")
   fi

   # Spring Boot → springboot-patterns + api-design
   if [ -f "pom.xml" ] && grep -q "spring-boot" "pom.xml" 2>/dev/null; then
     for skill in "springboot-patterns" "api-design"; do
       if [ -d "$SOURCE_TOOL_DIR/skills/$skill" ]; then
         SELECTED_SKILLS+=("$skill")
       fi
     done
   fi

   # 前端框架 → frontend-patterns
   if [ -f "package.json" ] && grep -qE '"vue"|"react"|"angular"' package.json 2>/dev/null; then
     if [ -d "$SOURCE_TOOL_DIR/skills/frontend-patterns" ]; then
       SELECTED_SKILLS+=("frontend-patterns")
     fi
   fi

   # 去重
   SELECTED_SKILLS=($(echo "${SELECTED_SKILLS[@]}" | tr ' ' '\n' | sort -u | tr '\n' ' '))

   for skill in "${SELECTED_SKILLS[@]}"; do
     SOURCE="$SOURCE_TOOL_DIR/skills/$skill"
     TARGET="$BASE_DIR/skills/$skill"

     if [ -d "$SOURCE" ]; then
       # 跳过目标已存在的 skill
       if [ -d "$TARGET" ]; then
         echo "⊘ Skill 已存在，跳过: $skill"
         continue
       fi

       # 拷贝到目标目录
       cp -r "$SOURCE" "$TARGET"
       echo "✓ 拷贝 Skill: $skill (从 $SOURCE_TOOL_DIR)"
     else
       echo "⚠️  未找到 Skill: $skill（跳过）"
     fi
   done
   ```

**优化脚本：**

```bash
for skill in "${TARGET_SKILLS[@]}"; do
  SKILL_DIR="$BASE_DIR/skills/$skill"

  if [ -d "$SKILL_DIR" ]; then
    echo "→ 优化 Skill: $skill"
    bash scripts/optimize-skill.sh "$SKILL_DIR"
  fi
done
```

**优化内容（optimize-skill.sh）：**

1. **更新版本号**
   ```bash
   # 更新 frontmatter 中的版本号
   sed -i 's/version: .*/version: 2.0.0/' "$SKILL_DIR/SKILL.md"
   ```

2. **替换工具名称**
   ```bash
   # 将 Codex 替换为当前工具名称
   find "$SKILL_DIR" -type f -name "*.md" -exec sed -i "s/Codex/$TOOL_NAME/g" {} \;
   ```

3. **更新依赖路径**
   ```bash
   # 更新相对路径引用
   sed -i "s|\.Codex/|$BASE_DIR/|g" "$SKILL_DIR"/*.md
   ```

4. **检查依赖完整性**
   ```bash
   # 检查 skill 引用的其他 skills 是否存在
   grep -oP '(?<=\[)[^\]]+(?=\]\([^)]+\.md\))' "$SKILL_DIR/SKILL.md" | while read -r dep; do
     if [ ! -f "$BASE_DIR/skills/$dep/SKILL.md" ]; then
       echo "⚠️  缺少依赖 Skill: $dep"
     fi
   done
   ```

5. **格式化文档**
   ```bash
   # 统一 Markdown 格式
   prettier --write "$SKILL_DIR/*.md" 2>/dev/null || true
   ```

**输出示例：**
```
[步骤 6/7] 迁移并优化 Skills

✓ 拷贝 Skill: springboot-patterns
✓ 拷贝 Skill: dev-process
✓ 拷贝 Skill: code-reviewer
✓ 拷贝 Skill: security-review
✓ 拷贝 Skill: api-design

→ 优化 Skill: springboot-patterns
  ✓ 更新版本号
  ✓ 替换工具名称: Codex → Codex
  ✓ 替换Java包名
  ✓ 更新依赖路径
  ✓ 检查依赖完整性
→ 优化 Skill: dev-process
  ✓ 更新版本号
  ✓ 替换工具名称: Codex → Codex
→ 优化 Skill: code-reviewer
  ✓ 更新版本号
  ✓ 替换工具名称: Codex → Codex
→ 优化 Skill: security-review
  ✓ 更新版本号
  ✓ 替换工具名称: Codex → Codex
→ 优化 Skill: api-design
  ✓ 更新版本号
  ✓ 替换工具名称: Codex → Codex

✓ 共迁移并优化 5 个 Skills
```

---

### 步骤七：迁移并优化 Rules

**目标：** 从其他 AI 工具目录筛选、拷贝并优化 rules 到当前工具目录

**执行逻辑：**

1. **检测源工具目录**
   ```bash
   # 检测源工具目录（优先级：codebuddy > Codex > cursor > windsurf > qoder > trae > cline）
   SOURCE_TOOL_DIR=""
   for tool_dir in ".codebuddy" ".Codex" ".cursor" ".windsurf" ".qoder" ".trae" ".cline"; do
     if [ -d "$tool_dir/rules" ] && [ "$tool_dir" != "$BASE_DIR" ]; then
       SOURCE_TOOL_DIR="$tool_dir"
       break
     fi
   done

   if [ -z "$SOURCE_TOOL_DIR" ]; then
     echo "⚠️  未找到可迁移的源工具目录，跳过 rules 迁移"
     exit 0
   fi

   echo "✓ 检测到源工具目录: $SOURCE_TOOL_DIR"
   echo "✓ 目标工具目录: $BASE_DIR"
   ```

2. **筛选并拷贝到目标目录**

   **筛选逻辑（基于技术栈精确匹配）：**

   ```bash
   SELECTED_RULES=()

   # Java / Spring Boot 规则
   if [ -f "pom.xml" ] && grep -q "spring-boot" "pom.xml"; then
     for rule in "java.md" \
                 "spring-boot-rest-api-rules.md" \
                 "spring-boot-spring-boot-configuration.md" \
                 "java-controller-conventions.md" \
                 "java-service-conventions.md" \
                 "java-entity-conventions.md" \
                 "java-dto-conventions.md" \
                 "java-apiresponse-conventions.md" \
                 "java-global-exception-handler.md"; do
       if [ -f "$SOURCE_TOOL_DIR/rules/$rule" ]; then
         SELECTED_RULES+=("$rule")
       fi
     done
   fi

   # TypeScript / Vue / React 规则
   if [ -f "package.json" ] && grep -qE '"vue"|"react"|"angular"' package.json 2>/dev/null; then
     for rule in "typescript.md" "vue.md" "vue3.md" "react.md"; do
       if [ -f "$SOURCE_TOOL_DIR/rules/$rule" ]; then
         SELECTED_RULES+=("$rule")
       fi
     done

     # ESLint
     if ls .eslintrc.* 1> /dev/null 2>&1; then
       if [ -f "$SOURCE_TOOL_DIR/rules/eslint.md" ]; then
         SELECTED_RULES+=("eslint.md")
       fi
     fi
   fi

   # 纯 TypeScript / Node.js 规则（无前端框架）
   if [ -f "tsconfig.json" ] && ! grep -qE '"vue"|"react"|"angular"' package.json 2>/dev/null; then
     for rule in "typescript.md"; do
       if [ -f "$SOURCE_TOOL_DIR/rules/$rule" ]; then
         SELECTED_RULES+=("$rule")
       fi
     done
   fi

   # Go 规则
   if [ -f "go.mod" ]; then
     for rule in "go.md"; do
       if [ -f "$SOURCE_TOOL_DIR/rules/$rule" ]; then
         SELECTED_RULES+=("$rule")
       fi
     done
   fi

   # Python 规则
   if [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
     for rule in "python.md"; do
       if [ -f "$SOURCE_TOOL_DIR/rules/$rule" ]; then
         SELECTED_RULES+=("$rule")
       fi
     done
   fi

   # 拷贝选中的 rules
   for rule in "${SELECTED_RULES[@]}"; do
     SOURCE="$SOURCE_TOOL_DIR/rules/$rule"
     TARGET="$BASE_DIR/rules/$rule"

     # 检查目标是否已存在
     if [ -f "$TARGET" ]; then
       echo "⚠️  Rule 已存在: $rule，是否覆盖？[y/N]"
       read -r response
       if [[ ! "$response" =~ ^[Yy]$ ]]; then
         echo "⊘ 跳过: $rule"
         continue
       fi
     fi

     cp "$SOURCE" "$TARGET"
     echo "✓ 拷贝 Rule: $rule (从 $SOURCE_TOOL_DIR)"
   done
   ```

3. **优化目标目录中的文件**

**优化脚本：**

```bash
find "$BASE_DIR/rules" -type f -name "*.md" | while read -r rule_file; do
  echo "→ 优化 Rule: $(basename "$rule_file")"
  bash scripts/optimize-rule.sh "$rule_file"
done
```

**优化内容（optimize-rule.sh）：**

1. **更新版本号**
   ```bash
   # 根据项目实际版本更新（仅更新存在的版本号，避免无关替换）
   if [ "$HAS_JAVA" = true ]; then
     DETECTED_JAVA_VER=$(java -version 2>&1 | grep -oE '[0-9]+' | head -1)
     DETECTED_SPRING_VER=$(grep -oP 'spring-boot-starter-parent.*<version>\K[^<]+' pom.xml 2>/dev/null | head -1)
     [ -n "$DETECTED_JAVA_VER" ] && sed -i "s/Java [0-9]\+/Java ${DETECTED_JAVA_VER}/g" "$RULE_FILE"
     [ -n "$DETECTED_SPRING_VER" ] && sed -i "s/Spring Boot [0-9.]\+/Spring Boot ${DETECTED_SPRING_VER}/g" "$RULE_FILE"
   fi
   if [ "$HAS_FRONTEND" = true ]; then
     DETECTED_VUE_VER=$(grep -oP '"vue":\s*"[\^~]?\K[^"]+' package.json 2>/dev/null | cut -c1 | head -1)
     [ -n "$DETECTED_VUE_VER" ] && sed -i "s/Vue [0-9.]\+/Vue ${DETECTED_VUE_VER}/g" "$RULE_FILE"
   fi
   ```

2. **替换工具路径**
   ```bash
   # 将 .Codex/ 替换为当前工具目录
   sed -i "s|\.Codex/|$BASE_DIR/|g" "$RULE_FILE"
   ```

3. **替换Java包名（仅 Java 项目）**
   ```bash
   if [ "$HAS_JAVA" = true ]; then
     JAVA_PACKAGE=$(find . -path "*/src/main/java" -name "*.java" -type f 2>/dev/null \
       | head -1 | xargs grep -oP 'package\s+\K[^;]+' 2>/dev/null | cut -d. -f1-3)
     [ -z "$JAVA_PACKAGE" ] && JAVA_PACKAGE="com.example"
     sed -i "s/com\.example\./${JAVA_PACKAGE}./g" "$RULE_FILE"
   fi
   ```

4. **更新编码规范**
   ```bash
   # 根据项目技术栈调整编码规范
   if is_java_project; then
     # 添加 Java 特定规范
     append_java_conventions "$RULE_FILE"
   fi

   if is_typescript_project; then
     # 添加 TypeScript 特定规范
     append_typescript_conventions "$RULE_FILE"
   fi
   ```

5. **移除无关规则章节**
   ```bash
   # 精确移除与项目技术栈无关的章节
   # 例如：项目不使用 JPA → 移除 JPA 章节
   # 例如：项目不使用 Vuex → 移除 Vuex 章节
   # 使用 remove_section() 函数精确移除
   ```

6. **添加项目特定规则**
   ```bash
   # 追加项目包结构、命名约定、API 响应格式、错误处理等特定规则
   ```

7. **格式化文档**
   ```bash
   prettier --write "$RULE_FILE" 2>/dev/null || true
   ```

**输出示例：**
```
[步骤 7/7] 迁移并优化 Rules

✓ 拷贝 Rule: java.md
✓ 拷贝 Rule: spring-boot-rest-api-rules.md
✓ 拷贝 Rule: java-controller-conventions.md
✓ 拷贝 Rule: typescript.md
✓ 拷贝 Rule: vue3.md

→ 优化 Rule: java.md
  ✓ 更新技术版本: Java 17
  ✓ 替换工具名称: Codex → Codex
  ✓ 替换Java包名: com.example → com.shimh
  ✓ 添加项目特定规则
→ 优化 Rule: typescript.md
  ✓ 更新技术版本: Vue 3.4
  ✓ 替换工具名称: Codex → Codex
  ✓ 添加项目特定规则

✓ 共迁移并优化 5 个 Rules
```

---

## 技术实现细节

### 工具检测函数

```bash
# 检测当前 AI 工具类型
detect_tool() {
  if [ -n "${TOOL:-}" ]; then
    echo "$TOOL"
  elif [ -n "${AI_TOOL_SETUP_TOOL:-}" ]; then
    echo "$AI_TOOL_SETUP_TOOL"
  elif [ -d ".codebuddy" ]; then
    echo "codebuddy"
  elif [ -d ".Codex" ]; then
    echo "Codex"
  elif [ -d ".qoder" ]; then
    echo "qoder"
  elif [ -d ".trae" ]; then
    echo "trae"
  else
    echo "unknown"
  fi
}

# 检测技术栈
detect_tech_stack() {
  local tech_stack=""

  # 检测前端框架
  if [ -f "package.json" ]; then
    if grep -q '"vue"' package.json; then
      tech_stack="${tech_stack}vue,"
    fi
    if grep -q '"react"' package.json; then
      tech_stack="${tech_stack}react,"
    fi
    if grep -q '"typescript"' package.json; then
      tech_stack="${tech_stack}typescript,"
    fi
  fi

  # 检测后端框架
  if [ -f "pom.xml" ]; then
    tech_stack="${tech_stack}java,maven,"
    if grep -q 'spring-boot' pom.xml; then
      tech_stack="${tech_stack}spring-boot,"
    fi
  fi

  if [ -f "build.gradle" ] || [ -f "build.gradle.kts" ]; then
    tech_stack="${tech_stack}java,gradle,"
  fi

  echo "$tech_stack"
}

# 判断是否应该部署某个 agent
should_deploy_agent() {
  local agent_name="$1"
  local tech_stack=$(detect_tech_stack)

  case "$agent_name" in
    "frontend-agent")
      [[ "$tech_stack" =~ (vue|react|typescript) ]]
      ;;
    "spring-agent")
      [[ "$tech_stack" =~ spring-boot ]]
      ;;
    "java-build-resolver"|"java-reviewer")
      [[ "$tech_stack" =~ java ]]
      ;;
    "typescript-reviewer")
      [[ "$tech_stack" =~ typescript ]]
      ;;
    *)
      return 0  # 默认部署
      ;;
  esac
}
```

### 文件操作函数

```bash
# 安全拷贝文件（带确认）
safe_copy() {
  local source="$1"
  local target="$2"

  if [ ! -e "$source" ]; then
    echo "⚠️  源文件不存在: $source"
    return 1
  fi

  if [ -e "$target" ]; then
    echo "⚠️  目标文件已存在: $target"
    read -p "是否覆盖？[y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "⊘ 跳过: $target"
      return 1
    fi
  fi

  cp -r "$source" "$target"
  echo "✓ 拷贝成功: $target"
}

# 批量拷贝目录
batch_copy() {
  local source_dir="$1"
  local target_dir="$2"

  if [ ! -d "$source_dir" ]; then
    echo "⚠️  源目录不存在: $source_dir"
    return 1
  fi

  mkdir -p "$target_dir"
  cp -r "$source_dir"/* "$target_dir/"
  echo "✓ 批量拷贝完成: $source_dir → $target_dir"
}
```

### 模板引擎

```bash
# 替换模板变量
render_template() {
  local template_file="$1"
  local output_file="$2"

  # 获取项目信息
  local project_name=$(basename "$(pwd)")
  local tool_name=$(detect_tool)
  local tech_stack=$(detect_tech_stack)

  # 替换变量
  sed -e "s/{{PROJECT_NAME}}/$project_name/g" \
      -e "s/{{TOOL_NAME}}/$tool_name/g" \
      -e "s/{{TECH_STACK}}/$tech_stack/g" \
      "$template_file" > "$output_file"

  echo "✓ 模板渲染完成: $output_file"
}
```

---

## 错误处理与回滚

### 错误分类

1. **致命错误（Fatal）** - 立即终止执行
   - openspec 安装失败
   - 权限不足
   - 磁盘空间不足

2. **警告错误（Warning）** - 记录日志，继续执行
   - 某个 agent 模板不存在
   - 某个 skill 拷贝失败
   - 文档生成部分失败

3. **可忽略错误（Info）** - 仅提示，不影响流程
   - 文件已存在（幂等性）
   - 某些可选步骤跳过

### 回滚策略

```bash
# 回滚函数
rollback() {
  local step="$1"

  echo "⚠️  执行失败，开始回滚..."

  case "$step" in
    "2")  # 回滚目录创建
      rm -rf "$BASE_DIR"/{agents,skills,rules,agent-memory}
      echo "✓ 已删除创建的目录"
      ;;
    "4")  # 回滚 agent 部署
      rm -rf "$BASE_DIR/agents"/*.md
      echo "✓ 已删除部署的 agents"
      ;;
    "5")  # 回滚 skills 迁移
      rm -rf "$BASE_DIR/skills"/*
      echo "✓ 已删除迁移的 skills"
      ;;
    "6")  # 回滚 rules 迁移
      rm -rf "$BASE_DIR/rules"/*
      echo "✓ 已删除迁移的 rules"
      ;;
  esac

  echo "✓ 回滚完成"
}

# 错误处理包装器
execute_step() {
  local step_num="$1"
  local step_name="$2"
  local step_func="$3"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "[步骤 $step_num/7] $step_name"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if ! $step_func; then
    echo "❌ 步骤 $step_num 执行失败"
    rollback "$step_num"
    exit 1
  fi

  echo "✓ 步骤 $step_num 完成"
}
```

### 日志记录

```bash
# 日志文件路径
LOG_FILE="$BASE_DIR/setup.log"

# 日志函数
log() {
  local level="$1"
  shift
  local message="$@"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

  echo "[$timestamp] [$level] $message" >> "$LOG_FILE"

  case "$level" in
    "ERROR")
      echo "❌ $message" >&2
      ;;
    "WARN")
      echo "⚠️  $message"
      ;;
    "INFO")
      echo "✓ $message"
      ;;
  esac
}
```

---

## 验证策略

### 完整性检查清单

执行完成后，运行以下检查：

```bash
# 验证脚本
verify_setup() {
  local errors=0

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "验证安装结果"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # 1. 检查 openspec
  if ! command -v openspec &> /dev/null; then
    log WARN "openspec 未安装（可选）"
  else
    log INFO "openspec 已安装: $(openspec --version)"
  fi

  # 2. 检查目录结构
  for dir in agents skills rules agent-memory; do
    if [ ! -d "$BASE_DIR/$dir" ]; then
      log ERROR "目录缺失: $BASE_DIR/$dir"
      ((errors++))
    else
      log INFO "目录存在: $BASE_DIR/$dir"
    fi
  done

  # 3. 检查知识库文档
  KB_FILE=""
  case "$TOOL" in
    "Codex")    KB_FILE="AGENTS.md" ;;
    "codebuddy") KB_FILE="CODEBUDDY.md" ;;
    "qoder")     KB_FILE="QODER.md" ;;
    "trae")      KB_FILE="TRAE.md" ;;
  esac

  if [ -f "$KB_FILE" ]; then
    log INFO "知识库文档存在: $KB_FILE"
    # 检查是否包含增强配置
    if grep -q "AI 工具增强配置" "$KB_FILE"; then
      log INFO "知识库文档包含 AI 工具增强配置"
    else
      log WARN "知识库文档缺少 AI 工具增强配置"
    fi
    # 检查是否包含项目特定配置
    if grep -q "项目特定配置" "$KB_FILE"; then
      log INFO "知识库文档包含项目特定配置"
    else
      log WARN "知识库文档缺少项目特定配置"
    fi
  else
    log WARN "知识库文档不存在: $KB_FILE"
  fi

  # 3b. 检查是否有多余的其他工具 KB 文件
  ALL_KB_FILES=("AGENTS.md" "CODEBUDDY.md" "QODER.md" "TRAE.md" "AGENTS.md")
  for kb in "${ALL_KB_FILES[@]}"; do
    if [ "$kb" != "$KB_FILE" ] && [ -f "$kb" ]; then
      log WARN "多余的知识库文件应清理: $kb"
      ((warnings++))
    fi
  done
  # AGENTS.md 只应在 Codex 下存在
  if [ "$TOOL" != "Codex" ] && [ -f "AGENTS.md" ]; then
    log WARN "AGENTS.md 是 Codex 专属文件，应清理"
    ((warnings++))
  fi

  # 4. 检查 agents
  local agent_count=$(find "$BASE_DIR/agents" -name "*.md" | wc -l)
  if [ "$agent_count" -eq 0 ]; then
    log WARN "未部署任何 agent"
  else
    log INFO "已部署 $agent_count 个 agents"

    # 检查 YAML frontmatter
    for agent_file in "$BASE_DIR/agents"/*.md; do
      if [ -f "$agent_file" ]; then
        if ! head -1 "$agent_file" | grep -q "^---"; then
          log WARN "Agent 缺少 YAML frontmatter: $(basename $agent_file)"
        fi
      fi
    done
  fi

  # 5. 检查 agent memory 目录
  for agent_dir in "$BASE_DIR/agent-memory"/*/; do
    if [ -d "$agent_dir" ]; then
      log INFO "Memory 目录存在: $(basename $agent_dir)"
    fi
  done
  if [ -f "$BASE_DIR/agent-memory/README.md" ]; then
    log INFO "Agent Memory README.md 存在"
  else
    log WARN "Agent Memory README.md 缺失"
  fi

  # 6. 检查 skills
  local skill_count=$(find "$BASE_DIR/skills" -type d -mindepth 1 -maxdepth 1 | wc -l)
  if [ "$skill_count" -eq 0 ]; then
    log WARN "未迁移任何 skill"
  else
    log INFO "已迁移 $skill_count 个 skills"
  fi

  # 7. 检查 rules
  local rule_count=$(find "$BASE_DIR/rules" -name "*.md" | wc -l)
  if [ "$rule_count" -eq 0 ]; then
    log WARN "未迁移任何 rule"
  else
    log INFO "已迁移 $rule_count 个 rules"
  fi

  echo ""
  if [ "$errors" -eq 0 ]; then
    echo "✅ 验证通过！所有必需组件已正确安装"
    return 0
  else
    echo "❌ 验证失败！发现 $errors 个错误"
    return 1
  fi
}
```

### 自动化验证脚本

创建独立的验证脚本 `scripts/verify-setup.sh`：

```bash
#!/bin/bash

# 加载配置
source "$(dirname "$0")/config.sh"

# 运行验证
verify_setup

# 生成报告
generate_report() {
  cat > "$BASE_DIR/setup-report.md" << EOF
# AI Tool Project Setup Report

**执行时间:** $(date '+%Y-%m-%d %H:%M:%S')
**工具类型:** $(detect_tool)
**技术栈:** $(detect_tech_stack)

## 安装组件

### Agents
$(find "$BASE_DIR/agents" -name "*.md" -exec basename {} \; | sed 's/^/- /')

### Skills
$(find "$BASE_DIR/skills" -type d -mindepth 1 -maxdepth 1 -exec basename {} \; | sed 's/^/- /')

### Rules
$(find "$BASE_DIR/rules" -name "*.md" -exec basename {} \; | sed 's/^/- /')

## 验证结果

$(verify_setup 2>&1)

---
*Generated by ivy-tool-setup skill*
EOF

  echo "✓ 报告已生成: $BASE_DIR/setup-report.md"
}

generate_report
```

---

## 使用示例

### 示例 1：完整初始化 Codex 项目

```bash
# 在项目根目录执行
/ivy-tool-setup

# 输出：
# [步骤 0/7] 环境检测
# Node.js:  ✅ v20.11.0
# npm:      ✅ v10.2.4
# Git:      ✅ v2.43.0
# Java:     ✅ OpenJDK 1.8.0_402（Maven 3.9.6）
# ✅ 环境检测通过
#
# [步骤 1/7] 安装 openspec + GitNexus + Context7 MCP
# ✓ openspec 已安装: v1.3.1（跳过安装）
# ✓ GitNexus 安装成功: v1.6.5
# ✓ GitNexus MCP Server 已注册（项目级 .mcp.json）
# ✓ gitnexus setup 全局兜底完成
# ✓ Context7 MCP Server 已注册（项目级 .mcp.json）
# ✓ 代码索引建立完成: 247 文件, 1,832 符号, 12 个功能社区
# ✓ 4 个 Agent Skills 已自动安装
# ✓ Codex Hooks 已注册 (PreToolUse + PostToolUse)
# ✓ CI_MODE=full
#
# [步骤 2/7] 初始化项目目录
# ✓ 检测到工具类型: Codex
# ✓ 创建目录: .Codex/agents
# ✓ 创建目录: .Codex/skills
# ✓ 创建目录: .Codex/rules
# ✓ 创建目录: .Codex/agent-memory
#
# [步骤 3/7] 创建项目知识库文档
# ✓ 执行 openspec init...
# ✓ 生成文档: PROJECT.md
# ✓ 生成文档: ARCHITECTURE.md
#
# [步骤 4/7] 创建 Agent 文件
# ✓ 检测技术栈: Vue2 + Spring Boot
# ✓ 部署 Agent: frontend-agent.md
# ✓ 部署 Agent: spring-agent.md
# ✓ 部署 Agent: java-reviewer.md
# ✓ 共部署 3 个 Agents
#
# [步骤 5/7] 生成 Wiki 文档
# → 检查前置条件...
# ✓ gitnexus status: up-to-date
# ✓ DEEPSEEK_API_KEY 已配置
# ✓ 项目规模: 247 文件，推荐并发数: 5
# ✓ gitnexus wiki 完成: 14 页
# ✓ Wiki 目录: .gitnexus/wiki/
#
# [步骤 6/7] 迁移并优化 Skills
# ✓ 拷贝 Skill: springboot-patterns
# ✓ 拷贝 Skill: dev-process
# ✓ 优化完成
#
# [步骤 7/7] 迁移并优化 Rules
# ✓ 拷贝 Rule: java.md
# ✓ 拷贝 Rule: typescript.md
# ✓ 优化完成
#
# ✅ 所有步骤执行完成！
```

### 示例 2：仅环境检测

```bash
/ivy-tool-setup --step=0

# 输出：
# [步骤 0/7] 环境检测
# Node.js:  ✅ v20.11.0
# npm:      ✅ v10.2.4
# Git:      ✅ v2.43.0
# Java:     ✅ OpenJDK 1.8.0_402（Maven 3.9.6）
# ✅ 环境检测通过，可以继续安装
```

### 示例 3：仅部署 Agents

```bash
/ivy-tool-setup --step=4

# 输出：
# [步骤 4/7] 创建 Agent 文件
# ✓ 检测技术栈: React + TypeScript
# ✓ 部署 Agent: frontend-agent.md
# ✓ 部署 Agent: typescript-reviewer.md
# ✓ 共部署 2 个 Agents
```

### 示例 3：强制覆盖现有文件

```bash
/ivy-tool-setup --force

# 跳过所有确认提示，直接覆盖现有文件
```

---

## 扩展性设计

### 添加新工具支持

在 `scripts/config.sh` 中添加新工具配置：

```bash
# 工具配置映射
declare -A TOOL_CONFIG=(
  ["Codex"]=".Codex"
  ["codebuddy"]=".codebuddy"
  ["qoder"]=".qoder"
  ["trae"]=".trae"
  ["newtool"]=".newtool"  # 新增工具
)
```

### 添加新 Agent 模板

1. 在 `templates/` 目录创建新模板文件
2. 更新 `should_deploy_agent()` 函数添加部署逻辑
3. 更新文档说明

### 自定义优化脚本

用户可以在项目根目录创建 `.ai-tool-setup-config.sh` 自定义配置：

```bash
# 自定义 skill 筛选规则
custom_skill_filter() {
  local skill_name="$1"

  # 自定义逻辑
  case "$skill_name" in
    "my-custom-skill")
      return 0  # 包含
      ;;
    "unwanted-skill")
      return 1  # 排除
      ;;
    *)
      return 0  # 默认包含
      ;;
  esac
}

# 自定义优化逻辑
custom_optimize_skill() {
  local skill_dir="$1"

  # 添加自定义优化步骤
  echo "→ 执行自定义优化..."
}
```

---

## 常见问题

### Q1: openspec 或 GitNexus 安装失败怎么办？

**A:** 两者都是 npm 全局包，常见问题和解决方案：

**权限错误（EACCES）：**
```bash
sudo npm install -g @fission-ai/openspec@latest
sudo npm install -g gitnexus@latest
```

**网络超时：**
```bash
npm install -g @fission-ai/openspec@latest --registry=https://registry.npmmirror.com
npm install -g gitnexus@latest --registry=https://registry.npmmirror.com
```

**Node.js 版本过低：**
```bash
# macOS
brew upgrade node
# Linux (nvm)
nvm install 20 && nvm use 20
```

**GitNexus 索引失败：**
```bash
# 清理旧索引后重试
gitnexus clean
gitnexus analyze --force

# 大项目可跳过向量嵌入加速
gitnexus analyze --skip-embeddings

# 输出详细日志排查问题
gitnexus analyze --verbose
```

**GitNexus MCP 连接失败：**
```bash
# 确认 MCP 注册状态
gitnexus list

# 重新注册 MCP Server
gitnexus setup

# 或手动注册（Codex）
Codex mcp add gitnexus -- npx -y gitnexus@latest mcp
```

**GitNexus 多仓库管理：**
```bash
# 查看所有已索引仓库
gitnexus list

# 全局注册表位置
cat ~/.gitnexus/registry.json

# 删除指定仓库索引（在仓库目录执行）
gitnexus clean

# 删除所有索引（慎用）
gitnexus clean --all --force
```

**Wiki 生成失败：**
```bash
# 检查 API Key 是否配置
echo $DEEPSEEK_API_KEY

# 401 错误 → 确认 API Key 有效
# 429 错误 → 降低并发数
npx gitnexus wiki --base-url https://api.deepseek.com/v1 --model deepseek-v4-pro --concurrency 2

# 强制全量重新生成
npx gitnexus wiki --base-url https://api.deepseek.com/v1 --model deepseek-v4-pro --force

# 索引过期 → 先重建索引
gitnexus analyze --force
npx gitnexus wiki --base-url https://api.deepseek.com/v1 --model deepseek-v4-pro
```

### Q2: 如何跳过某些步骤？

**A:** 使用 `--skip` 参数：
```bash
/ivy-tool-setup --skip=3,5  # 跳过步骤 3 和 5
```

### Q3: 如何查看详细日志？

**A:** 日志文件位于 `$BASE_DIR/setup.log`：
```bash
tail -f "$BASE_DIR/setup.log"
```

### Q4: 如何更新已部署的 agents/skills/rules？

**A:** 重新执行对应步骤并选择覆盖：
```bash
/ivy-tool-setup --step=4 --force  # 强制更新 agents
```

### Q5: 如何回溯原始文件？

**A:** 原始文件保留在源工具目录中（如 `.Codex/`、`.codebuddy/`、`.qoder/` 等），可以随时查看或重新拷贝：
```bash
# 查看原始 skills（假设从 .Codex 迁移到 CodeBuddy）
ls .Codex/skills/

# 重新拷贝某个 skill 到当前工具目录
cp -r .Codex/skills/springboot-patterns "$BASE_DIR/skills/"
```

### Q6: 支持哪些工具之间的迁移？

**A:** 支持以下工具之间的双向迁移：
- Codex ↔ Codex
- Codex ↔ Qoder
- Codex ↔ Trae
- Codex ↔ Qoder
- Codex ↔ Trae
- Qoder ↔ Trae

迁移时会自动检测源工具目录（优先级：codebuddy > Codex > cursor > windsurf > qoder > trae > cline），并拷贝到当前工具目录。

---

## 总结

本 skill 提供了一套完整的 AI 编程工具项目初始化解决方案，具备以下特点：

✅ **自动化** - 一键完成 8 大步骤（环境检测 → 核心工具 → 目录 → 知识库 → Agents → Wiki → Skills → Rules）
✅ **智能化** - 自动检测工具类型和技术栈，按需配置
✅ **代码智能层** - 集成 GitNexus 知识图谱 + Context7 实时文档查询（双 MCP 自动注册、索引建立、agent skills、hooks、wiki 生成），实现符号级代码分析和最新框架文档即时查询
✅ **幂等性** - 可重复执行，安全可靠
✅ **可扩展** - 易于添加新工具和模板
✅ **多工具支持** - 支持 Codex、CodeBuddy、Qoder、Trae 之间的双向迁移
✅ **智能源检测** - 自动检测并从其他工具目录迁移配置
✅ **可验证** - 完整的验证和报告机制

**适用场景：**
- 新项目初始化
- 工具迁移（Codex ↔ CodeBuddy ↔ Qoder ↔ Trae）
- 批量部署标准配置
- 团队规范统一

**下一步：**
- 执行 `/ivy-tool-setup` 开始初始化
- 查看生成的 `setup-report.md` 了解详情
- 根据项目需求调整 agents/skills/rules

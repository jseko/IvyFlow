#!/bin/bash
# AI Tool Project Setup - 执行脚本
set -e
PROJECT_DIR="${1:-.}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_DIR="$PROJECT_DIR/.claude"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
echo_step() { echo ""; echo -e "${GREEN}[步骤 $1/6]${NC} $2"; }
echo_ok() { echo -e "  ${GREEN}✓${NC} $1"; }
echo_skip() { echo -e "  ${YELLOW}⊘${NC} $1"; }
echo_info() { echo -e "  ${BLUE}ℹ${NC} $1"; }
echo_error() { echo -e "  ${RED}✗${NC} $1"; }

cd "$PROJECT_DIR"
echo "========================================"
echo "  AI Tool Project Setup"
echo "========================================"
echo "项目: $(pwd)"
echo ""

# ====== 步骤 0: 选择工具类型 ======
echo_step "0" "选择 AI 编程工具"
AUTO_TOOL=""
[ -d ".claude" ] && AUTO_TOOL="claude"
[ -d ".codebuddy" ] && AUTO_TOOL="codebuddy"
[ -d ".qoder" ] && AUTO_TOOL="qoder"
[ -d ".trae" ] && AUTO_TOOL="trae"

TOOL=""
if [ -n "$AUTO_TOOL" ]; then
    echo_info "检测到已存在的工具目录: .$AUTO_TOOL"
    echo -n "  是否使用 [$AUTO_TOOL]？[Y/n]: "
    read -r response
    [[ ! "$response" =~ ^[Nn]$ ]] && TOOL="$AUTO_TOOL"
fi

if [ -z "$TOOL" ]; then
    echo "  1) claude  2) codebuddy  3) qoder  4) trae"
    echo -n "  请选择 [1]: "
    read -r choice
    case "$choice" in 2) TOOL="codebuddy" ;; 3) TOOL="qoder" ;; 4) TOOL="trae" ;; *) TOOL="claude" ;; esac
fi

case "$TOOL" in
    "claude")    BASE_DIR="$PROJECT_DIR/.claude" ;;
    "codebuddy") BASE_DIR="$PROJECT_DIR/.codebuddy" ;;
    "qoder")     BASE_DIR="$PROJECT_DIR/.qoder" ;;
    "trae")      BASE_DIR="$PROJECT_DIR/.trae" ;;
esac
echo_ok "选择工具: $TOOL"

# ====== 步骤 1: 安装 openspec ======
echo_step "1" "安装 openspec"
if command -v openspec &> /dev/null; then
    echo_ok "openspec 已安装: $(which openspec)"
else
    echo_info "安装 openspec..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install openspec 2>/dev/null || npm install -g @fission-ai/openspec@latest 2>/dev/null
    else
        npm install -g @fission-ai/openspec@latest 2>/dev/null
    fi
    command -v openspec &> /dev/null && echo_ok "安装成功" || echo_error "安装失败"
fi

# ====== 步骤 2: 初始化目录结构 ======
echo_step "2" "初始化目录结构"
mkdir -p "$BASE_DIR"/{agents,skills,rules,agent-memory,skills_sources,rules_sources}
for dir in agents skills rules agent-memory skills_sources rules_sources; do
    echo_ok "创建: $(basename "$BASE_DIR")/$dir/"
done

[ ! -f "$BASE_DIR/.gitignore" ] && cat > "$BASE_DIR/.gitignore" << 'EOF'
skills_sources/
rules_sources/
*.tmp
*.log
EOF
echo_ok "创建 .gitignore"

# ====== 步骤 3: 执行 openspec init ======
echo_step "3" "创建项目知识库文档"

case "$TOOL" in
    "claude")    KB_FILE="CLAUDE.md" ;;
    "codebuddy") KB_FILE="CODEBUDDY.md" ;;
    "qoder")     KB_FILE="QODER.md" ;;
    "trae")      KB_FILE="TRAE.md" ;;
esac

echo_info "执行 openspec init..."
if command -v openspec &> /dev/null; then
    openspec init --tools "$TOOL" 2>/dev/null && echo_ok "openspec init 成功" || echo_info "openspec init 跳过"
fi

# 检测技术栈
echo_info "检测项目技术栈..."
JAVA_PKG="com.example"
FOUND_PKG=$(find src/main/java -name "*.java" -type f 2>/dev/null | head -1 | xargs grep -o 'package [^;]*' 2>/dev/null | awk '{print $2}')
[ -n "$FOUND_PKG" ] && JAVA_PKG="$FOUND_PKG"

SPRING_VERSION="未知"
[ -f "pom.xml" ] && SPRING_VERSION=$(grep -oP 'spring-boot-starter-parent.*?<version>\K[^<]+' pom.xml 2>/dev/null || echo "未知")

HAS_BACKEND=0; HAS_FRONTEND=0
[ -f "pom.xml" ] || [ -f "build.gradle" ] && HAS_BACKEND=1
[ -f "package.json" ] && HAS_FRONTEND=1
echo_info "Java包名=$JAVA_PKG, Spring=$SPRING_VERSION"

# 创建知识库
if [ -f "$KB_FILE" ]; then
    echo_skip "知识库已存在: $(basename "$KB_FILE")"
else
    cat > "$KB_FILE" << KBEOF
# $(echo "$TOOL" | tr '[:lower:]' '[:upper:]') 项目知识库
## 项目概述
本项目由 AI Tool Project Setup Skill 自动初始化。
## 技术栈
KBEOF
    [ "$HAS_BACKEND" -eq 1 ] && echo "| 后端 | Spring Boot $SPRING_VERSION |" >> "$KB_FILE"
    [ "$HAS_FRONTEND" -eq 1 ] && echo "| 前端 | $(grep -oP '"(vue|react)":' package.json 2>/dev/null | tr -d '":' || echo '未知') |" >> "$KB_FILE"
    echo "- \`src/\` - 源代码目录" >> "$KB_FILE"
    echo_ok "创建知识库: $(basename "$KB_FILE")"
fi

# 追加 AI 工具增强配置
if ! grep -q "AI 工具增强配置" "$KB_FILE" 2>/dev/null; then
    cat >> "$KB_FILE" << 'EOF'

## AI 工具增强配置

### 专业 Agents
EOF
    [ "$HAS_BACKEND" -eq 1 ] && cat >> "$KB_FILE" << 'EOF'
- **spring-agent** (Spring Boot 架构师)
- **java-build-resolver** (编译问题修复专家)
- **java-reviewer** (Java 代码审查专家)
EOF
    [ "$HAS_FRONTEND" -eq 1 ] && cat >> "$KB_FILE" << 'EOF'
- **frontend-agent** (前端开发专家)
- **typescript-reviewer** (TypeScript 代码审查专家)
EOF
    cat >> "$KB_FILE" << 'EOF'

### 开发 Skills
- **springboot-patterns**: Spring Boot 架构模式
- **security-review**: 安全审查
- **dev-process**: 研发流程
- **code-reviewer**: 代码审查
EOF
    echo "### 编码 Rules" >> "$KB_FILE"
    echo "项目配置了针对当前技术栈的编码规范。" >> "$KB_FILE"
    echo_ok "追加 AI 工具增强配置"
else
    echo_skip "AI 工具增强配置已存在"
fi

# ====== 步骤 4: 创建 Agent 文件 ======
echo_step "4" "创建 Agent 文件"

AGENTS=()
[ "$HAS_BACKEND" -eq 1 ] && AGENTS+=("spring-agent" "java-build-resolver" "java-reviewer")
[ "$HAS_FRONTEND" -eq 1 ] && AGENTS+=("frontend-agent" "typescript-reviewer")
[ ${#AGENTS[@]} -eq 0 ] && AGENTS=("spring-agent" "java-build-resolver" "java-reviewer")

echo_info "检测到: $([ "$HAS_BACKEND" -eq 1 ] && echo -n '后端 '; [ "$HAS_FRONTEND" -eq 1 ] && echo -n '前端')"
echo_info "部署 ${#AGENTS[@]} 个 Agents..."

for agent in "${AGENTS[@]}"; do
    TEMPLATE="$SKILL_DIR/templates/${agent}.md"
    TARGET="$BASE_DIR/agents/${agent}.md"
    if [ -f "$TEMPLATE" ]; then
        cp "$TEMPLATE" "$TARGET"
        PROJECT_NAME=$(basename "$(pwd)")
        sed -i.bak "s/{{PROJECT_NAME}}/$PROJECT_NAME/g" "$TARGET"
        sed -i.bak "s|{{TOOL_DIR}}|$BASE_DIR|g" "$TARGET"
        sed -i.bak "s/{{JAVA_PACKAGE}}/$JAVA_PKG/g" "$TARGET"
        rm -f "$TARGET.bak"
        echo_ok "部署: ${agent}.md"
    else
        echo_skip "模板不存在: ${agent}.md"
    fi
done

echo ""
echo_info "创建 Agent Memory 目录..."
for agent in "${AGENTS[@]}"; do
    mkdir -p "$BASE_DIR/agent-memory/$agent"
    echo_ok "创建: agent-memory/${agent}/"
done
cat > "$BASE_DIR/agent-memory/README.md" << 'EOF'
# Agent Memory
Each agent has its own subdirectory for storing project-specific context.
EOF
echo_ok "创建 README.md"

# ====== 步骤 5: 迁移并优化 Skills ======
echo_step "5" "迁移并优化 Skills"

if [ -d "$SKILL_DIR/skills_sources" ]; then
    cp -r "$SKILL_DIR/skills_sources/"* "$BASE_DIR/skills_sources/"
    echo_ok "复制 skills_sources 暂存目录"
else
    echo_error "skills_sources 目录不存在"
fi

SELECTED_SKILLS=()
for skill in "security-review" "dev-process" "code-reviewer"; do
    [ -d "$BASE_DIR/skills_sources/$skill" ] && SELECTED_SKILLS+=("$skill")
done
[ "$HAS_BACKEND" -eq 1 ] && [ -d "$BASE_DIR/skills_sources/springboot-patterns" ] && SELECTED_SKILLS+=("springboot-patterns")
[ "$HAS_FRONTEND" -eq 1 ] && [ -d "$BASE_DIR/skills_sources/frontend-patterns" ] && SELECTED_SKILLS+=("frontend-patterns")

echo_info "选择 ${#SELECTED_SKILLS[@]} 个 Skills: ${SELECTED_SKILLS[*]}"

for skill in "${SELECTED_SKILLS[@]}"; do
    SOURCE="$BASE_DIR/skills_sources/$skill"
    TARGET="$BASE_DIR/skills/$skill"
    if [ -d "$SOURCE" ]; then
        cp -r "$SOURCE" "$TARGET"
        echo_ok "迁移: $skill"
        [ -f "$TARGET/SKILL.md" ] && sed -i.bak "s/CodeBuddy/$TOOL/g" "$TARGET/SKILL.md" 2>/dev/null && rm -f "$TARGET/SKILL.md.bak"
    else
        echo_skip "不存在: $skill"
    fi
done

# ====== 步骤 6: 迁移并优化 Rules ======
echo_step "6" "迁移并优化 Rules"

if [ -d "$SKILL_DIR/rules_sources" ]; then
    cp -r "$SKILL_DIR/rules_sources/"* "$BASE_DIR/rules_sources/"
    echo_ok "复制 rules_sources 暂存目录"
else
    echo_error "rules_sources 目录不存在"
fi

SELECTED_RULES=()
[ "$HAS_BACKEND" -eq 1 ] && for rule in "java.md" "spring-boot-rest-api-rules.md" "java-controller-conventions.md"; do
    [ -f "$BASE_DIR/rules_sources/$rule" ] && SELECTED_RULES+=("$rule")
done
[ "$HAS_FRONTEND" -eq 1 ] && for rule in "typescript.md" "vue3.md"; do
    [ -f "$BASE_DIR/rules_sources/$rule" ] && SELECTED_RULES+=("$rule")
done

echo_info "选择 ${#SELECTED_RULES[@]} 个 Rules: ${SELECTED_RULES[*]}"

for rule in "${SELECTED_RULES[@]}"; do
    SOURCE="$BASE_DIR/rules_sources/$rule"
    TARGET="$BASE_DIR/rules/$rule"
    if [ -f "$SOURCE" ]; then
        cp "$SOURCE" "$TARGET"
        echo_ok "迁移: $rule"
        sed -i.bak "s/CodeBuddy/$TOOL/g; s/com\.example\./${JAVA_PKG}./g" "$TARGET" 2>/dev/null
        rm -f "$TARGET.bak"
    else
        echo_skip "不存在: $rule"
    fi
done

# ====== 完成 ======
echo ""
echo "========================================"
echo -e "${GREEN}✅ AI Tool Project Setup 完成！${NC}"
echo "========================================"
echo ""
echo "项目: $(pwd)"
echo "工具: $TOOL"
echo "已部署:"
echo "  - Agents: ${#AGENTS[@]} 个"
echo "  - Skills: ${#SELECTED_SKILLS[@]} 个"
echo "  - Rules: ${#SELECTED_RULES[@]} 个"
echo ""
echo "下一步:"
echo "  1. 查看 $KB_FILE"
echo "  2. 开始使用 AI 辅助开发"
echo ""

#!/bin/bash
# verify-setup.sh
# 验证 AI 工具项目初始化结果

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((ERRORS++))
}

# 检测工具类型
detect_tool() {
    if [ -d ".claude" ]; then
        echo "claude"
    elif [ -d ".codebuddy" ]; then
        echo "codebuddy"
    elif [ -d ".qoder" ]; then
        echo "qoder"
    elif [ -d ".trae" ]; then
        echo "trae"
    else
        echo "unknown"
    fi
}

TOOL=$(detect_tool)

if [ "$TOOL" = "unknown" ]; then
    log_error "未检测到支持的 AI 工具目录 (.claude/.codebuddy/.qoder/.trae)"
    exit 1
fi

case "$TOOL" in
    "claude")    BASE_DIR=".claude" ;;
    "codebuddy") BASE_DIR=".codebuddy" ;;
    "qoder")     BASE_DIR=".qoder" ;;
    "trae")      BASE_DIR=".trae" ;;
esac

echo ""
echo "=========================================="
echo "     AI 工具项目初始化验证"
echo "=========================================="
echo "工具类型: $TOOL"
echo "基础目录: $BASE_DIR"
echo ""

# ==============================
# 1. 检查 openspec
# ==============================
echo "--- 1. openspec 安装检查 ---"

if command -v openspec &> /dev/null; then
    VERSION=$(openspec --version 2>&1 || echo "unknown")
    log_success "openspec 已安装: $VERSION"
else
    log_warn "openspec 未安装（可选依赖）"
fi

# ==============================
# 2. 检查目录结构
# ==============================
echo ""
echo "--- 2. 目录结构检查 ---"

REQUIRED_DIRS=("agents" "skills" "rules" "skills_sources" "rules_sources")
OPTIONAL_DIRS=("docs" "agent-memory")

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$BASE_DIR/$dir" ]; then
        log_success "目录存在: $BASE_DIR/$dir"
    else
        log_error "目录缺失: $BASE_DIR/$dir"
    fi
done

for dir in "${OPTIONAL_DIRS[@]}"; do
    if [ -d "$BASE_DIR/$dir" ]; then
        log_success "目录存在: $BASE_DIR/$dir（可选）"
    else
        log_warn "目录缺失: $BASE_DIR/$dir（可选）"
    fi
done

# ==============================
# 3. 检查知识库文档
# ==============================
echo ""
echo "--- 3. 知识库文档检查 ---"

KB_FILE=""
case "$TOOL" in
    "claude")    KB_FILE="CLAUDE.md" ;;
    "codebuddy") KB_FILE="CODEBUDDY.md" ;;
    "qoder")     KB_FILE="QODER.md" ;;
    "trae")      KB_FILE="TRAE.md" ;;
esac

if [ -f "$KB_FILE" ]; then
    log_success "知识库文档存在: $KB_FILE"
    
    # 检查是否包含增强配置
    if grep -q "AI 工具增强配置" "$KB_FILE" 2>/dev/null; then
        log_success "知识库文档包含 AI 工具增强配置章节"
    else
        log_warn "知识库文档缺少 AI 工具增强配置章节"
    fi
    
    # 检查是否包含项目特定配置
    if grep -q "项目特定配置" "$KB_FILE" 2>/dev/null; then
        log_success "知识库文档包含项目特定配置"
    else
        log_warn "知识库文档缺少项目特定配置"
    fi
else
    log_warn "知识库文档不存在: $KB_FILE（可能未执行 /init 命令）"
fi

# 检查 docs 目录下的文档
for doc in PROJECT.md ARCHITECTURE.md TECH_STACK.md; do
    if [ -f "$BASE_DIR/docs/$doc" ]; then
        log_success "文档存在: $doc"
    else
        log_warn "文档缺失: $doc（可选）"
    fi
done

# ==============================
# 4. 检查 Agents
# ==============================
echo ""
echo "--- 4. Agent 文件检查 ---"

AGENT_FILES=("frontend-agent.md" "spring-agent.md" "java-build-resolver.md" "java-reviewer.md" "typescript-reviewer.md")

AGENT_COUNT=0
for agent in "${AGENT_FILES[@]}"; do
    if [ -f "$BASE_DIR/agents/$agent" ]; then
        log_success "Agent 存在: $agent"
        ((AGENT_COUNT++))
        
        # 检查 YAML frontmatter
        if head -1 "$BASE_DIR/agents/$agent" | grep -q "^---"; then
            # 检查 frontmatter 包含必要字段
            if grep -q "^name:" "$BASE_DIR/agents/$agent" && \
               grep -q "^description:" "$BASE_DIR/agents/$agent" && \
               grep -q "^agentMode:" "$BASE_DIR/agents/$agent"; then
                log_success "  YAML frontmatter 完整: $agent"
            else
                log_warn "  YAML frontmatter 缺少字段: $agent"
            fi
        else
            log_warn "  缺少 YAML frontmatter: $agent"
        fi
        
        # 检查 Agent Memory 引用
        if grep -q "Persistent Agent Memory" "$BASE_DIR/agents/$agent" 2>/dev/null; then
            log_success "  包含 Agent Memory 引用"
        else
            log_warn "  缺少 Agent Memory 引用: $agent"
        fi
    else
        log_warn "Agent 缺失: $agent（可能因技术栈不需要）"
    fi
done

if [ "$AGENT_COUNT" -gt 0 ]; then
    log_success "共部署 $AGENT_COUNT 个 Agents"
else
    log_error "未部署任何 Agent"
fi

# ==============================
# 5. 检查 Agent Memory 目录
# ==============================
echo ""
echo "--- 5. Agent Memory 目录检查 ---"

for agent in "${AGENT_FILES[@]}"; do
    AGENT_NAME="${agent%.md}"
    if [ -d "$BASE_DIR/agent-memory/$AGENT_NAME" ]; then
        log_success "Memory 目录存在: $AGENT_NAME"
    else
        log_warn "Memory 目录缺失: $AGENT_NAME"
    fi
done

if [ -f "$BASE_DIR/agent-memory/README.md" ]; then
    log_success "Agent Memory README.md 存在"
else
    log_warn "Agent Memory README.md 缺失"
fi

# ==============================
# 6. 检查 Skills
# ==============================
echo ""
echo "--- 6. Skills 检查 ---"

SKILL_COUNT=$(find "$BASE_DIR/skills" -type d -mindepth 1 -maxdepth 1 2>/dev/null | wc -l | tr -d ' ')
if [ "$SKILL_COUNT" -gt 0 ]; then
    log_success "已迁移 $SKILL_COUNT 个 Skills"
    
    for skill_dir in "$BASE_DIR/skills"/*/; do
        SKILL_NAME=$(basename "$skill_dir")
        if [ -f "$skill_dir/SKILL.md" ]; then
            log_success "Skill 完整: $SKILL_NAME"
        else
            log_warn "Skill 缺少 SKILL.md: $SKILL_NAME"
        fi
    done
else
    log_warn "未迁移任何 Skill"
fi

# 检查暂存目录
STAGING_COUNT=$(find "$BASE_DIR/skills_sources" -type d -mindepth 1 -maxdepth 1 2>/dev/null | wc -l | tr -d ' ')
if [ "$STAGING_COUNT" -gt 0 ]; then
    log_success "skills_sources 暂存目录包含 $STAGING_COUNT 个 Skills"
else
    log_warn "skills_sources 暂存目录为空"
fi

# ==============================
# 7. 检查 Rules
# ==============================
echo ""
echo "--- 7. Rules 检查 ---"

RULE_COUNT=$(find "$BASE_DIR/rules" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
if [ "$RULE_COUNT" -gt 0 ]; then
    log_success "已迁移 $RULE_COUNT 个 Rules"
    
    for rule_file in "$BASE_DIR/rules"/*.md; do
        RULE_NAME=$(basename "$rule_file")
        log_success "Rule 存在: $RULE_NAME"
    done
else
    log_warn "未迁移任何 Rule"
fi

# 检查暂存目录
RULE_STAGING_COUNT=$(find "$BASE_DIR/rules_sources" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
if [ "$RULE_STAGING_COUNT" -gt 0 ]; then
    log_success "rules_sources 暂存目录包含 $RULE_STAGING_COUNT 个 Rules"
else
    log_warn "rules_sources 暂存目录为空"
fi

# ==============================
# 8. 检查 .gitignore
# ==============================
echo ""
echo "--- 8. 其他检查 ---"

if [ -f "$BASE_DIR/.gitignore" ]; then
    log_success ".gitignore 已创建"
else
    log_warn ".gitignore 未创建"
fi

# ==============================
# 总结
# ==============================
echo ""
echo "=========================================="
echo "          验证结果汇总"
echo "=========================================="
echo ""

if [ "$ERRORS" -eq 0 ]; then
    echo -e "${GREEN}✅ 验证通过！所有必需组件已正确安装${NC}"
else
    echo -e "${RED}❌ 验证失败！发现 $ERRORS 个错误${NC}"
fi

if [ "$WARNINGS" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  发现 $WARNINGS 个警告（非致命）${NC}"
fi

echo ""

# 生成报告
REPORT_FILE="$BASE_DIR/setup-report.md"
cat > "$REPORT_FILE" << EOF
# AI Tool Project Setup Report

**执行时间:** $(date '+%Y-%m-%d %H:%M:%S')
**工具类型:** $TOOL
**基础目录:** $BASE_DIR

## 安装组件

### Agents
$(find "$BASE_DIR/agents" -name "*.md" -exec basename {} \; 2>/dev/null | sed 's/^/- /' || echo "- 无")

### Skills
$(find "$BASE_DIR/skills" -type d -mindepth 1 -maxdepth 1 -exec basename {} \; 2>/dev/null | sed 's/^/- /' || echo "- 无")

### Rules
$(find "$BASE_DIR/rules" -name "*.md" -exec basename {} \; 2>/dev/null | sed 's/^/- /' || echo "- 无")

## 验证结果

- 错误数: $ERRORS
- 警告数: $WARNINGS
- 状态: $([ "$ERRORS" -eq 0 ] && echo "通过" || echo "失败")

---
*Generated by ivy-tool-setup skill*
EOF

log_info "验证报告已生成: $REPORT_FILE"

exit $ERRORS

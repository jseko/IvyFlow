#!/bin/bash
#
# AI Tool Project Setup - 验证脚本
# 验证 skill 执行后的结果
#

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0
BASE_DIR="${BASE_DIR:-}"

resolve_base_dir() {
    if [ -n "$BASE_DIR" ]; then
        return
    fi

    case "${AI_TOOL_SETUP_TOOL:-}" in
        claude) BASE_DIR=".claude" ;;
        codebuddy) BASE_DIR=".codebuddy" ;;
        qoder) BASE_DIR=".qoder" ;;
        trae) BASE_DIR=".trae" ;;
    esac

    if [ -z "$BASE_DIR" ]; then
        for tool_dir in ".codebuddy" ".claude" ".qoder" ".trae"; do
            if [ -d "$tool_dir" ]; then
                BASE_DIR="$tool_dir"
                break
            fi
        done
    fi
}

echo_result() {
    local status="$1"
    local message="$2"
    case "$status" in
        pass)
            echo -e "  ${GREEN}✓${NC} $message"
            ((PASS++))
            ;;
        fail)
            echo -e "  ${RED}✗${NC} $message"
            ((FAIL++))
            ;;
        warn)
            echo -e "  ${YELLOW}⚠${NC} $message"
            ((WARN++))
            ;;
    esac
}

# 验证目录结构
verify_directories() {
    echo ""
    echo "=== 目录结构验证 ==="

    local dirs=("agents" "skills" "rules" "agent-memory" "skills_sources" "rules_sources")
    for dir in "${dirs[@]}"; do
        if [ -d "$BASE_DIR/$dir" ]; then
            echo_result pass "$dir/ 目录存在"
        else
            echo_result fail "$dir/ 目录不存在"
        fi
    done
}

# 验证 agents
verify_agents() {
    echo ""
    echo "=== Agents 验证 ==="

    local agents=("frontend-agent" "spring-agent" "java-build-resolver" "java-reviewer" "typescript-reviewer")
    local expected_agents=("frontend-agent" "spring-agent" "java-build-resolver" "java-reviewer" "typescript-reviewer")

    for agent in "${expected_agents[@]}"; do
        if [ -f "$BASE_DIR/agents/${agent}.md" ]; then
            echo_result pass "${agent}.md 存在"

            # 检查 YAML frontmatter
            if head -1 "$BASE_DIR/agents/${agent}.md" | grep -q "^---"; then
                echo_result pass "  YAML frontmatter 完整"

                # 检查必要字段
                if grep -q "^name:" "$BASE_DIR/agents/${agent}.md" && \
                   grep -q "^description:" "$BASE_DIR/agents/${agent}.md"; then
                    echo_result pass "  必要字段 (name/description) 完整"
                else
                    echo_result fail "  缺少必要字段"
                fi
            else
                echo_result fail "  YAML frontmatter 缺失"
            fi
        else
            echo_result warn "${agent}.md 不存在（可能正常）"
        fi
    done
}

# 验证 Agent Memory
verify_agent_memory() {
    echo ""
    echo "=== Agent Memory 验证 ==="

    local agents=("frontend-agent" "spring-agent" "java-build-resolver" "java-reviewer" "typescript-reviewer")

    for agent in "${agents[@]}"; do
        if [ -d "$BASE_DIR/agent-memory/${agent}" ]; then
            echo_result pass "agent-memory/${agent}/ 存在"
        else
            echo_result warn "agent-memory/${agent}/ 不存在（可能正常）"
        fi
    done

    if [ -f "$BASE_DIR/agent-memory/README.md" ]; then
        echo_result pass "Agent Memory README.md 存在"
    else
        echo_result warn "Agent Memory README.md 缺失"
    fi
}

# 验证 Skills
verify_skills() {
    echo ""
    echo "=== Skills 验证 ==="

    local skills=("springboot-patterns" "dev-process" "code-reviewer" "security-review" "frontend-patterns" "api-design")

    for skill in "${skills[@]}"; do
        if [ -d "$BASE_DIR/skills/${skill}" ]; then
            echo_result pass "${skill}/ 存在"

            # 检查 SKILL.md
            if [ -f "$BASE_DIR/skills/${skill}/SKILL.md" ]; then
                # 检查是否残留非目标工具目录引用
                if grep -q '\.claude/' "$BASE_DIR/skills/${skill}/SKILL.md" && [ "$BASE_DIR" != ".claude" ]; then
                    echo_result warn "  存在未替换的 .claude/ 路径"
                else
                    echo_result pass "  工具路径引用正确"
                fi
            fi
        else
            echo_result warn "${skill}/ 不存在（可能正常）"
        fi
    done
}

# 验证 Rules
verify_rules() {
    echo ""
    echo "=== Rules 验证 ==="

    local java_rules=("java.md" "spring-boot-rest-api-rules.md")
    local vue_rules=("vue3.md" "typescript.md")

    echo "  Java 规则："
    for rule in "${java_rules[@]}"; do
        if [ -f "$BASE_DIR/rules/${rule}" ]; then
            echo_result pass "  $rule 存在"
        else
            echo_result warn "  $rule 不存在"
        fi
    done

    echo "  前端规则："
    for rule in "${vue_rules[@]}"; do
        if [ -f "$BASE_DIR/rules/${rule}" ]; then
            echo_result pass "  $rule 存在"
        else
            echo_result warn "  $rule 不存在"
        fi
    done
}

# 验证知识库
verify_knowledge_base() {
    echo ""
    echo "=== 知识库验证 ==="

    local kb_file=""
    if [ "$BASE_DIR" = ".codebuddy" ]; then
        if [ -f "CODEBUDDY.md" ]; then
            kb_file="CODEBUDDY.md"
            echo_result pass "CODEBUDDY.md 存在于项目根目录"
        else
            echo_result fail "CodeBuddy 模式下缺少 CODEBUDDY.md（应在项目根目录）"
            return
        fi
    elif [ -f "CLAUDE.md" ]; then
        kb_file="CLAUDE.md"
        echo_result pass "CLAUDE.md 存在"
    elif [ -f "CODEBUDDY.md" ]; then
        kb_file="CODEBUDDY.md"
        echo_result pass "CODEBUDDY.md 存在"
    elif [ -f "TRAE.md" ]; then
        kb_file="TRAE.md"
        echo_result pass "TRAE.md 存在"
    elif [ -f "QODER.md" ]; then
        kb_file="QODER.md"
        echo_result pass "QODER.md 存在"
    else
        echo_result warn "未找到知识库文档"
        return
    fi

    # 检查 AI 工具增强配置
    if grep -q "AI 工具增强配置" "$kb_file" 2>/dev/null; then
        echo_result pass "包含 AI 工具增强配置章节"
    else
        echo_result warn "缺少 AI 工具增强配置章节"
    fi

    # 检查项目特定配置
    if grep -q "项目特定配置" "$kb_file" 2>/dev/null; then
        echo_result pass "包含项目特定配置章节"
    else
        echo_result warn "缺少项目特定配置章节"
    fi
}

# 验证占位符替换
verify_placeholder_replacement() {
    echo ""
    echo "=== 占位符替换验证 ==="

    local unprocessed=0

    # 检查 agent 文件中的占位符
    for agent_file in "$BASE_DIR"/agents/*.md; do
        if [ -f "$agent_file" ]; then
            if grep -q '{{PROJECT_NAME}}' "$agent_file"; then
                echo_result fail "$(basename $agent_file) 包含未替换的 {{PROJECT_NAME}}"
                ((unprocessed++))
            fi
            if grep -q '{{TOOL_DIR}}' "$agent_file"; then
                echo_result fail "$(basename $agent_file) 包含未替换的 {{TOOL_DIR}}"
                ((unprocessed++))
            fi
        fi
    done

    if [ $unprocessed -eq 0 ]; then
        echo_result pass "所有占位符已正确替换"
    fi
}

# 生成报告
generate_report() {
    echo ""
    echo "========================================"
    echo "  验证结果汇总"
    echo "========================================"
    echo ""
    echo -e "${GREEN}通过:${NC} $PASS"
    echo -e "${YELLOW}警告:${NC} $WARN"
    echo -e "${RED}失败:${NC} $FAIL"
    echo ""

    local total=$((PASS + FAIL + WARN))

    if [ $FAIL -eq 0 ]; then
        echo -e "${GREEN}✅ 验证通过！${NC}"
        return 0
    else
        echo -e "${RED}❌ 验证失败！${NC}"
        return 1
    fi
}

# 主函数
main() {
    echo ""
    echo "========================================"
    echo "  AI Tool Project Setup - 验证脚本"
    echo "========================================"

    # 检查是否在正确目录
    resolve_base_dir
    if [ -z "$BASE_DIR" ] || [ ! -d "$BASE_DIR" ]; then
        echo ""
        echo -e "${RED}[ERROR]${NC} 请在已执行 /ivy-tool-setup 的项目目录中运行此脚本"
        echo "支持目录: .claude / .codebuddy / .qoder / .trae"
        exit 1
    fi

    echo "检测到工具目录: $BASE_DIR"

    verify_directories
    verify_agents
    verify_agent_memory
    verify_skills
    verify_rules
    verify_knowledge_base
    verify_placeholder_replacement
    generate_report
}

main "$@"

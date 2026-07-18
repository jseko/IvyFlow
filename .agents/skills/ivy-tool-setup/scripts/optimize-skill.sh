#!/bin/bash
# optimize-skill.sh
# 优化 skill 文件，使其适配项目技术栈

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 使用说明
usage() {
    cat <<EOF
使用方法: $0 <skill-file> <tech-stack-json> [output-file]

参数:
  skill-file       要优化的 skill 文件路径
  tech-stack-json  技术栈 JSON 文件路径（由 detect-tech-stack.sh 生成）
  output-file      输出文件路径（可选，默认覆盖原文件）

示例:
  $0 ./skills/springboot-patterns/SKILL.md tech-stack.json
  $0 ./skills/dev-process/SKILL.md tech-stack.json ./skills/dev-process/SKILL-optimized.md
EOF
    exit 1
}

# 检查参数
if [ $# -lt 2 ]; then
    # 如果只有 skill-file，尝试从 pom.xml/package.json 推断技术栈
    if [ $# -ge 1 ]; then
        SKILL_FILE="$1"
        JAVA_PACKAGE="${2:-}"
        TECH_STACK_JSON=""
        OUTPUT_FILE="${3:-$SKILL_FILE}"
    else
        usage
    fi
else
    SKILL_FILE="$1"
    TECH_STACK_JSON="$2"
    OUTPUT_FILE="${3:-$SKILL_FILE}"
fi

# 检查文件是否存在
if [ ! -f "$SKILL_FILE" ]; then
    log_error "Skill 文件不存在: $SKILL_FILE"
    exit 1
fi

# 检查 tech-stack.json 是否存在，不存在时使用默认值
if [ -n "$TECH_STACK_JSON" ] && [ -f "$TECH_STACK_JSON" ]; then
    # 检查 jq 是否安装
    if ! command -v jq &> /dev/null; then
        log_warn "jq 未安装，使用默认值"
        TECH_STACK_JSON=""
    else
        log_info "读取技术栈信息: $TECH_STACK_JSON"
        FRONTEND_FRAMEWORKS=$(jq -r '.frontend.frameworks' "$TECH_STACK_JSON")
        FRONTEND_DIR=$(jq -r '.frontend.directory' "$TECH_STACK_JSON")
        BUILD_TOOL=$(jq -r '.frontend.build_tool' "$TECH_STACK_JSON")
    fi
else
    log_warn "技术栈 JSON 文件不存在，使用默认值"
    TECH_STACK_JSON=""
fi
PACKAGE_MANAGER=$(jq -r '.frontend.package_manager' "$TECH_STACK_JSON")

BACKEND_FRAMEWORKS=$(jq -r '.backend.frameworks' "$TECH_STACK_JSON")
BACKEND_DIR=$(jq -r '.backend.directory' "$TECH_STACK_JSON")
BACKEND_BUILD_TOOL=$(jq -r '.backend.build_tool' "$TECH_STACK_JSON")

DATABASE_SYSTEMS=$(jq -r '.database.systems' "$TECH_STACK_JSON")

log_info "前端: $FRONTEND_FRAMEWORKS"
log_info "后端: $BACKEND_FRAMEWORKS"
log_info "数据库: $DATABASE_SYSTEMS"

# 创建临时文件
TEMP_FILE=$(mktemp)
cp "$SKILL_FILE" "$TEMP_FILE"

# 优化函数：替换版本号
optimize_versions() {
    log_info "优化版本号..."

    # Vue 版本
    if [[ "$FRONTEND_FRAMEWORKS" == *"vue"* ]]; then
        local vue_version=$(echo "$FRONTEND_FRAMEWORKS" | grep -oE 'vue[0-9]+' | grep -oE '[0-9]+')
        if [ -n "$vue_version" ]; then
            sed -i.bak "s/Vue [0-9]\+/Vue $vue_version/g" "$TEMP_FILE"
            sed -i.bak "s/vue@[0-9]\+/vue@$vue_version/g" "$TEMP_FILE"
            log_success "已更新 Vue 版本为 $vue_version"
        fi
    fi

    # Spring Boot 版本
    if [[ "$BACKEND_FRAMEWORKS" == *"spring-boot"* ]]; then
        local sb_version=$(echo "$BACKEND_FRAMEWORKS" | grep -oE 'spring-boot-[0-9.]+' | cut -d- -f3)
        if [ -n "$sb_version" ]; then
            sed -i.bak "s/Spring Boot [0-9.]\+/Spring Boot $sb_version/g" "$TEMP_FILE"
            sed -i.bak "s/spring-boot:[0-9.]\+/spring-boot:$sb_version/g" "$TEMP_FILE"
            log_success "已更新 Spring Boot 版本为 $sb_version"
        fi
    fi

    # Java 版本
    if [[ "$BACKEND_FRAMEWORKS" == *"java"* ]]; then
        local java_version=$(echo "$BACKEND_FRAMEWORKS" | grep -oE 'java[0-9]+' | grep -oE '[0-9]+')
        if [ -n "$java_version" ]; then
            sed -i.bak "s/Java [0-9]\+/Java $java_version/g" "$TEMP_FILE"
            sed -i.bak "s/JDK [0-9]\+/JDK $java_version/g" "$TEMP_FILE"
            log_success "已更新 Java 版本为 $java_version"
        fi
    fi

    # 清理备份文件
    rm -f "${TEMP_FILE}.bak"
}

# 优化函数：替换Java包名
optimize_package_names() {
    log_info "优化Java包名..."

    # 推断Java包名
    local java_package=""
    if [ "$BACKEND_DIR" != "null" ] && [ -n "$BACKEND_DIR" ] && [ -d "${BACKEND_DIR}/src/main/java" ]; then
        java_package=$(find "${BACKEND_DIR}/src/main/java" -name "*.java" -type f 2>/dev/null \
            | head -1 | xargs grep -oP 'package\s+\K[^;]+' 2>/dev/null | cut -d. -f1-3)
    fi

    if [ -z "$java_package" ]; then
        java_package="com.example"
        log_info "未检测到Java包名，使用默认值: $java_package"
    fi

    # 替换示例包名为实际包名
    sed -i.bak "s/com\.example\./${java_package}./g" "$TEMP_FILE"
    sed -i.bak "s/com\/example\//${java_package//.//}/g" "$TEMP_FILE"
    log_success "已替换Java包名为: $java_package"

    # 替换前端目录占位符
    if [ "$FRONTEND_DIR" != "null" ] && [ -n "$FRONTEND_DIR" ]; then
        sed -i.bak "s|src/components/|${FRONTEND_DIR}/src/components/|g" "$TEMP_FILE"
        sed -i.bak "s|src/views/|${FRONTEND_DIR}/src/views/|g" "$TEMP_FILE"
        log_success "已替换前端目录路径"
    fi

    rm -f "${TEMP_FILE}.bak"
}

# 优化函数：精确移除无关技术栈章节
remove_irrelevant_sections() {
    log_info "移除无关技术栈章节..."

    # 定义需要检查的技术栈与对应章节
    declare -A SECTION_CHECKS=(
        ["GraphQL"]="## GraphQL"
        ["WebSocket"]="## WebSocket"
        ["Kafka"]="## Message Queue\|## Kafka\|## 消息队列"
        ["Redis"]="## Caching\|## Cache\|## 缓存"
        ["MongoDB"]="## MongoDB"
        ["Vuex"]="### Vuex"
        ["JPA"]="### JPA"
    )

    # GraphQL：如果后端不使用，移除
    if [[ "$BACKEND_FRAMEWORKS" != *"graphql"* ]] && [[ "$BACKEND_FRAMEWORKS" != *"GraphQL"* ]]; then
        remove_section "## GraphQL"
    fi

    # WebSocket：如果后端不使用，移除
    if [[ "$BACKEND_FRAMEWORKS" != *"websocket"* ]]; then
        remove_section "## WebSocket"
    fi

    # Kafka：如果后端不使用，移除消息队列章节
    if [[ "$BACKEND_FRAMEWORKS" != *"kafka"* ]]; then
        remove_section "## Kafka"
        remove_section "## 消息队列"
    fi

    # Redis：如果数据库不使用，移除缓存章节
    if [[ "$DATABASE_SYSTEMS" != *"redis"* ]]; then
        remove_section "## Caching"
        remove_section "## Cache"
    fi

    # MongoDB：如果数据库不使用，移除
    if [[ "$DATABASE_SYSTEMS" != *"mongodb"* ]]; then
        remove_section "## MongoDB"
    fi

    # Vuex：如果前端不使用，移除
    if [[ "$FRONTEND_FRAMEWORKS" != *"vuex"* ]]; then
        remove_section "### Vuex"
    fi

    # JPA：如果后端不使用，移除
    if [[ "$BACKEND_FRAMEWORKS" != *"jpa"* ]]; then
        remove_section "### JPA"
    fi

    log_success "无关章节移除完成"
}

# 辅助函数：移除指定章节（精确移除从标题到下一个同级/更高级标题之间的所有内容）
remove_section() {
    local section_header="$1"

    # 使用 awk 精确移除章节
    local header_level=$(echo "$section_header" | grep -oE '^#+' | wc -c)
    ((header_level--))  # 去掉换行符

    awk -v header="$section_header" -v level="$header_level" '
    BEGIN { in_section = 0 }
    /^#/ {
        if (in_section) {
            current_level = gsub(/^#+/, "")
            if (current_level <= level) {
                in_section = 0
            }
        }
        if ($0 ~ "^" header) {
            in_section = 1
            next
        }
    }
    !in_section { print }
    ' "$TEMP_FILE" > "${TEMP_FILE}.tmp"

    mv "${TEMP_FILE}.tmp" "$TEMP_FILE"
}

# 优化函数：替换目录路径
optimize_paths() {
    log_info "优化目录路径..."

    # 前端目录
    if [ "$FRONTEND_DIR" != "null" ] && [ -n "$FRONTEND_DIR" ]; then
        sed -i.bak "s|frontend/|${FRONTEND_DIR}/|g" "$TEMP_FILE"
        sed -i.bak "s|client/|${FRONTEND_DIR}/|g" "$TEMP_FILE"
        log_success "已更新前端目录为 $FRONTEND_DIR"
    fi

    # 后端目录
    if [ "$BACKEND_DIR" != "null" ] && [ -n "$BACKEND_DIR" ]; then
        sed -i.bak "s|backend/|${BACKEND_DIR}/|g" "$TEMP_FILE"
        sed -i.bak "s|server/|${BACKEND_DIR}/|g" "$TEMP_FILE"
        log_success "已更新后端目录为 $BACKEND_DIR"
    fi

    rm -f "${TEMP_FILE}.bak"
}

# 优化函数：替换构建工具命令
optimize_build_commands() {
    log_info "优化构建工具命令..."

    # 前端构建工具
    if [ "$BUILD_TOOL" != "null" ] && [ -n "$BUILD_TOOL" ]; then
        case "$BUILD_TOOL" in
            vite)
                sed -i.bak "s/npm run dev/npm run dev/g" "$TEMP_FILE"
                sed -i.bak "s/webpack serve/npm run dev/g" "$TEMP_FILE"
                log_success "已更新为 Vite 构建命令"
                ;;
            webpack)
                sed -i.bak "s/vite/webpack/g" "$TEMP_FILE"
                log_success "已更新为 Webpack 构建命令"
                ;;
        esac
    fi

    # 包管理器
    if [ "$PACKAGE_MANAGER" != "null" ] && [ -n "$PACKAGE_MANAGER" ]; then
        case "$PACKAGE_MANAGER" in
            pnpm)
                sed -i.bak "s/npm install/pnpm install/g" "$TEMP_FILE"
                sed -i.bak "s/npm run/pnpm run/g" "$TEMP_FILE"
                sed -i.bak "s/yarn add/pnpm add/g" "$TEMP_FILE"
                log_success "已更新为 pnpm 命令"
                ;;
            yarn)
                sed -i.bak "s/npm install/yarn install/g" "$TEMP_FILE"
                sed -i.bak "s/npm run/yarn run/g" "$TEMP_FILE"
                log_success "已更新为 yarn 命令"
                ;;
            bun)
                sed -i.bak "s/npm install/bun install/g" "$TEMP_FILE"
                sed -i.bak "s/npm run/bun run/g" "$TEMP_FILE"
                log_success "已更新为 bun 命令"
                ;;
        esac
    fi

    # 后端构建工具
    if [ "$BACKEND_BUILD_TOOL" != "null" ] && [ -n "$BACKEND_BUILD_TOOL" ]; then
        case "$BACKEND_BUILD_TOOL" in
            maven)
                sed -i.bak "s/gradle build/mvn clean install/g" "$TEMP_FILE"
                sed -i.bak "s/\.\/gradlew/mvn/g" "$TEMP_FILE"
                log_success "已更新为 Maven 构建命令"
                ;;
            gradle)
                sed -i.bak "s/mvn clean install/gradle build/g" "$TEMP_FILE"
                sed -i.bak "s/mvn/\.\/gradlew/g" "$TEMP_FILE"
                log_success "已更新为 Gradle 构建命令"
                ;;
        esac
    fi

    rm -f "${TEMP_FILE}.bak"
}

# 优化函数：移除无关技术栈内容
remove_irrelevant_content() {
    log_info "移除无关技术栈内容..."

    # 如果不使用 Vue，移除 Vue 相关章节
    if [[ "$FRONTEND_FRAMEWORKS" != *"vue"* ]]; then
        # 这里使用简单的标记删除，实际实现可能需要更复杂的逻辑
        log_info "项目不使用 Vue，保留通用前端内容"
    fi

    # 如果不使用 React，移除 React 相关章节
    if [[ "$FRONTEND_FRAMEWORKS" != *"react"* ]]; then
        log_info "项目不使用 React，保留通用前端内容"
    fi

    # 如果不使用 Spring Boot，移除 Spring Boot 相关章节
    if [[ "$BACKEND_FRAMEWORKS" != *"spring-boot"* ]]; then
        log_info "项目不使用 Spring Boot，保留通用后端内容"
    fi

    # 如果不使用 MyBatis，移除 MyBatis 相关内容
    if [[ "$BACKEND_FRAMEWORKS" != *"mybatis"* ]]; then
        sed -i.bak "/MyBatis/d" "$TEMP_FILE"
        log_info "已移除 MyBatis 相关内容"
    fi

    rm -f "${TEMP_FILE}.bak" 2>/dev/null || true
}

# 优化函数：添加项目特定说明
add_project_context() {
    log_info "添加项目特定上下文..."

    # 在文件末尾添加项目特定信息
    cat >> "$TEMP_FILE" <<EOF

---

## 项目特定配置

本 skill 已针对当前项目优化，技术栈信息如下：

### 前端
- 框架: $FRONTEND_FRAMEWORKS
- 目录: $FRONTEND_DIR
- 构建工具: $BUILD_TOOL
- 包管理器: $PACKAGE_MANAGER

### 后端
- 框架: $BACKEND_FRAMEWORKS
- 目录: $BACKEND_DIR
- 构建工具: $BACKEND_BUILD_TOOL

### 数据库
- 系统: $DATABASE_SYSTEMS

---

*此文件由 optimize-skill.sh 自动优化生成*
*优化时间: $(date)*
EOF

    log_success "已添加项目特定上下文"
}

# 主优化流程
main() {
    log_info "开始优化 skill: $SKILL_FILE"
    echo ""

    optimize_versions
    optimize_paths
    optimize_package_names
    optimize_build_commands
    remove_irrelevant_content
    remove_irrelevant_sections
    add_project_context

    # 保存优化后的文件
    mv "$TEMP_FILE" "$OUTPUT_FILE"

    echo ""
    log_success "Skill 优化完成！"
    log_info "输出文件: $OUTPUT_FILE"

    # 显示文件大小
    local file_size=$(wc -l < "$OUTPUT_FILE")
    log_info "文件行数: $file_size"
}

# 执行主函数
main

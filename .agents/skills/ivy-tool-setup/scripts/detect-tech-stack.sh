#!/bin/bash
# detect-tech-stack.sh
# 自动检测项目技术栈并生成配置信息

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# 初始化技术栈数组
declare -A TECH_STACK
TECH_STACK[frontend]=""
TECH_STACK[backend]=""
TECH_STACK[database]=""
TECH_STACK[build_tool]=""
TECH_STACK[package_manager]=""

# 检测前端技术栈
detect_frontend() {
    log_info "检测前端技术栈..."

    local frontend_dir=""
    local package_json=""

    # 查找 package.json
    if [ -f "package.json" ]; then
        package_json="package.json"
        frontend_dir="."
    elif [ -f "frontend/package.json" ]; then
        package_json="frontend/package.json"
        frontend_dir="frontend"
    elif [ -f "client/package.json" ]; then
        package_json="client/package.json"
        frontend_dir="client"
    fi

    if [ -z "$package_json" ]; then
        log_warn "未找到 package.json，跳过前端检测"
        return
    fi

    log_info "找到 package.json: $package_json"

    # 检测框架
    local frameworks=()

    if grep -q '"vue"' "$package_json"; then
        local vue_version=$(grep '"vue"' "$package_json" | sed -E 's/.*"vue".*"([^"]+)".*/\1/' | cut -d. -f1)
        frameworks+=("vue${vue_version}")
        log_success "检测到 Vue ${vue_version}"
    fi

    if grep -q '"react"' "$package_json"; then
        frameworks+=("react")
        log_success "检测到 React"
    fi

    if grep -q '"@angular/core"' "$package_json"; then
        frameworks+=("angular")
        log_success "检测到 Angular"
    fi

    # 检测 UI 库
    if grep -q '"element-plus"' "$package_json"; then
        frameworks+=("element-plus")
        log_success "检测到 Element Plus"
    fi

    if grep -q '"ant-design-vue"' "$package_json"; then
        frameworks+=("ant-design-vue")
        log_success "检测到 Ant Design Vue"
    fi

    if grep -q '"antd"' "$package_json"; then
        frameworks+=("antd")
        log_success "检测到 Ant Design"
    fi

    # 检测构建工具
    if grep -q '"vite"' "$package_json"; then
        TECH_STACK[build_tool]="vite"
        log_success "检测到 Vite"
    elif grep -q '"webpack"' "$package_json"; then
        TECH_STACK[build_tool]="webpack"
        log_success "检测到 Webpack"
    fi

    # 检测包管理器
    if [ -f "${frontend_dir}/pnpm-lock.yaml" ]; then
        TECH_STACK[package_manager]="pnpm"
        log_success "检测到 pnpm"
    elif [ -f "${frontend_dir}/yarn.lock" ]; then
        TECH_STACK[package_manager]="yarn"
        log_success "检测到 yarn"
    elif [ -f "${frontend_dir}/package-lock.json" ]; then
        TECH_STACK[package_manager]="npm"
        log_success "检测到 npm"
    elif [ -f "${frontend_dir}/bun.lockb" ]; then
        TECH_STACK[package_manager]="bun"
        log_success "检测到 bun"
    fi

    # 检测 TypeScript
    if grep -q '"typescript"' "$package_json"; then
        frameworks+=("typescript")
        log_success "检测到 TypeScript"
    fi

    # 保存前端技术栈
    TECH_STACK[frontend]=$(IFS=,; echo "${frameworks[*]}")
    TECH_STACK[frontend_dir]="$frontend_dir"
}

# 检测后端技术栈
detect_backend() {
    log_info "检测后端技术栈..."

    local backend_dir=""
    local build_file=""

    # 查找构建文件
    if [ -f "pom.xml" ]; then
        build_file="pom.xml"
        backend_dir="."
        TECH_STACK[build_tool]="maven"
    elif [ -f "backend/pom.xml" ]; then
        build_file="backend/pom.xml"
        backend_dir="backend"
        TECH_STACK[build_tool]="maven"
    elif [ -f "server/pom.xml" ]; then
        build_file="server/pom.xml"
        backend_dir="server"
        TECH_STACK[build_tool]="maven"
    elif [ -f "build.gradle" ] || [ -f "build.gradle.kts" ]; then
        build_file="build.gradle"
        backend_dir="."
        TECH_STACK[build_tool]="gradle"
    elif [ -f "backend/build.gradle" ] || [ -f "backend/build.gradle.kts" ]; then
        build_file="backend/build.gradle"
        backend_dir="backend"
        TECH_STACK[build_tool]="gradle"
    fi

    if [ -z "$build_file" ]; then
        log_warn "未找到 Maven/Gradle 构建文件，跳过后端检测"
        return
    fi

    log_info "找到构建文件: $build_file"

    local frameworks=()

    # 检测 Java 版本
    if [ -f "$build_file" ]; then
        if grep -q '<java.version>' "$build_file" 2>/dev/null; then
            local java_version=$(grep '<java.version>' "$build_file" | sed -E 's/.*<java.version>([^<]+)<.*/\1/')
            frameworks+=("java${java_version}")
            log_success "检测到 Java ${java_version}"
        elif grep -q 'sourceCompatibility' "$build_file" 2>/dev/null; then
            local java_version=$(grep 'sourceCompatibility' "$build_file" | sed -E "s/.*['\"]([0-9]+)['\"].*/\1/")
            frameworks+=("java${java_version}")
            log_success "检测到 Java ${java_version}"
        else
            frameworks+=("java")
            log_success "检测到 Java"
        fi
    fi

    # 检测 Spring Boot
    if grep -q 'spring-boot' "$build_file"; then
        if grep -q '<spring-boot.version>' "$build_file" 2>/dev/null; then
            local sb_version=$(grep '<spring-boot.version>' "$build_file" | sed -E 's/.*<spring-boot.version>([^<]+)<.*/\1/')
            frameworks+=("spring-boot-${sb_version}")
            log_success "检测到 Spring Boot ${sb_version}"
        else
            frameworks+=("spring-boot")
            log_success "检测到 Spring Boot"
        fi
    fi

    # 检测持久化框架
    if grep -q 'mybatis-plus' "$build_file"; then
        frameworks+=("mybatis-plus")
        log_success "检测到 MyBatis-Plus"
    elif grep -q 'mybatis' "$build_file"; then
        frameworks+=("mybatis")
        log_success "检测到 MyBatis"
    fi

    if grep -q 'spring-boot-starter-data-jpa' "$build_file"; then
        frameworks+=("jpa")
        log_success "检测到 JPA"
    fi

    # 保存后端技术栈
    TECH_STACK[backend]=$(IFS=,; echo "${frameworks[*]}")
    TECH_STACK[backend_dir]="$backend_dir"
}

# 检测数据库
detect_database() {
    log_info "检测数据库配置..."

    local databases=()

    # 查找配置文件
    local config_files=(
        "application.yml"
        "application.yaml"
        "application.properties"
        "backend/src/main/resources/application.yml"
        "backend/src/main/resources/application.yaml"
        "backend/src/main/resources/application.properties"
        "server/src/main/resources/application.yml"
        "src/main/resources/application.yml"
    )

    for config_file in "${config_files[@]}"; do
        if [ -f "$config_file" ]; then
            log_info "检查配置文件: $config_file"

            if grep -qi 'mysql' "$config_file"; then
                databases+=("mysql")
                log_success "检测到 MySQL"
            fi

            if grep -qi 'postgresql' "$config_file"; then
                databases+=("postgresql")
                log_success "检测到 PostgreSQL"
            fi

            if grep -qi 'redis' "$config_file"; then
                databases+=("redis")
                log_success "检测到 Redis"
            fi

            if grep -qi 'mongodb' "$config_file"; then
                databases+=("mongodb")
                log_success "检测到 MongoDB"
            fi

            if grep -qi 'elasticsearch' "$config_file"; then
                databases+=("elasticsearch")
                log_success "检测到 Elasticsearch"
            fi

            break
        fi
    done

    if [ ${#databases[@]} -eq 0 ]; then
        log_warn "未检测到数据库配置"
    fi

    TECH_STACK[database]=$(IFS=,; echo "${databases[*]}")
}

# 生成技术栈报告
generate_report() {
    log_info "生成技术栈报告..."

    local output_file="${1:-tech-stack.json}"

    cat > "$output_file" <<EOF
{
  "frontend": {
    "frameworks": "${TECH_STACK[frontend]}",
    "directory": "${TECH_STACK[frontend_dir]:-}",
    "build_tool": "${TECH_STACK[build_tool]:-}",
    "package_manager": "${TECH_STACK[package_manager]:-}"
  },
  "backend": {
    "frameworks": "${TECH_STACK[backend]}",
    "directory": "${TECH_STACK[backend_dir]:-}",
    "build_tool": "${TECH_STACK[build_tool]:-}"
  },
  "database": {
    "systems": "${TECH_STACK[database]}"
  },
  "detected_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

    log_success "技术栈报告已生成: $output_file"
}

# 打印技术栈摘要
print_summary() {
    echo ""
    echo "=========================================="
    echo "          技术栈检测摘要"
    echo "=========================================="
    echo ""

    if [ -n "${TECH_STACK[frontend]}" ]; then
        echo "前端技术栈:"
        echo "  框架: ${TECH_STACK[frontend]}"
        echo "  目录: ${TECH_STACK[frontend_dir]:-未知}"
        echo "  构建工具: ${TECH_STACK[build_tool]:-未知}"
        echo "  包管理器: ${TECH_STACK[package_manager]:-未知}"
        echo ""
    fi

    if [ -n "${TECH_STACK[backend]}" ]; then
        echo "后端技术栈:"
        echo "  框架: ${TECH_STACK[backend]}"
        echo "  目录: ${TECH_STACK[backend_dir]:-未知}"
        echo "  构建工具: ${TECH_STACK[build_tool]:-未知}"
        echo ""
    fi

    if [ -n "${TECH_STACK[database]}" ]; then
        echo "数据库:"
        echo "  系统: ${TECH_STACK[database]}"
        echo ""
    fi

    echo "=========================================="
}

# 主函数
main() {
    local output_file="${1:-tech-stack.json}"

    log_info "开始检测项目技术栈..."
    echo ""

    detect_frontend
    echo ""

    detect_backend
    echo ""

    detect_database
    echo ""

    generate_report "$output_file"
    print_summary

    log_success "技术栈检测完成！"
}

# 执行主函数
main "$@"

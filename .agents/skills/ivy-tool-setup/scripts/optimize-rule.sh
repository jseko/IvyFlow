#!/bin/bash
# optimize-rule.sh
# 优化 rule 文件，使其适配项目技术栈和编码规范

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
使用方法: $0 <rule-file> <tech-stack-json> [output-file]

参数:
  rule-file        要优化的 rule 文件路径
  tech-stack-json  技术栈 JSON 文件路径（由 detect-tech-stack.sh 生成）
  output-file      输出文件路径（可选，默认覆盖原文件）

示例:
  $0 ./rules/java-conventions.md tech-stack.json
  $0 ./rules/typescript.md tech-stack.json ./rules/typescript-optimized.md
EOF
    exit 1
}

# 检查参数
if [ $# -lt 2 ]; then
    # 如果只有 rule-file，尝试从 pom.xml/package.json 推断技术栈
    if [ $# -ge 1 ]; then
        RULE_FILE="$1"
        JAVA_PACKAGE="${2:-}"
        TECH_STACK_JSON=""
        OUTPUT_FILE="${3:-$RULE_FILE}"
    else
        usage
    fi
else
    RULE_FILE="$1"
    TECH_STACK_JSON="$2"
    OUTPUT_FILE="${3:-$RULE_FILE}"
fi

# 检查文件是否存在
if [ ! -f "$RULE_FILE" ]; then
    log_error "Rule 文件不存在: $RULE_FILE"
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
        BACKEND_FRAMEWORKS=$(jq -r '.backend.frameworks' "$TECH_STACK_JSON")
        DATABASE_SYSTEMS=$(jq -r '.database.systems' "$TECH_STACK_JSON")
    fi
else
    log_warn "技术栈 JSON 文件不存在，使用默认值"
    TECH_STACK_JSON=""
fi

log_info "前端: $FRONTEND_FRAMEWORKS"
log_info "后端: $BACKEND_FRAMEWORKS"
log_info "数据库: $DATABASE_SYSTEMS"

# 创建临时文件
TEMP_FILE=$(mktemp)
cp "$RULE_FILE" "$TEMP_FILE"

# 判断 rule 是否适用于当前项目
is_rule_applicable() {
    local rule_name=$(basename "$RULE_FILE" .md)

    case "$rule_name" in
        *java*|*spring*)
            if [[ "$BACKEND_FRAMEWORKS" == *"java"* ]] || [[ "$BACKEND_FRAMEWORKS" == *"spring"* ]]; then
                return 0
            fi
            return 1
            ;;
        *typescript*|*ts*)
            if [[ "$FRONTEND_FRAMEWORKS" == *"typescript"* ]]; then
                return 0
            fi
            return 1
            ;;
        *vue*)
            if [[ "$FRONTEND_FRAMEWORKS" == *"vue"* ]]; then
                return 0
            fi
            return 1
            ;;
        *react*)
            if [[ "$FRONTEND_FRAMEWORKS" == *"react"* ]]; then
                return 0
            fi
            return 1
            ;;
        *mysql*|*sql*)
            if [[ "$DATABASE_SYSTEMS" == *"mysql"* ]] || [[ "$DATABASE_SYSTEMS" == *"postgresql"* ]]; then
                return 0
            fi
            return 1
            ;;
        *eslint*|*prettier*)
            if [[ "$FRONTEND_FRAMEWORKS" != "" ]]; then
                return 0
            fi
            return 1
            ;;
        *)
            # 通用规则默认适用
            return 0
            ;;
    esac
}

# 优化函数：更新技术版本
optimize_versions() {
    log_info "优化技术版本..."

    # Java 版本
    if [[ "$BACKEND_FRAMEWORKS" == *"java"* ]]; then
        local java_version=$(echo "$BACKEND_FRAMEWORKS" | grep -oE 'java[0-9]+' | grep -oE '[0-9]+')
        if [ -n "$java_version" ]; then
            sed -i.bak "s/Java [0-9]\+/Java $java_version/g" "$TEMP_FILE"
            sed -i.bak "s/JDK [0-9]\+/JDK $java_version/g" "$TEMP_FILE"
            log_success "已更新 Java 版本为 $java_version"
        fi
    fi

    # TypeScript 版本（如果能从 package.json 读取）
    if [[ "$FRONTEND_FRAMEWORKS" == *"typescript"* ]]; then
        log_info "检测到 TypeScript，保持版本配置"
    fi

    # Vue 版本
    if [[ "$FRONTEND_FRAMEWORKS" == *"vue"* ]]; then
        local vue_version=$(echo "$FRONTEND_FRAMEWORKS" | grep -oE 'vue[0-9]+' | grep -oE '[0-9]+')
        if [ -n "$vue_version" ]; then
            sed -i.bak "s/Vue [0-9]\+/Vue $vue_version/g" "$TEMP_FILE"
            log_success "已更新 Vue 版本为 $vue_version"
        fi
    fi

    rm -f "${TEMP_FILE}.bak"
}

# 优化函数：调整编码规范
optimize_coding_standards() {
    log_info "调整编码规范..."

    # 根据项目实际情况调整缩进规则
    # 这里可以读取 .editorconfig 或 eslintrc 来获取实际配置

    # 检查是否有 .editorconfig
    if [ -f ".editorconfig" ]; then
        local indent_size=$(grep "indent_size" .editorconfig | head -1 | cut -d= -f2 | tr -d ' ')
        if [ -n "$indent_size" ]; then
            sed -i.bak "s/缩进: [0-9]\+ 个空格/缩进: $indent_size 个空格/g" "$TEMP_FILE"
            sed -i.bak "s/indent: [0-9]\+ spaces/indent: $indent_size spaces/g" "$TEMP_FILE"
            log_success "已更新缩进规则为 $indent_size 个空格"
        fi
    fi

    # 检查是否有 .eslintrc
    if [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ] || [ -f ".eslintrc.yml" ]; then
        log_info "检测到 ESLint 配置，保持项目 ESLint 规则"
    fi

    rm -f "${TEMP_FILE}.bak" 2>/dev/null || true
}

# 优化函数：补充项目特定约束
add_project_constraints() {
    log_info "补充项目特定约束..."

    # 根据技术栈添加特定约束
    local constraints=""

    if [[ "$BACKEND_FRAMEWORKS" == *"spring-boot"* ]]; then
        constraints+="
### Spring Boot 项目约束

- 使用 @RestController 而非 @Controller + @ResponseBody
- Service 层方法必须添加 @Transactional 注解（写操作）
- 使用 Lombok 简化代码（@Data, @Slf4j, @RequiredArgsConstructor）
- 统一异常处理使用 @ControllerAdvice
"
    fi

    if [[ "$FRONTEND_FRAMEWORKS" == *"vue3"* ]]; then
        constraints+="
### Vue 3 项目约束

- 优先使用 Composition API 和 <script setup> 语法
- Props 和 Emits 必须类型化
- 使用 ref 处理基本类型，reactive 处理对象
- 避免在模板中使用复杂表达式
"
    fi

    if [[ "$DATABASE_SYSTEMS" == *"mysql"* ]]; then
        constraints+="
### MySQL 数据库约束

- 所有表必须有主键
- 使用 InnoDB 存储引擎
- 字符集统一使用 utf8mb4
- 避免使用 SELECT *
- 为常用查询字段添加索引
"
    fi

    if [ -n "$constraints" ]; then
        cat >> "$TEMP_FILE" <<EOF

---

## 项目特定约束

$constraints

---
EOF
        log_success "已添加项目特定约束"
    fi
}

# 优化函数：精确移除无关规则章节
remove_irrelevant_rule_sections() {
    log_info "移除无关规则章节..."

    local rule_name=$(basename "$RULE_FILE" .md)

    # Vue 相关规则：如果项目不使用 Vue，移除 Vuex/Pinia 等 Vue 特有章节
    if [[ "$rule_name" == *"vue"* ]] || [[ "$rule_name" == *"typescript"* ]]; then
        if [[ "$FRONTEND_FRAMEWORKS" != *"vuex"* ]]; then
            remove_section "### Vuex"
            remove_section "## Vuex"
        fi
        if [[ "$FRONTEND_FRAMEWORKS" != *"pinia"* ]]; then
            remove_section "### Pinia"
        fi
        if [[ "$FRONTEND_FRAMEWORKS" != *"react"* ]]; then
            remove_section "### React"
            remove_section "## React"
        fi
    fi

    # Java 相关规则：如果项目不使用某些技术，移除对应章节
    if [[ "$rule_name" == *"java"* ]] || [[ "$rule_name" == *"spring"* ]]; then
        if [[ "$BACKEND_FRAMEWORKS" != *"jpa"* ]]; then
            remove_section "### JPA"
            remove_section "## JPA"
        fi
        if [[ "$BACKEND_FRAMEWORKS" != *"mybatis"* ]]; then
            remove_section "### MyBatis"
            remove_section "## MyBatis"
        fi
        if [[ "$DATABASE_SYSTEMS" != *"mongodb"* ]]; then
            remove_section "### MongoDB"
        fi
        if [[ "$DATABASE_SYSTEMS" != *"redis"* ]]; then
            remove_section "### Redis"
            remove_section "## Cache"
            remove_section "## Caching"
        fi
    fi

    log_success "无关规则章节移除完成"
}

# 辅助函数：移除指定章节（精确移除从标题到下一个同级/更高级标题之间的所有内容）
remove_section() {
    local section_header="$1"

    local header_level=$(echo "$section_header" | grep -oE '^#+' | wc -c)
    ((header_level--))

    # 检查文件中是否存在该章节
    if ! grep -q "$section_header" "$TEMP_FILE" 2>/dev/null; then
        return 0  # 章节不存在，无需移除
    fi

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

# 优化函数：替换Java包名
optimize_java_package() {
    log_info "优化Java包名..."

    local java_package=""
    if [ "$BACKEND_FRAMEWORKS" != "null" ] && [[ "$BACKEND_FRAMEWORKS" == *"java"* ]]; then
        if [ -d "backend/src/main/java" ]; then
            java_package=$(find "backend/src/main/java" -name "*.java" -type f 2>/dev/null \
                | head -1 | xargs grep -oP 'package\s+\K[^;]+' 2>/dev/null | cut -d. -f1-3)
        fi
    fi

    if [ -n "$java_package" ]; then
        sed -i.bak "s/com\.example\./${java_package}./g" "$TEMP_FILE"
        sed -i.bak "s/com\/example\//${java_package//.//}/g" "$TEMP_FILE"
        log_success "已替换Java包名为: $java_package"
    fi

    rm -f "${TEMP_FILE}.bak" 2>/dev/null || true
}

# 优化函数：补充项目特定规则
add_project_specific_rules() {
    log_info "补充项目特定规则..."

    # 推断包名
    local java_package=""
    if [ -d "backend/src/main/java" ]; then
        java_package=$(find "backend/src/main/java" -name "*.java" -type f 2>/dev/null \
            | head -1 | xargs grep -oP 'package\s+\K[^;]+' 2>/dev/null | cut -d. -f1-3)
    fi
    [ -z "$java_package" ] && java_package="com.example"

    cat >> "$TEMP_FILE" <<EOF

---

## 项目特定规则

### 包结构约定

**前端：**
\`\`\`
src/
├── components/     # 可复用组件
├── views/          # 页面组件
├── stores/         # Pinia 状态管理
├── api/            # API 调用模块
├── utils/          # 工具函数
└── router/         # 路由配置
\`\`\`

**后端：**
\`\`\`
${java_package}/
├── controller/     # REST 控制器
├── service/        # 业务逻辑层
├── mapper/         # MyBatis-Plus 数据访问
├── entity/         # 数据库实体
├── dto/            # 数据传输对象
└── config/         # 配置类
\`\`\`

### 命名约定

- **组件文件**：PascalCase（如 \`UserProfile.vue\`）
- **API 文件**：camelCase（如 \`userApi.js\`）
- **常量**：UPPER_SNAKE_CASE（如 \`API_BASE_URL\`）
- **Service 方法**：动词开头（create、update、delete、get、list、find）

### API 响应格式

所有 API 响应必须使用统一格式：

\`\`\`typescript
interface ApiResponse<T> {
  code: number      // 状态码（200 成功，其他失败）
  message: string   // 消息描述
  data: T          // 业务数据
}
\`\`\`

### 错误处理

- **前端**：使用 axios 拦截器统一处理，401 自动跳转登录
- **后端**：使用全局异常处理器 \`@ControllerAdvice\`，统一返回 ApiResponse 格式

### 特殊约定

- 前端 API 调用统一通过 \`src/api/\` 模块，不在组件中直接使用 axios
- 后端 Controller 统一使用 \`/api/\` 前缀
- 前端组件使用 \`<script setup>\` 语法
- 后端 Service 使用构造器注入，避免字段注入
- 数据库查询使用 MyBatis-Plus，避免手写 SQL（复杂查询除外）
EOF

    log_success "已添加项目特定规则"
}

# 优化函数：移除无关规则
remove_irrelevant_rules() {
    log_info "移除无关规则..."

    local rule_name=$(basename "$RULE_FILE" .md)

    # 如果是 Java 规则但项目不使用 Java
    if [[ "$rule_name" == *"java"* ]] && [[ "$BACKEND_FRAMEWORKS" != *"java"* ]]; then
        log_warn "此规则不适用于当前项目（无 Java 后端）"
        return 1
    fi

    # 如果是 TypeScript 规则但项目不使用 TypeScript
    if [[ "$rule_name" == *"typescript"* ]] && [[ "$FRONTEND_FRAMEWORKS" != *"typescript"* ]]; then
        log_warn "此规则不适用于当前项目（无 TypeScript）"
        return 1
    fi

    # 如果是 Vue 规则但项目不使用 Vue
    if [[ "$rule_name" == *"vue"* ]] && [[ "$FRONTEND_FRAMEWORKS" != *"vue"* ]]; then
        log_warn "此规则不适用于当前项目（无 Vue）"
        return 1
    fi

    # 如果是 React 规则但项目不使用 React
    if [[ "$rule_name" == *"react"* ]] && [[ "$FRONTEND_FRAMEWORKS" != *"react"* ]]; then
        log_warn "此规则不适用于当前项目（无 React）"
        return 1
    fi

    return 0
}

# 优化函数：添加优化标记
add_optimization_marker() {
    log_info "添加优化标记..."

    cat >> "$TEMP_FILE" <<EOF

---

## 优化信息

本规则文件已针对当前项目优化：

- 前端技术栈: $FRONTEND_FRAMEWORKS
- 后端技术栈: $BACKEND_FRAMEWORKS
- 数据库系统: $DATABASE_SYSTEMS

优化时间: $(date)
优化工具: optimize-rule.sh

---
EOF

    log_success "已添加优化标记"
}

# 主优化流程
main() {
    log_info "开始优化 rule: $RULE_FILE"
    echo ""

    # 检查规则是否适用
    if ! is_rule_applicable; then
        log_warn "此规则不适用于当前项目技术栈，跳过优化"
        exit 0
    fi

    # 执行优化
    optimize_versions
    optimize_coding_standards
    optimize_java_package

    if ! remove_irrelevant_rules; then
        log_warn "规则不适用，不生成输出文件"
        rm -f "$TEMP_FILE"
        exit 0
    fi

    remove_irrelevant_rule_sections
    add_project_specific_rules
    add_optimization_marker

    # 保存优化后的文件
    mv "$TEMP_FILE" "$OUTPUT_FILE"

    echo ""
    log_success "Rule 优化完成！"
    log_info "输出文件: $OUTPUT_FILE"

    # 显示文件大小
    local file_size=$(wc -l < "$OUTPUT_FILE")
    log_info "文件行数: $file_size"
}

# 执行主函数
main

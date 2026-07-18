#!/bin/bash
#
# AI Tool Project Setup - 测试环境准备脚本
# 创建用于测试 skill 功能的模拟项目结构
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_BASE="/tmp/ai-tool-setup-tests"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
echo_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
echo_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 创建基础测试目录
setup_base() {
    echo_info "创建测试基础目录..."
    mkdir -p "$TEST_BASE"
    echo "✓ 测试目录: $TEST_BASE"
}

# 创建全栈项目测试环境
create_fullstack_env() {
    local project_dir="$TEST_BASE/test-fullstack"
    echo_info "创建全栈项目测试环境..."

    mkdir -p "$project_dir"
    cd "$project_dir"

    # 后端结构 (Spring Boot)
    mkdir -p backend/src/main/{java/com/example/{controller,service,mapper,entity,dto},resources}
    mkdir -p backend/src/test/java

    # 创建 pom.xml
    cat > backend/pom.xml << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>fullstack-demo</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.0</version>
    </parent>

    <properties>
        <java.version>17</java.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.mybatis.spring.boot</groupId>
            <artifactId>mybatis-spring-boot-starter</artifactId>
            <version>3.0.3</version>
        </dependency>
        <dependency>
            <groupId>com.mysql</groupId>
            <artifactId>mysql-connector-j</artifactId>
        </dependency>
    </dependencies>
</project>
EOF

    # 创建 Spring Boot 主类
    cat > backend/src/main/java/com/example/DemoApplication.java << 'EOF'
package com.example;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class DemoApplication {
    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
}
EOF

    # 创建 Controller
    cat > backend/src/main/java/com/example/controller/UserController.java << 'EOF'
package com.example.controller;

import com.example.service.UserService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/{id}")
    public ApiResponse<User> getUser(@PathVariable Long id) {
        return ApiResponse.success(userService.findById(id));
    }

    @PostMapping
    public ApiResponse<Long> createUser(@RequestBody UserRequest request) {
        return ApiResponse.success(userService.create(request));
    }
}
EOF

    # 前端结构 (Vue 3)
    mkdir -p frontend/src/{components,views,stores,api,composables}
    mkdir -p frontend/public

    # 创建 package.json
    cat > frontend/package.json << 'EOF'
{
  "name": "fullstack-demo-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build"
  },
  "dependencies": {
    "vue": "^3.4.0",
    "vue-router": "^4.2.0",
    "pinia": "^2.1.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vue-tsc": "^1.8.0"
  }
}
EOF

    # 创建 vite.config.ts
    cat > frontend/vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
EOF

    # 创建 tsconfig.json
    cat > frontend/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
EOF

    # 创建 Vue 组件
    cat > frontend/src/components/UserList.vue << 'EOF'
<template>
  <div class="user-list">
    <h2>用户列表</h2>
    <div v-for="user in users" :key="user.id" class="user-item">
      {{ user.name }} - {{ user.email }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getUsers } from '@/api/users'

interface User {
  id: number
  name: string
  email: string
}

const users = ref<User[]>([])

onMounted(async () => {
  users.value = await getUsers()
})
</script>
EOF

    echo_info "✓ 全栈项目测试环境创建完成: $project_dir"
}

# 创建后端项目测试环境
create_backend_env() {
    local project_dir="$TEST_BASE/test-backend"
    echo_info "创建后端项目测试环境..."

    mkdir -p "$project_dir"
    cd "$project_dir"

    # 创建 Maven 项目结构
    mkdir -p src/main/{java/com/myapp/{controller,service,repository,entity,config},resources}
    mkdir -p src/test/java/com/myapp

    # 创建 pom.xml
    cat > pom.xml << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.myapp</groupId>
    <artifactId>backend-demo</artifactId>
    <version>1.0.0</version>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.0</version>
    </parent>

    <properties>
        <java.version>17</java.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
    </dependencies>
</project>
EOF

    # 创建主类
    cat > src/main/java/com/myapp/BackendApplication.java << 'EOF'
package com.myapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class BackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(BackendApplication.class, args);
    }
}
EOF

    echo_info "✓ 后端项目测试环境创建完成: $project_dir"
}

# 创建前端项目测试环境
create_frontend_env() {
    local project_dir="$TEST_BASE/test-frontend"
    echo_info "创建前端项目测试环境..."

    mkdir -p "$project_dir"
    cd "$project_dir"

    # 创建项目结构
    mkdir -p src/{components,hooks,utils,api,pages,types}
    mkdir -p public

    # 创建 package.json
    cat > package.json << 'EOF'
{
  "name": "frontend-demo",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "axios": "^1.6.0",
    "zustand": "^4.4.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
EOF

    # 创建 tsconfig.json
    cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
EOF

    # 创建组件示例
    cat > src/components/UserList.tsx << 'EOF'
import { useState, useEffect } from 'react'
import { fetchUsers } from '@/api/users'

interface User {
  id: number
  name: string
  email: string
}

export function UserList() {
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    fetchUsers().then(setUsers)
  }, [])

  return (
    <div className="user-list">
      <h2>用户列表</h2>
      {users.map(user => (
        <div key={user.id}>{user.name} - {user.email}</div>
      ))}
    </div>
  )
}
EOF

    echo_info "✓ 前端项目测试环境创建完成: $project_dir"
}

# 复制 skills_sources 和 rules_sources（模拟 .codebuddy 源）
copy_source_dirs() {
    local project_dir="$TEST_BASE/test-fullstack"
    echo_info "复制 skills_sources 和 rules_sources..."

    # 复制 skills_sources
    if [ -d "$SCRIPT_DIR/../skills_sources" ]; then
        cp -r "$SCRIPT_DIR/../skills_sources" "$project_dir/.claude/"
        echo "✓ skills_sources 复制完成"
    else
        echo_warn "skills_sources 目录不存在，跳过"
    fi

    # 复制 rules_sources
    if [ -d "$SCRIPT_DIR/../rules_sources" ]; then
        cp -r "$SCRIPT_DIR/../rules_sources" "$project_dir/.claude/"
        echo "✓ rules_sources 复制完成"
    else
        echo_warn "rules_sources 目录不存在，跳过"
    fi
}

# 主函数
main() {
    echo ""
    echo "========================================"
    echo "  AI Tool Project Setup - 测试环境准备"
    echo "========================================"
    echo ""

    setup_base
    create_fullstack_env
    create_backend_env
    create_frontend_env

    echo ""
    echo "========================================"
    echo "  测试环境准备完成！"
    echo "========================================"
    echo ""
    echo "测试项目位置: $TEST_BASE"
    echo ""
    echo "使用说明："
    echo "  1. cd $TEST_BASE/test-fullstack"
    echo "  2. 在项目中调用 /ivy-tool-setup"
    echo "  3. 运行验证脚本检查结果"
    echo ""
}

main "$@"

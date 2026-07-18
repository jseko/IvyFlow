# Ivy Tool Setup Skill - 测试用例

**Skill:** `ivy-tool-setup`
**创建日期:** 2026-05-08
**测试目标:** 验证 skill 在不同技术栈项目中的功能完整性

---

## 测试用例设计原则

1. **真实性** - 使用真实项目结构，而非空目录
2. **覆盖性** - 覆盖全栈、后端、前端三种典型项目类型
3. **可重复** - 使用临时目录，测试后自动清理
4. **可验证** - 每个步骤都有明确的预期输出

---

## 测试用例 1：全栈项目（Spring Boot + Vue 3）

### 场景描述

初始化一个典型的全栈 monorepo 项目，包含：
- 后端：Spring Boot 3.2 + Maven
- 前端：Vue 3 + TypeScript + Vite

### 前置条件

```bash
# 创建测试项目结构
mkdir -p /tmp/test-fullstack/{backend/src/main/{java/com/example,resources},frontend/src}
```

### 测试命令

```
请执行 /ivy-tool-setup 为这个全栈项目初始化 AI 编程工具环境
```

### 预期验证项

| 验证点 | 预期结果 |
|--------|----------|
| **步骤 1 - openspec** | 检测到 openspec 已安装，跳过或安装成功 |
| **步骤 2 - 目录结构** | 创建 agents/、skills/、rules/、agent-memory/、skills_sources/、rules_sources/ |
| **步骤 3 - 知识库** | 生成 PROJECT.md、ARCHITECTURE.md 等文档 |
| **步骤 3 - 知识库增强** | CLAUDE.md 包含 "AI 工具增强配置" 章节 |
| **步骤 3 - 项目上下文** | CLAUDE.md 包含 "项目特定配置" 章节（前端=Vue3，后端=Spring Boot） |
| **步骤 4 - Agents 部署** | 部署 5 个 agents：frontend-agent、spring-agent、java-build-resolver、java-reviewer、typescript-reviewer |
| **步骤 4 - YAML Frontmatter** | 每个 agent 文件包含完整的 YAML frontmatter（name/description/agentMode/enabled） |
| **步骤 4 - Agent Memory** | 创建 5 个 agent-memory 子目录 + README.md |
| **步骤 4 - 占位符替换** | {{PROJECT_NAME}} → test-fullstack，{{TOOL_DIR}} → .claude |
| **步骤 5 - Skills 迁移** | 迁移 6 个 skills：springboot-patterns、dev-process、code-reviewer、security-review、frontend-patterns、api-design |
| **步骤 5 - Skills 优化** | Claude → Claude，Java 包名替换，无关章节移除 |
| **步骤 6 - Rules 筛选** | 筛选 Java 相关规则（java.md、spring-boot-*.md）和 Vue 相关规则（vue3.md、typescript.md） |
| **步骤 6 - Rules 优化** | 技术版本更新，Java 包名替换，项目特定规则追加 |

### 验证脚本

```bash
#!/bin/bash
cd /tmp/test-fullstack

# 验证 agents
echo "=== Agent 验证 ==="
for agent in frontend-agent spring-agent java-build-resolver java-reviewer typescript-reviewer; do
  if [ -f ".claude/agents/${agent}.md" ]; then
    echo "✓ ${agent}.md 存在"
    # 检查 YAML frontmatter
    if head -1 ".claude/agents/${agent}.md" | grep -q "^---"; then
      echo "  ✓ YAML frontmatter 完整"
    else
      echo "  ✗ YAML frontmatter 缺失"
    fi
  else
    echo "✗ ${agent}.md 不存在"
  fi
done

# 验证 agent memory
echo ""
echo "=== Agent Memory 验证 ==="
for agent in frontend-agent spring-agent java-build-resolver java-reviewer typescript-reviewer; do
  if [ -d ".claude/agent-memory/${agent}" ]; then
    echo "✓ agent-memory/${agent}/ 存在"
  else
    echo "✗ agent-memory/${agent}/ 不存在"
  fi
done

# 验证 skills
echo ""
echo "=== Skills 验证 ==="
for skill in springboot-patterns dev-process code-reviewer security-review frontend-patterns api-design; do
  if [ -d ".claude/skills/${skill}" ]; then
    echo "✓ ${skill}/ 存在"
  else
    echo "✗ ${skill}/ 不存在"
  fi
done

# 验证 rules
echo ""
echo "=== Rules 验证 ==="
java_rules=("java.md" "spring-boot-rest-api-rules.md")
vue_rules=("vue3.md" "typescript.md")
for rule in "${java_rules[@]}"; do
  [ -f ".claude/rules/${rule}" ] && echo "✓ ${rule} 存在" || echo "✗ ${rule} 不存在"
done
for rule in "${vue_rules[@]}"; do
  [ -f ".claude/rules/${rule}" ] && echo "✓ ${rule} 存在" || echo "✗ ${rule} 不存在"
done

# 验证知识库增强
echo ""
echo "=== 知识库验证 ==="
if grep -q "AI 工具增强配置" ".claude/CLAUDE.md" 2>/dev/null; then
  echo "✓ CLAUDE.md 包含 AI 工具增强配置"
else
  echo "✗ CLAUDE.md 缺少 AI 工具增强配置"
fi

if grep -q "项目特定配置" ".claude/CLAUDE.md" 2>/dev/null; then
  echo "✓ CLAUDE.md 包含项目特定配置"
else
  echo "✗ CLAUDE.md 缺少项目特定配置"
fi
```

---

## 测试用例 2：后端项目（Spring Boot Only）

### 场景描述

初始化一个纯后端 Spring Boot 项目，不涉及前端。

### 前置条件

```bash
mkdir -p /tmp/test-backend/{src/main/{java/com/myapp,resources},src/test/java}
```

### 测试命令

```
请执行 /ivy-tool-setup 为这个 Spring Boot 后端项目初始化 AI 编程工具环境
```

### 预期验证项

| 验证点 | 预期结果 |
|--------|----------|
| **步骤 4 - Agents 部署** | 仅部署 Java 相关 agents：spring-agent、java-build-resolver、java-reviewer |
| **步骤 4 - Agent Memory** | 仅创建 Java 相关 agent-memory 目录 |
| **步骤 5 - Skills 迁移** | 迁移 4 个 skills：springboot-patterns、dev-process、code-reviewer、security-review（不含 frontend-patterns） |
| **步骤 6 - Rules 筛选** | 仅筛选 Java/Spring 相关规则（不含 Vue/React 规则） |
| **Java 包名替换** | com.example → com.myapp |

### 验证脚本

```bash
#!/bin/bash
cd /tmp/test-backend

echo "=== 后端项目验证 ==="

# Agents 验证（不应包含前端 agents）
for agent in spring-agent java-build-resolver java-reviewer; do
  [ -f ".claude/agents/${agent}.md" ] && echo "✓ ${agent}.md" || echo "✗ ${agent}.md"
done

[ ! -f ".claude/agents/frontend-agent.md" ] && echo "✓ frontend-agent.md 正确跳过" || echo "✗ frontend-agent.md 不应存在"

# 包名替换验证
if grep -q "com\.myapp" ".claude/rules/java.md" 2>/dev/null; then
  echo "✓ Java 包名已替换为 com.myapp"
else
  echo "✗ Java 包名替换失败"
fi
```

---

## 测试用例 3：前端项目（React + TypeScript）

### 场景描述

初始化一个纯前端 React + TypeScript 项目，不涉及后端。

### 前置条件

```bash
mkdir -p /tmp/test-frontend/{src/{components,hooks,utils},public}
```

### 测试命令

```
请执行 /ivy-tool-setup 为这个 React + TypeScript 前端项目初始化 AI 编程工具环境
```

### 预期验证项

| 验证点 | 预期结果 |
|--------|----------|
| **步骤 4 - Agents 部署** | 仅部署前端 agents：frontend-agent、typescript-reviewer |
| **步骤 4 - Agent Memory** | 仅创建 frontend-agent 和 typescript-reviewer 的 memory 目录 |
| **步骤 5 - Skills 迁移** | 迁移 4 个 skills：dev-process、code-reviewer、security-review、frontend-patterns（不含 springboot-patterns） |
| **步骤 6 - Rules 筛选** | 筛选 TypeScript 和 React 相关规则（不含 Java 规则） |

### 验证脚本

```bash
#!/bin/bash
cd /tmp/test-frontend

echo "=== 前端项目验证 ==="

# Agents 验证（不应包含后端 agents）
for agent in frontend-agent typescript-reviewer; do
  [ -f ".claude/agents/${agent}.md" ] && echo "✓ ${agent}.md" || echo "✗ ${agent}.md"
done

[ ! -f ".claude/agents/spring-agent.md" ] && echo "✓ spring-agent.md 正确跳过" || echo "✗ spring-agent.md 不应存在"
[ ! -f ".claude/agents/java-build-resolver.md" ] && echo "✓ java-build-resolver.md 正确跳过" || echo "✗ java-build-resolver.md 不应存在"

# Skills 验证
[ -d ".claude/skills/frontend-patterns" ] && echo "✓ frontend-patterns 存在" || echo "✗ frontend-patterns 不存在"
[ ! -d ".claude/skills/springboot-patterns" ] && echo "✓ springboot-patterns 正确跳过" || echo "✗ springboot-patterns 不应存在"
```

---

## 测试用例 4：幂等性测试

### 场景描述

重复执行 skill，验证幂等性保证。

### 测试命令

```
请执行 /ivy-tool-setup（连续执行两次）
```

### 预期验证项

| 验证点 | 预期结果 |
|--------|----------|
| **第二次执行** | 跳过已存在的文件，不报错 |
| **日志输出** | 显示 "⚠️  Skill 已存在: xxx，是否覆盖？" |
| **用户跳过** | 选择 N 后正确跳过，不覆盖现有文件 |

---

## 测试用例 5：错误处理测试

### 场景描述

在异常情况下验证错误处理。

### 测试场景

1. **无 .codebuddy 源目录** - 验证跳过 skills/rules 迁移的提示
2. **无写权限目录** - 验证错误提示
3. **中断后恢复** - 验证部分完成的目录状态

### 预期验证项

| 场景 | 预期结果 |
|------|----------|
| 无源目录 | 输出 "⚠️  未找到 .claude/skills 目录，跳过 skills 迁移"，不报错退出 |
| 部分完成后中断 | 可重新执行完成剩余步骤 |

---

## 测试执行报告模板

```markdown
# AI Tool Project Setup - 测试执行报告

**执行时间:** YYYY-MM-DD HH:MM
**测试人员:** [姓名]
**Skill 版本:** x.x.x

## 测试结果汇总

| 用例 | 状态 | 通过项 | 失败项 |
|------|------|--------|--------|
| TC-1 全栈项目 | ✅/❌ | X/Y | X/Y |
| TC-2 后端项目 | ✅/❌ | X/Y | X/Y |
| TC-3 前端项目 | ✅/❌ | X/Y | X/Y |
| TC-4 幂等性 | ✅/❌ | X/Y | X/Y |
| TC-5 错误处理 | ✅/❌ | X/Y | X/Y |

## 问题记录

### 严重问题 (P0)
1. [问题描述] → [修复建议]

### 一般问题 (P1)
1. [问题描述] → [修复建议]

### 优化建议 (P2)
1. [建议内容]

## 测试结论

- [ ] 可以发布
- [ ] 需要修复后发布
- [ ] 需要迭代优化
```

---

## 快速执行命令

```bash
# 一键创建所有测试环境
./scripts/create-test-env.sh

# 一键运行所有测试
./scripts/run-all-tests.sh

# 清理测试环境
./scripts/cleanup-test-env.sh
```

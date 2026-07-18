# Skills 源文件暂存目录

## 目录说明

本目录用于存放从其他 AI 工具（如 Claude）迁移过来的 skills 源文件。这些文件在迁移过程中会经过**筛选**和**优化**，最终部署到目标工具的 `skills/` 目录。

## 目录用途

### 在 Skill 开发阶段
- 作为**示例参考**，展示可迁移的 skills 结构
- 供开发者了解源 skills 的内容和格式

### 在 Skill 执行阶段
- 当用户运行 `ivy-tool-setup` skill 时
- Skill 会在**目标工具根目录**（如 `.claude/`）下创建 `skills_sources/` 目录
- 从 `.claude/skills/` 拷贝源文件到该暂存目录
- 经过筛选和优化后，部署到 `.claude/skills/`

## 三阶段迁移流程

### 阶段 1: 暂存 (Staging)
```bash
# 拷贝源文件到暂存目录
cp -r .claude/skills/springboot-patterns .claude/skills_sources/
cp -r .claude/skills/security-review .claude/skills_sources/
cp -r .claude/skills/dev-process .claude/skills_sources/
cp -r .claude/skills/code-reviewer .claude/skills_sources/
```

### 阶段 2: 筛选 (Filtering)
根据项目技术栈判断哪些 skills 适用：
- **springboot-patterns**: 项目使用 Spring Boot 时选用
- **security-review**: 项目有安全审计需求时选用
- **dev-process**: 通用，建议始终选用
- **code-reviewer**: 通用，建议始终选用

### 阶段 3: 优化 (Optimization)
使用 `scripts/optimize-skill.sh` 优化每个 skill：
- 更新框架版本号（如 Spring Boot 3.5.0）
- 替换目录路径（如 `backend/`）
- 调整构建命令（如 Maven/Gradle）
- 移除无关技术栈内容
- 添加项目特定上下文

## 当前包含的 Skills

### 1. springboot-patterns
- **适用场景**: Spring Boot 后端项目
- **主要内容**: Spring Boot 开发模式和最佳实践
- **技术栈**: Java, Spring Boot, MyBatis/JPA

### 2. security-review
- **适用场景**: 需要安全审计的项目
- **主要内容**: 安全漏洞检查、代码安全审查
- **技术栈**: 通用（Java, TypeScript, Python 等）

### 3. dev-process
- **适用场景**: 所有项目（通用）
- **主要内容**: 开发流程、Git 工作流、代码审查流程
- **技术栈**: 通用

### 4. code-reviewer
- **适用场景**: 所有项目（通用）
- **主要内容**: 代码审查标准、质量检查清单
- **技术栈**: 通用

## 使用示例

### 手动优化单个 skill
```bash
# 1. 检测项目技术栈
./scripts/detect-tech-stack.sh tech-stack.json

# 2. 优化 skill
./scripts/optimize-skill.sh \
  ./skills_sources/springboot-patterns/SKILL.md \
  tech-stack.json \
  ./.claude/skills/springboot-patterns/SKILL.md
```

### 批量优化所有 skills
```bash
for skill in skills_sources/*/; do
  skill_name=$(basename "$skill")
  ./scripts/optimize-skill.sh \
    "$skill/SKILL.md" \
    tech-stack.json \
    "./.claude/skills/$skill_name/SKILL.md"
done
```

## 注意事项

1. **不要直接修改此目录下的文件** - 这些是源文件，应保持原样
2. **优化后的文件存放在目标目录** - 如 `.claude/skills/`
3. **可以添加新的 skills** - 只需将新 skill 目录拷贝到此处
4. **定期同步源文件** - 当 `.claude/skills/` 更新时，重新拷贝

## 目录结构

```
skills_sources/
├── README.md                    # 本文件
├── springboot-patterns/         # Spring Boot 开发模式
│   └── SKILL.md
├── security-review/             # 安全审查
│   └── SKILL.md
├── dev-process/                 # 开发流程
│   └── SKILL.md
└── code-reviewer/               # 代码审查
    └── SKILL.md
```

## 扩展性

### 添加新的 skill
1. 将新 skill 目录拷贝到此处
2. 在 `SKILL.md` 的步骤五中添加筛选逻辑
3. 更新本 README 的 skills 列表

### 自定义优化规则
编辑 `scripts/optimize-skill.sh`，添加项目特定的优化逻辑。

---

**重要提示**: 本目录是 skill 开发时的示例目录。在实际执行 `ivy-tool-setup` skill 时，会在目标工具根目录（如 `.claude/`）下创建同名的暂存目录。

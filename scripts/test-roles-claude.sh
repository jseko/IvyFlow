#!/bin/bash
# IvyFlow 角色工作流集成测试 — tmux + Claude Code + git worktree
# 使用 claude -p 非交互模式 + git worktree 隔离

set -e

PROJECT="/Users/liuzhupeng/workspace/pubTech/demo/blog-vue-springboot"
IVY="node /Users/liuzhupeng/workspace/vibecoding/IvyFlow/bin/ivy.js"
REPORT_FILE="$PROJECT/docs/ivyflow-role-integration-test.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

cleanup_worktrees() {
  cd "$PROJECT" 2>/dev/null
  git worktree list 2>/dev/null | grep "ivyflow-test-" | awk '{print $1}' | while read -r wt; do
    git worktree remove "$wt" --force 2>/dev/null || true
  done
  git branch 2>/dev/null | grep "ivyflow-test-" | while read -r br; do
    git branch -D "${br##* }" 2>/dev/null || true
  done
}
trap cleanup_worktrees EXIT

cat > "$REPORT_FILE" << EOF
# IvyFlow 角色工作流集成测试报告

> 时间：$TIMESTAMP
> 方式：Claude Code (claude -p) + git worktree 隔离

---

EOF

test_role() {
  local role=$1
  local role_name=$2
  local skill_name=$3
  local prompt=$4
  local worktree_name="ivyflow-test-${role}-$(date +%s)"
  local worktree_path="/tmp/${worktree_name}"

  echo ""
  echo -e "${YELLOW}══════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}  测试角色: ${role_name} (${role})${NC}"
  echo -e "${YELLOW}  预期加载: ${skill_name}${NC}"
  echo -e "${YELLOW}══════════════════════════════════════════════${NC}"

  # 创建 worktree
  echo "  [1/5] 创建 git worktree..."
  cd "$PROJECT"
  git worktree add -b "$worktree_name" "$worktree_path" master 2>&1 | tail -1

  # 确保 .claude 目录存在
  mkdir -p "$worktree_path/.claude"

  # 初始化
  echo "  [2/5] ivy init --role $role..."
  cd "$worktree_path"
  echo "" | timeout 30 $IVY init --quick --overwrite --skip-openspec --platforms claude --role "$role" 2>&1 | tail -1

  # 验证安装
  local cmd_count=$(find .claude/commands -maxdepth 1 -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
  local skill_count=$(find .claude/skills -name "SKILL.md" -type f 2>/dev/null | wc -l | tr -d ' ')
  local project_role=$(grep "role:" .ivy/project.yaml 2>/dev/null | awk '{print $2}')
  echo "  [3/5] 安装验证: commands=$cmd_count skills=$skill_count role=$project_role"

  # 通过 claude -p 非交互模式测试
  echo "  [4/5] Claude Code 工作流测试..."
  local output_file="/tmp/ivyflow-output-${role}.txt"

  cd "$worktree_path"
  timeout 120 claude -p "$prompt" \
    --allowedTools "Read Bash Glob Grep" \
    --output-format text \
    > "$output_file" 2>&1 || true

  # 分析
  echo "  [5/5] 分析结果..."
  local output_lines=$(wc -l < "$output_file" | tr -d ' ')
  local has_skill=$(grep -ci "$skill_name\|phase\|阶段\|工作流\|IvyFlow" "$output_file" 2>/dev/null || echo 0)
  local has_error=$(grep -ci "error\|Error\|failed" "$output_file" 2>/dev/null || echo 0)

  # 报告
  local skill_status="❌"
  [ "$has_skill" -gt 0 ] && skill_status="✅"

  cat >> "$REPORT_FILE" << EOF
## 角色: $role_name (\`$role\`)

| 指标 | 值 |
|------|-----|
| Commands | $cmd_count |
| Skills | $skill_count |
| Role | $project_role |
| Claude 输出行数 | $output_lines |
| 识别 Skill | $skill_status |
| 错误数 | $has_error |

### Claude Code 输出 (前 30 行)

\`\`\`
$(head -30 "$output_file" 2>/dev/null)
\`\`\`

---

EOF

  # 清理
  cd "$PROJECT"
  git worktree remove "$worktree_path" --force 2>/dev/null || true
  git branch -D "$worktree_name" 2>/dev/null || true

  if [ "$has_skill" -gt 0 ]; then
    echo -e "  ${GREEN}✓ 测试通过 (识别到 skill)${NC}"
  else
    echo -e "  ${RED}✗ 未识别到 skill${NC}"
  fi
}

echo "IvyFlow 角色工作流集成测试"
echo "============================"
echo "方式: Claude Code (claude -p) + git worktree"
echo ""

cleanup_worktrees

# 5 个角色测试
test_role "developer" "全栈开发" "ivy-open" \
  "你是一个全栈开发者。请阅读 .claude/skills/ivy/SKILL.md 和 .claude/skills/ivy/ivy-open/SKILL.md，然后告诉我 IvyFlow 的工作流有几个阶段，分别是什么。"

test_role "pm" "产品经理" "pm-collect" \
  "你是一个产品经理。请阅读 .claude/skills/ivy-role-pm/SKILL.md 和 .claude/commands/pmflow.md，然后告诉我产品工作流有几个阶段。"

test_role "qa" "测试工程师" "qa-testcase" \
  "你是一个测试工程师。请阅读 .claude/skills/ivy-role-qa/SKILL.md 和 .claude/commands/qaflow.md，然后告诉我测试工作流有几个阶段。"

test_role "architect" "架构师" "arch-research" \
  "你是一个架构师。请阅读 .claude/skills/ivy-role-architect/SKILL.md 和 .claude/commands/archflow.md，然后告诉我架构设计工作流有几个阶段。"

test_role "devops" "运维/DevOps" "devops-env" \
  "你是一个DevOps工程师。请阅读 .claude/skills/ivy-role-devops/SKILL.md 和 .claude/commands/devopsflow.md，然后告诉我DevOps工作流有几个阶段。"

echo ""
echo "============================"
echo "报告: $REPORT_FILE"

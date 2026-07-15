#!/bin/bash
# IvyFlow 角色工作流集成测试 — tmux + Claude Code + git worktree
# 每个角色在独立 worktree 中测试，互不干扰

set -e

PROJECT="/Users/liuzhupeng/workspace/pubTech/demo/blog-vue-springboot"
IVY="node /Users/liuzhupeng/workspace/vibecoding/IvyFlow/bin/ivy.js"
CLAUDE="claude"
REPORT_FILE="$PROJECT/docs/ivyflow-role-integration-test.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

cleanup_worktrees() {
  echo "清理 worktrees..."
  cd "$PROJECT"
  git worktree list | grep "ivyflow-test-" | awk '{print $1}' | while read -r wt; do
    git worktree remove "$wt" --force 2>/dev/null || true
  done
  git branch | grep "ivyflow-test-" | while read -r br; do
    git branch -D "${br##* }" 2>/dev/null || true
  done
}
trap cleanup_worktrees EXIT

# 初始化报告
cat > "$REPORT_FILE" << EOF
# IvyFlow 角色工作流集成测试报告

> 时间：$TIMESTAMP
> 方式：tmux + Claude Code + git worktree 隔离

---

EOF

test_role() {
  local role=$1
  local role_name=$2
  local cmd=$3
  local prompt=$4
  local worktree_name="ivyflow-test-${role}-$(date +%s)"
  local worktree_path="/tmp/${worktree_name}"
  local session="ivy-${role}-$(date +%s)"

  echo ""
  echo -e "${YELLOW}══════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}  测试角色: ${role_name} (${role})${NC}"
  echo -e "${YELLOW}══════════════════════════════════════════════${NC}"

  # 创建 worktree
  echo "  [1/4] 创建 git worktree: $worktree_path"
  cd "$PROJECT"
  git worktree add -b "$worktree_name" "$worktree_path" master 2>&1 | tail -1

  # 确保 .claude 目录存在
  mkdir -p "$worktree_path/.claude"

  # 初始化 IvyFlow
  echo "  [2/4] 初始化 IvyFlow ($role)..."
  cd "$worktree_path"
  echo "" | timeout 30 $IVY init --quick --overwrite --skip-openspec --platforms claude --role "$role" 2>&1 | tail -2

  # 验证安装
  local cmd_count=$(find .claude/commands -maxdepth 1 -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
  local skill_count=$(find .claude/skills -name "SKILL.md" -type f 2>/dev/null | wc -l | tr -d ' ')
  local rule_count=$(find .claude/rules -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
  local project_role=$(grep "role:" .ivy/project.yaml 2>/dev/null | awk '{print $2}')
  echo "     commands=$cmd_count skills=$skill_count rules=$rule_count role=$project_role"

  # 通过 tmux 启动 Claude Code
  echo "  [3/4] 启动 Claude Code 工作流..."
  local output_file="/tmp/ivyflow-output-${role}.txt"

  tmux new-session -d -s "$session" -c "$worktree_path"
  sleep 1

  # 发送命令
  tmux send-keys -t "$session" "$cmd \"$prompt\"" Enter
  sleep 8

  # 捕获输出
  tmux capture-pane -t "$session" -p -S -50 > "$output_file"

  # 发送退出
  tmux send-keys -t "$session" "/exit" Enter
  sleep 2
  tmux kill-session -t "$session" 2>/dev/null || true

  # 分析输出
  echo "  [4/4] 分析 Claude Code 输出..."
  local output_lines=$(wc -l < "$output_file" | tr -d ' ')
  local has_skill=$(grep -c "SKILL\|skill\|phase\|阶段\|工作流" "$output_file" 2>/dev/null || echo 0)
  local has_error=$(grep -c "Error\|error\|错误\|失败" "$output_file" 2>/dev/null || echo 0)

  # 写入报告
  cat >> "$REPORT_FILE" << EOF
## 角色: $role_name (\`$role\`)

| 指标 | 值 |
|------|-----|
| Worktree | \`$worktree_path\` |
| Commands 安装 | $cmd_count |
| Skills 安装 | $skill_count |
| Rules 安装 | $rule_count |
| project.yaml role | $project_role |
| Claude Code 输出行数 | $output_lines |
| 识别到 skill | $( [ "$has_skill" -gt 0 ] && echo '✅' || echo '❌' ) |
| 错误数 | $has_error |

### Claude Code 输出摘要

\`\`\`
$(head -30 "$output_file")
\`\`\`

---

EOF

  # 清理 worktree
  cd "$PROJECT"
  git worktree remove "$worktree_path" --force 2>/dev/null || true
  git branch -D "$worktree_name" 2>/dev/null || true

  if [ "$has_skill" -gt 0 ] && [ "$has_error" -eq 0 ]; then
    echo -e "  ${GREEN}✓ 测试通过${NC}"
  elif [ "$has_skill" -gt 0 ]; then
    echo -e "  ${YELLOW}⚠ 部分通过（有错误）${NC}"
  else
    echo -e "  ${RED}✗ 测试失败（未识别 skill）${NC}"
  fi
}

echo "IvyFlow 角色工作流集成测试"
echo "============================"
echo "方式: tmux + Claude Code + git worktree"
echo "项目: $PROJECT"
echo ""

# 清理旧 worktrees
cleanup_worktrees

# Test 1: Developer
test_role "developer" "全栈开发" "/ivyflow" "实现一个简单的TODO列表功能，支持添加和删除"

# Test 2: PM
test_role "pm" "产品经理" "/pmflow" "分析一个博客系统的用户需求，目标用户是技术博主"

# Test 3: QA
test_role "qa" "测试工程师" "/qaflow" "为博客系统的登录功能设计测试用例"

# Test 4: Architect
test_role "architect" "架构师" "/archflow" "设计博客系统的整体架构，需要支持高并发访问"

# Test 5: DevOps
test_role "devops" "运维/DevOps" "/devopsflow" "为博客系统搭建 GitHub Actions CI/CD 流水线"

# 汇总
cat >> "$REPORT_FILE" << EOF
## 汇总

| 角色 | Commands | Skills | Rules | Role | 识别 Skill | 错误 |
|------|----------|--------|-------|------|-----------|------|
EOF

echo ""
echo "============================"
echo "所有角色测试完成"
echo "报告: $REPORT_FILE"

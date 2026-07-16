#!/bin/bash
# IvyFlow 角色工作流集成测试 — 通过 tmux 调用 Claude Code
# 用法: bash scripts/test-roles.sh

set -e

TARGET="/Users/liuzhupeng/workspace/pubTech/demo/blog-vue-springboot"
IVY_BIN="node /Users/liuzhupeng/workspace/vibecoding/IvyFlow/bin/ivy.js"
SESSION="ivyflow-test-$(date +%s)"

cleanup() {
  tmux kill-session -t "$SESSION" 2>/dev/null || true
}
trap cleanup EXIT

test_role() {
  local role=$1
  local cmd=$2
  local prompt=$3

  echo ""
  echo "══════════════════════════════════════════════"
  echo "  测试角色: $role"
  echo "  命令: $cmd"
  echo "  提示: $prompt"
  echo "══════════════════════════════════════════════"

  # Clean previous install
  rm -rf "$TARGET/.claude/commands" "$TARGET/.claude/skills/ivy" "$TARGET/.claude/skills/ivy-role-"* "$TARGET/.claude/rules" "$TARGET/.ivy" 2>/dev/null

  # Init with role
  echo "  [1/3] 初始化 $role 角色..."
  cd "$TARGET"
  echo "" | timeout 30 $IVY_BIN init --quick --overwrite --skip-openspec --platforms claude --role "$role" 2>&1 | tail -3

  # Verify installation
  echo "  [2/3] 验证安装..."
  local cmd_count=$(find "$TARGET/.claude/commands" -maxdepth 1 -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
  local skill_count=$(find "$TARGET/.claude/skills" -name "SKILL.md" -type f 2>/dev/null | wc -l | tr -d ' ')
  local rule_count=$(find "$TARGET/.claude/rules" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
  local project_role=$(grep "role:" "$TARGET/.ivy/project.yaml" 2>/dev/null | awk '{print $2}')
  echo "     commands=$cmd_count skills=$skill_count rules=$rule_count role=$project_role"

  # Test Claude Code with the command
  echo "  [3/3] 启动 Claude Code 工作流..."
  tmux new-session -d -s "$SESSION" -c "$TARGET"
  tmux send-keys -t "$SESSION" "cd $TARGET && $cmd \"$prompt\"" Enter
  sleep 3
  # Capture initial output
  tmux capture-pane -t "$SESSION" -p | tail -20
  sleep 5
  tmux capture-pane -t "$SESSION" -p | tail -30

  # Send exit
  tmux send-keys -t "$SESSION" "/exit" Enter
  sleep 2
  tmux kill-session -t "$SESSION" 2>/dev/null || true
}

echo "IvyFlow 角色工作流集成测试"
echo "============================"
echo ""

# Test 1: Developer
test_role "developer" "/ivyflow" "实现一个简单的TODO列表功能，支持添加和删除"

# Test 2: PM
test_role "pm" "/pmflow" "分析一个博客系统的用户需求，目标用户是技术博主"

# Test 3: QA
test_role "qa" "/qaflow" "为博客系统的登录功能设计测试用例"

# Test 4: Architect
test_role "architect" "/archflow" "设计博客系统的整体架构，需要支持高并发访问"

# Test 5: DevOps
test_role "devops" "/devopsflow" "为博客系统搭建 GitHub Actions CI/CD 流水线"

echo ""
echo "============================"
echo "所有角色测试完成"

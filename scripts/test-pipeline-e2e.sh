#!/bin/bash
# IvyFlow Pipeline 端到端测试 — tmux + Claude Code + git worktree
# 完整流程: init → pipeline start → PM → Developer → QA → DevOps

set -e

PROJECT="/Users/liuzhupeng/workspace/pubTech/demo/blog-vue-springboot"
IVY="node /Users/liuzhupeng/workspace/vibecoding/IvyFlow/bin/ivy.js"
TIMESTAMP=$(date +%s)
WORKTREE="/tmp/ivyflow-pipeline-test-$TIMESTAMP"
REPORT="$PROJECT/docs/ivyflow-pipeline-e2e-test.md"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

cleanup() {
  cd "$PROJECT" 2>/dev/null
  git worktree remove "$WORKTREE" --force 2>/dev/null || true
  git branch -D "ivyflow-pipeline-test-$TIMESTAMP" 2>/dev/null || true
}
trap cleanup EXIT

cat > "$REPORT" << EOF
# IvyFlow Pipeline 端到端测试报告

> 时间: $(date '+%Y-%m-%d %H:%M:%S')
> 方式: tmux + Claude Code + git worktree

---

EOF

step() {
  echo -e "${YELLOW}[$1]${NC} $2"
}

# 创建 worktree
step "1/5" "创建 git worktree..."
cd "$PROJECT"
git worktree add -b "ivyflow-pipeline-test-$TIMESTAMP" "$WORKTREE" master 2>&1 | tail -1
mkdir -p "$WORKTREE/.claude"

# Init
step "2/5" "ivy init（全量安装所有角色）..."
cd "$WORKTREE"
echo "" | timeout 30 $IVY init --quick --overwrite --skip-openspec --platforms claude 2>&1 | grep "Claude Code:"
echo "  commands: $(find .claude/commands -maxdepth 1 -name '*.md' -type f | wc -l)"
echo "  skills: $(find .claude/skills -name 'SKILL.md' -type f | wc -l)"

# Pipeline start
step "3/5" "ivy pipeline start..."
PIPELINE_OUT=$(cd "$WORKTREE" && $IVY pipeline start "端到端测试-用户登录" 2>&1)
echo "$PIPELINE_OUT"
INITIAL_ROLE=$(echo "$PIPELINE_OUT" | grep "当前角色" | awk '{print $2}')

# Stage 1: PM (via Claude Code)
step "4/5" "Claude Code — PM 需求分析..."
cd "$WORKTREE"
SESSION="ivy-pm-$TIMESTAMP"
tmux new-session -d -s "$SESSION" -c "$WORKTREE"
sleep 1
tmux send-keys -t "$SESSION" "cd $WORKTREE && claude -p '你是产品经理。请阅读 .claude/commands/pmflow.md，然后用一句话告诉我产品工作流有几个阶段，分别是什么。'" Enter
sleep 30
tmux capture-pane -t "$SESSION" -p -S -30 > /tmp/ivy-pm-output.txt
tmux send-keys -t "$SESSION" C-c
sleep 2
tmux kill-session -t "$SESSION" 2>/dev/null || true

PM_OUTPUT=$(cat /tmp/ivy-pm-output.txt)
PM_OK=$(echo "$PM_OUTPUT" | grep -c "collect\|analyze\|prd\|review\|accept" || echo 0)

# Complete PM stage
cd "$WORKTREE"
echo "" | $IVY pipeline complete requirements 2>&1 > /dev/null
CURRENT_ROLE=$(grep "role:" .ivy/project.yaml | awk '{print $2}')

# Stage 2: Developer (via Claude Code)
step "5/5" "Claude Code — Developer 编码..."
SESSION2="ivy-dev-$TIMESTAMP"
tmux new-session -d -s "$SESSION2" -c "$WORKTREE"
sleep 1
tmux send-keys -t "$SESSION2" "cd $WORKTREE && claude -p '你是全栈开发者。请阅读 .claude/commands/ivyflow.md，然后用一句话告诉我开发工作流有几个阶段，分别是什么。'" Enter
sleep 30
tmux capture-pane -t "$SESSION2" -p -S -30 > /tmp/ivy-dev-output.txt
tmux send-keys -t "$SESSION2" C-c
sleep 2
tmux kill-session -t "$SESSION2" 2>/dev/null || true

DEV_OUTPUT=$(cat /tmp/ivy-dev-output.txt)
DEV_OK=$(echo "$DEV_OUTPUT" | grep -c "open\|design\|build\|verify\|archive" || echo 0)

# Complete Developer stage
cd "$WORKTREE"
echo "" | $IVY pipeline complete coding 2>&1 > /dev/null

# Final status
FINAL_STATUS=$(cd "$WORKTREE" && $IVY pipeline status 2>&1)

# Report
cat >> "$REPORT" << EOF
## 测试结果

### Stage 1: PM 需求分析

- 初始角色: $INITIAL_ROLE
- Claude 识别 PM 工作流: $([ "$PM_OK" -gt 0 ] && echo '✅' || echo '❌')

### Stage 2: Developer 编码

- Pipeline 切换后角色: $CURRENT_ROLE
- Claude 识别 Developer 工作流: $([ "$DEV_OK" -gt 0 ] && echo '✅' || echo '❌')

### 最终 Pipeline 状态

\`\`\`
$FINAL_STATUS
\`\`\`

### Claude Code PM 输出

\`\`\`
$PM_OUTPUT
\`\`\`

### Claude Code Developer 输出

\`\`\`
$DEV_OUTPUT
\`\`\`

---

EOF

echo ""
echo "============================"
echo -e "${GREEN}测试完成${NC}"
echo "报告: $REPORT"
cat "$REPORT"
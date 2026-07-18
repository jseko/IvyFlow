#!/bin/bash
#
# AI Tool Project Setup - 测试环境清理脚本
#

TEST_BASE="/tmp/ai-tool-setup-tests"

if [ -d "$TEST_BASE" ]; then
    echo "清理测试目录: $TEST_BASE"
    rm -rf "$TEST_BASE"
    echo "✓ 清理完成"
else
    echo "测试目录不存在，无需清理"
fi

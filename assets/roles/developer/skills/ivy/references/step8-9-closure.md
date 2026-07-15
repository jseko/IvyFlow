# 步骤八~九：收尾与归档

> 对应 SKILL.md 章节：步骤八（实现报告）/ 步骤九（归档确认）

**使用时机**：当 AI 进入步骤八或九时，读取本文件获取完整的收尾归档规范。

---

## 步骤八：生成功能实现报告

功能确认完成后，生成实现报告，写入 `openspec/changes/{提案名称}/implementation-report.md`。

**完整的报告内容模板** → 参见 [`templates/implementation-report.md`](../templates/implementation-report.md)

**成功标准**：报告文件已生成，所有章节内容完整，数据准确。

---

## 步骤九：【强确认节点】归档确认

> ⏸️ **强确认：等待用户确认，跳过确认会导致需求理解和实现方向偏差。**

> **降级策略**：仅当用户在**本轮对话**明确指示"自动执行"或处于 CI/CD 自动化场景时，才允许跳过归档确认；不得基于历史偏好、模糊语义或模型自行判断跳过。触发后：
> 1. 跳过确认，直接执行归档前检查
> 2. 检查通过后自动归档
> 3. 输出归档路径和状态

```
✅ 功能实现报告已生成：openspec/changes/{提案名称}/implementation-report.md

请选择完成操作：
- [1. 归档到本地] → 执行归档前检查，通过后归档到本地 `openspec/archive/`
- [2. 推送并创建 PR] → 归档前检查 + 全量测试通过 → git push + 创建 Pull Request
- [3. 保留当前状态] → 流程结束，文档和代码保留在当前位置，可稍后继续
- [4. 丢弃本次变更] → 需要输入 'discard' 确认，删除 change 目录并回滚代码变更
```

### 9.1 选项处理

**选项 1：归档到本地**

执行归档前检查，通过后执行 `openspec archive {提案名称}`。

**选项 2：推送并创建 PR**

前置条件：全量测试通过 + 归档前检查通过。通过后依次执行：
```bash
git push -u origin $(git rev-parse --abbrev-ref HEAD)
gh pr create --title "{PR 标题}" --body "$(cat <<'EOF'
## Summary
{实现摘要}

## Test plan
- [ ] 编译通过
- [ ] 单元测试通过
- [ ] 集成测试通过
EOF
)"
```

**选项 3：保留当前状态**

保留 change 目录和所有代码变更，流程结束。可稍后继续或手动归档。

**选项 4：丢弃本次变更**

需用户输入 `discard` 二次确认。确认后：
1. 删除 `openspec/changes/{提案名称}/` 目录
2. `git checkout -- .` 回滚所有代码变更
3. `git clean -fd` 清理未跟踪文件

⚠️ 此操作不可逆。

### 9.2 归档前自动检查

- [ ] `proposal.md` / `design.md` / `implementation-report.md` 内容完整
- [ ] `tasks.md` 中所有实现任务均标记 `[x]`
- [ ] 最终构建命令通过
- [ ] `{ENABLE_CODE_REVIEW}=on` 时：`review-001.md` 已生成，CRITICAL/HIGH 已修复
- [ ] `{ENABLE_UNIT_TEST}=on` 时：`tasks.md` 测试任务均 `[x]`，`test-cases.md` 已生成，测试全部通过

> 开关关闭时对应检查项自动跳过。全部通过后执行 `openspec archive {提案名称}`。

**归档成功后提示**：

```
✅ 归档成功

- 提案名称：{提案名称}
- 归档时间：{时间}
- 变更文件：X 个
{- 测试用例：X 个（全部通过）  ← 仅 ENABLE_UNIT_TEST=on 时显示}
{- 代码审查：CRITICAL 0 个，HIGH 0 个  ← 仅 ENABLE_CODE_REVIEW=on 时显示}

✅ 开发流程已完成并归档
```

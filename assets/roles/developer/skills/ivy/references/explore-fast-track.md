# 探索快速通道

> 对应 SKILL.md 章节：探索快速通道（最高优先级）

**使用时机**：当 AI 检测到用户输入包含探索关键词时，读取本文件获取完整流程规范。

---

## 触发条件

用户输入包含以下任一关键词时，**立即走快速通道**：

| 关键词 | 示例 |
|--------|------|
| `探索` | "请先探索"、"探索一下"、"帮我探索这个需求" |
| `交互式` | "用交互式方式"、"一步一步来" |
| `/opsx:propose` | 直接调用 OpenSpec propose |

## 快速通道流程

```
检测到探索关键词
  → P0 自动完成（P0.1 读取项目画像文档 + P0.2 校验画像 + 必要时 P0.2.Fallback 自动检测，跳过 P0.3 用户交互，默认 standard）
  → P1/P3 openspec 验证（安装 + 初始化检查）
  → 步骤 A：提炼英文提案名称（kebab-case，规则同步骤 1.1）
  → 步骤 B：使用 Skill 工具调用 opsx:propose 生成 OpenSpec 初稿：
      Skill(skill="opsx:propose", args="{用户原始需求}；请基于现有信息生成 proposal/design/specs/tasks 初稿，并将不确定项写入待确认事项")
      opsx:propose 基于用户原始需求和代码检索结果自动生成所有 artifacts 初稿
  → 步骤 C：验证初稿 artifacts 完整性：
      openspec status --change "{提案名称}"
  → 🔴 步骤 D：Brainstorming 交互修订入口（核心环节，不可跳过，除非用户显式跳过）
      **步骤 D 前置**：读取已生成的 proposal.md / design.md / specs/**/*.md / tasks.md，
      提取关键假设、待确认事项、方案分歧和 G1-G5 高频遗漏场景（详见 `references/agent-specs.md` §4.X）。
      使用 AskUserQuestion 工具，围绕初稿中的以下维度向用户提问（1-4 个问题）：
        - 初稿关键假设是否成立
        - 核心方案选型（如：检测策略、展示形式、存储方案、AI 工具识别）
        - 范围边界确认（明确 V1 做什么、不做什么）
        - 验收标准和测试优先级确认
      提问原则：
        - 每个问题 2-4 个选项，标注推荐项
        - 选项必须引用初稿中的具体章节/决策点
        - 覆盖对后续设计和 tasks.md 有重大影响的决策点
        - 不询问初稿已明确且低风险的细节
  → 步骤 E：将 Brainstorming 选择反写到 artifacts
      更新 proposal.md / design.md / specs/**/*.md / tasks.md / test-cases.md（如已生成）
      删除或关闭已解决的待确认事项，保留未解决项并标注 NEEDS_USER_INPUT
  → 全部 artifacts done 后，回到标准流程步骤二（提案文档确认）
```

## 关键设计决策

`opsx:propose` 负责快速生成一套可审查的 OpenSpec 初稿，Brainstorming 的输入必须是这套初稿，而不是空白需求。这样用户可以围绕具体 proposal/design/specs/tasks 进行选择和修订，避免纯口头澄清发散。

## 关键行为

1. **P0.3 自动设为 `standard`**：不询问用户选择执行模式
2. **P0 输出简洁版**：仅输出变量汇总，不等待用户确认
3. **🔴 步骤 D — Brainstorming 交互修订（默认执行）**：
   - 在 `opsx:propose` 生成 proposal/design/specs/tasks 初稿后，读取初稿并提取关键假设、待确认事项和方案分歧
   - 使用 `AskUserQuestion` 工具向用户提问，收集对初稿的修订决策
   - 提问维度根据初稿内容动态调整，覆盖核心方案选型、范围边界、验收标准、测试优先级
   - **禁止**在 artifacts 生成前执行 Brainstorming 作为空白需求澄清；Brainstorming 必须基于初稿进行
   - 用户回答后，将其选择反写到对应 artifacts，再进入步骤二确认
4. **🔴 步骤 B — 委托 opsx:propose 生成初稿（必须通过 Skill 工具）**：
   - 使用 `Skill(skill="opsx:propose", args="{原始需求；请生成初稿并标注待确认事项}")` 发起调用
   - **禁止**主 agent 手动执行 `openspec new change`、`openspec instructions`、逐文件 Write 等操作
   - **禁止**读取模板文件后手动填充——这些由 `opsx:propose` skill 内部处理
   - `opsx:propose` 会自动处理 change 已存在的情况（补全缺失 artifacts，不询问用户）
5. **Brainstorming 完成后的回落 —— 🔴 必须展示步骤二确认模板**：`opsx:propose` skill 执行完毕、Brainstorming 修订完成后：
   - 执行 `openspec status --change "{提案名称}"` 验证文件完整性
   - **🔴 必须立即展示步骤二的完整确认模板**（见 SKILL.md 步骤二章节），包含：
     - 文档路径清单（proposal / design / specs / tasks 的路径和一句话描述）
     - 审查指引（每个文档关注什么）
     - 明确的回复选项（`[确认无误]` / `[需要修改]`）
   - **严禁**只说"探索完成，请查看文档"或"全部 artifacts 已生成"就停止——这等于把审查责任丢给用户自行理解
   - **严禁**在展示确认模板之前做任何其他操作（如 skill 优化、闲聊等），确认模板是探索阶段与实现阶段之间的唯一合法出口

## 例外：用户同时指定了执行模式

若用户明确说 "用 quick 模式探索"，则使用用户指定的模式，不自动设为 standard。

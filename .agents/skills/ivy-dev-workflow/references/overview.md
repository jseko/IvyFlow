# 变更总览、ADR 与风险矩阵

> v3.2 新增：文件结构变更总览、架构决策记录摘要、风险与缓解矩阵。

---

## §11 文件结构变更总览

### v3.2 完整目录树

```
.chat/v1/ivy-dev-workflow/
├── SKILL.md                              # 🔧 核心文件，多处修改
├── references/
│   ├── agent-mapping.md                  # 🔧 补充代码智能层接口
│   ├── agent-specs.md                    # ✨ v3.2 新增（§4/§6/§7/§5.4）
│   ├── ascii-diagram-conventions.md      # ✨ v3.2 新增
│   ├── build-commands.md                 # 不变
│   ├── code-intelligence-layer.md        # ✨ v3.2 新增（§2/§10.2）
│   ├── cross-cutting.md                  # ✨ v3.2 新增（§8/§9/§10）
│   ├── detection-rules.md                # 不变
│   ├── extensibility-guide.md            # 不变
│   ├── overview.md                       # ✨ v3.2 新增（§11/§12/§13）
│   ├── paths-config.md                   # 不变
│   ├── playwright-conventions.md         # ✨ v3.2 新增
│   ├── d2c-component-conventions.md      # ✨ v3.2 新增
│   └── tool-mapping.md                   # 不变
├── templates/
│   ├── proposal-template.md              # 🔧 追加业务流程图章节
│   ├── design-template.md                # 不变
│   ├── spec-template.md                  # 🔧 追加 Scenario/Rule/Boundary/Exception
│   ├── tasks-template.md                 # 不变
│   ├── test-cases-prompt.md              # 🔧 追加 E2E 层
│   ├── review-prompt.md                  # 不变
│   ├── build-resolver.md                 # 不变
│   ├── test-code-prompt.md               # 不变
│   └── implementation-report.md          # 🔧 追加三个附录
├── security/                             # ✨ v3.2 新增目录
│   ├── sensitive-data-rules.md           # ✨ v3.2 新增
│   ├── prompt-injection-patterns.md      # ✨ v3.2 新增
│   └── static-scan-rules.md             # ✨ v3.2 新增
├── design/                               # ✨ v3.2 新增目录
│   └── adr/                              # ✨ v3.2 新增目录
│       ├── README.md                     # ✨ v3.2 新增
│       ├── ADR-001-requirement-agent.md  # ✨ v3.2 新增
│       ├── ADR-002-plan-agent-trigger.md # ✨ v3.2 新增
│       ├── ADR-003-gitnexus-soft-dep.md  # ✨ v3.2 新增
│       ├── ADR-004-switch-to-mode.md     # ✨ v3.2 新增
│       ├── ADR-005-security-boundary.md  # ✨ v3.2 新增
│       └── ADR-006-token-optimization.md # ✨ v3.2 新增
└── knowledge/                            # ✨ v3.2 新增目录
    ├── README.md                         # ✨ v3.2 新增
    ├── business/
    │   └── .gitkeep                      # ✨ v3.2 新增
    ├── dev/
    │   └── naming-conventions.md         # ✨ v3.2 新增
    ├── topology/
    │   └── .gitkeep                      # ✨ v3.2 新增
    └── memory/
        ├── INDEX.md                      # ✨ v3.2 新增
        └── archive/
            └── .gitkeep                  # ✨ v3.2 新增
```

**图例**：🔧 修改 | ✨ 新增 | 不变 = 无标记

### 分层说明

| 目录 | 用途 | 维护方式 |
|------|------|---------|
| `design/adr/` | 架构决策记录，记录关键设计选择及理由 | 一次性写入，后续不自动更新 |
| `knowledge/business/` | 业务领域知识（术语、流程规则、领域模型） | 按项目迭代逐步填充 |
| `knowledge/dev/` | 开发技术知识（命名规范、编码约定） | 预留用户扩展空间 |
| `knowledge/topology/` | 系统拓扑知识（服务拓扑、模块依赖、接口契约） | 架构变更时更新 |
| `knowledge/memory/` | 记忆引擎检索入口，存储历史实现摘要 | 每次归档时自动追加 |
| `knowledge/memory/archive/` | 超过 6 个月的过期记忆归档 | 自动归档，不参与检索 |

---

## §12 架构决策记录（ADR）

> 详细 ADR 文件位于 `design/adr/` 目录。

### ADR 摘要表

| ADR | 决策 | 选项 | 选择 | 核心理由 |
|-----|------|------|------|---------|
| ADR-001 | 需求分析 Agent | 独立 Agent vs 主 Agent | **主 Agent** | 需求来自对话，独立 Agent 两次传递丢失微妙上下文 |
| ADR-002 | 设计阶段 Agent | 全部主 Agent vs 全部 Plan Agent vs 混合 | **混合（条件触发）** | 小/中型无需额外 Agent；大型 Plan Agent 展开更完整 |
| ADR-003 | GitNexus 依赖 | 硬依赖 vs 软依赖 | **软依赖 + 统一 Fallback** | 工具不可用时流程不可中断 |
| ADR-004 | 开关体系 | 7 个独立开关 vs 执行模式 | **执行模式（3 种）** | 减少认知负担，模式内自动推导子开关 |
| ADR-005 | 安全扫描 | AI 模拟 vs 集成 SAST | **AI 模拟（标注局限）** | 集成真实 SAST 超出 skill 范围；须声明局限性 |
| ADR-006 | Token 优化 | 全量注入 vs 按需引用 | **按需引用 + 上下文裁剪** | 全量注入造成上下文膨胀，agentic 工作流中代价平方级 |

### ADR 格式标准

每个 ADR 文件遵循统一格式（详见 `design/adr/README.md`）：

```markdown
# ADR-00X: {决策标题}

**状态：** 已采纳
**日期：** 2026-05-29
**决策者：** AI (评审优化)

## 上下文
{问题描述，为什么需要做决策}

## 决策
{最终选择}

## 选项对比
| 选项 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| ... | ... | ... | ... |

## 后果
{正面/负面/注意事项}
```

---

## §13 风险与缓解矩阵

### 风险矩阵

| 风险 | 概率 | 影响 | 缓解措施 | 关联章节 |
|------|------|------|---------|---------|
| GitNexus Index 过期 | 中 | 中 | P0.4 检测新鲜度，stale 时标注结果，不阻断流程 | §2 |
| GitNexus MCP 工具不可用 | 低 | 低 | 代码智能层统一 Fallback，单点处理，不重复声明 | §2 |
| 多 Agent 并行输出不一致 | 中 | 中 | 接口契约在 design.md 中定义，主 Agent 一致性校验 | 步骤三 |
| 并行 Agent 整组失败 | 低 | 高 | 重试 → 降级 → 暂停报告用户（三步策略） | 步骤三 3.2 |
| **AI 安全扫描误报/漏报** | **高** | **高** | 报告中显著标注"非 SAST 级别"，建议专业工具复核 | §8 |
| Token 成本超预期 | 中 | 中 | §9 设置告警阈值（1.2x 预警/1.5x 超标/2x 严重超标）；4 项优化策略 | §9 |
| 记忆库膨胀成垃圾堆 | 中 | 中 | 检索阈值 ≥ 2 标签、去重归并（相似度 > 80%）、6 个月过期归档 | §10 |
| 上下文窗口耗尽 | 中 | 高 | 步骤间上下文压缩摘要；大任务建议拆分；上下文累积系数 1.4x | §9 |
| D2C 前端代码质量不稳定 | 中 | 中 | 生成后人工审查门禁；frontend-agent 加验收 Checklist | `references/d2c-component-conventions.md` |

### 风险等级可视化

```
高影响  │  [并行整组失败]  [上下文耗尽]  [AI扫描误报/漏报]
        │  [多Agent不一致]
        │
中影响  │  [Token超预期]   [记忆库膨胀]  [D2C质量不稳定]
        │  [Index过期]
        │
低影响  │  [MCP工具不可用]
        │
        └──────────────────────────────────────────────
           低概率          中概率          高概率
```

### 注意事项

- 风险矩阵为静态文档，版本升级时需人工复核
- AI 安全扫描误报/漏报风险最高（高概率 × 高影响），需在 §8 和 `security/static-scan-rules.md` 中重复声明
- 上下文窗口耗尽的风险随项目规模增长而升高，建议在 Agent 调用中持续监控

---

## 完整流程状态机

```
用户输入需求
    │
    ▼
[P0] 扫描项目配置文件，检测技术栈，设置核心变量
    │   ⚠️ 仅读取 pom.xml/package.json/目录结构，不读取业务代码
    │   检测失败 → 询问用户手动输入 → 验证后继续
    ▼
[P0.3] 用户选择执行模式（quick / standard / full）
    │   8 个子开关由系统自动推导
    ▼
[P0.4] 自动检测 CI_MODE / E2E_FRAMEWORK / PROJECT_TYPE
    │   初始化代码智能层
    ▼

[P1] 验证 openspec 已安装
    │   未安装 → [P2] 确认工具选择 → 安装
    │               失败 → 权限/版本/网络三类处理
    ▼
[P3] 验证项目已初始化
    │   未初始化 → openspec init --tools {工具名}
    ▼
[步骤一] 生成 proposal + design + specs + tasks
    │        test-cases.md（仅 ENABLE_UNIT_TEST=on）
    │        ⚠️ 此阶段不创建/修改任何业务代码文件
    ▼
[步骤二] ⏸️ 用户确认文档 ──→ 有问题 ──→ 修复（最多 3 轮）──┐
    │ 确认无误                                              │
    │ ◀─────────────────────────────────────────────────────┘
    ▼
[关卡] 🔒 检查 proposal.md / design.md / specs/ / tasks.md 全部存在且已确认
    │   ❌ 任一缺失 → 返回步骤一
    │   ✅ 全部就绪 → 进入步骤三
    ▼
[步骤三] 代码实现
    │        ⚠️ 已有代码按 tasks.md 逐任务审查/补全/修复
    │        根据文件类型自动分派 Agent：
    │        *.java → Task(spring-agent)、*.vue/*.js → Task(frontend-agent)
    │        无可用的专用 Agent → 主 agent fallback（输出 ⚠️ 日志）
    │        逐任务执行 → 立即标记 [x]，歧义暂停询问
    ▼
[步骤四] ENABLE_CODE_REVIEW=off → ⏭️ 跳过
    │       ENABLE_CODE_REVIEW=on → Task(java-reviewer) 审查后端
    │                              Task(typescript-reviewer) 审查前端
    │                              生成 review-001.md → 修复 CRITICAL/HIGH
    ▼
[步骤五] 按 {BUILD_TOOL} + {PROJECT_TYPE} 动态生成编译命令
    │         失败 → 分类诊断修复（最多 3 轮）→ build-resolver-001.md
    ▼
[步骤六] ENABLE_UNIT_TEST=off → ⏭️ 跳过
    │       ENABLE_UNIT_TEST=on → 对照 test-cases.md 补全测试代码
    │                            按 {BUILD_TOOL} 执行：单元测试 → 集成测试 → 组件测试
    │                            失败 → 修复 → 可选覆盖率检查 → 最终全量构建
    ▼
[步骤七] ⏸️ 用户确认功能 ──→ 需优化 ──→ 修复+编译+测试 ──┐
    │ 功能完成                                               │
    │ ◀──────────────────────────────────────────────────────┘
    ▼
[步骤八] 生成 implementation-report.md
    │         含项目配置、测试覆盖统计、变更文件清单
    ▼
[步骤九] ⏸️ 用户确认归档 ──→ 暂不归档 ──→ 流程结束
    │ 立即归档 → 自动检查清单 → 全部通过
    ▼
/opsx:archive {提案名称} → 完成 ✅
```

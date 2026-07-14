# IvyFlow Init 角色系统测试报告

> 日期：2026-07-14 | 测试项目：blog-vue-springboot

---

## 一、测试环境

| 项目 | 值 |
|------|-----|
| IvyFlow 版本 | 0.14.0 |
| 二进制 | `bin-out/ivyflow-0.14.0-darwin-aarch64` (62MB) |
| 测试项目 | `/Users/liuzhupeng/workspace/pubTech/demo/blog-vue-springboot` |
| 平台 | Claude Code (macOS arm64) |
| 内嵌 assets | 123 个文件 |

---

## 二、功能验证结果

### ✅ 已通过

| 功能 | 状态 | 说明 |
|------|------|------|
| `--version` | ✅ | 正确输出 `0.14.0` |
| `init --help` | ✅ | 显示 `--role` 参数 |
| `init --quick` (developer) | ✅ | 安装 18 skills + 3 rules + 5 commands |
| `role` 字段写入 project.yaml | ✅ | 正确写入对应角色值 |
| `init --role pm` | ✅ | project.yaml 中 `role: pm` |
| `init --role qa` | ✅ | project.yaml 中 `role: qa` |
| `init --role architect` | ✅ | project.yaml 中 `role: architect` |
| `init --role devops` | ✅ | project.yaml 中 `role: devops` |
| 语言指令写入 CLAUDE.md | ✅ | `请始终使用中文回复。` |
| Git hooks 安装 | ✅ | pre-push + post-commit |
| 能力包安装 | ✅ | code-intelligence + testing |
| 技术栈自动检测 | ✅ | 展示检测到的语言/框架 |
| 完成指引展示 | ✅ | 显示已安装能力和平台 |
| TypeScript 编译 | ✅ | 零错误 |
| 单元测试 | ✅ | 977/977 通过 |
| RoleRegistry | ✅ | 6 个测试全部通过 |

### ❌ 存在问题

| 问题 | 严重程度 | 说明 |
|------|---------|------|
| **非 developer 角色 commands 未安装** | 🔴 高 | PM/QA/Architect/DevOps 角色选择后，commands 目录下没有对应命令文件（如 pmflow.md） |
| **非 developer 角色 skills 未安装** | 🟡 中 | 角色特有的 phase skills（如 pm-collect/SKILL.md）未安装到 `.claude/skills/` |
| **二进制中 rules 读取失败** | 🔴 高 | 嵌入式模式下 `copyIvyRulesForPlatform` 仍从磁盘读取，导致 "Rule source not found" 错误 |
| **二进制中 commands 读取失败** | 🔴 高 | 嵌入式模式下 `copyIvyCommandsForPlatform` 的 `readAssetFile` 函数存在但未被正确调用 |

---

## 三、根因分析

### 问题 1：非 developer 角色安装逻辑不完整

`installForOnePlatform` 中已添加了 role 参数和分支逻辑：
- Developer 角色：安装 skills + rules + commands + capabilities
- 其他角色：只安装 commands + capabilities + role SKILL.md

但二进制打包时 `skills.ts` 被 git checkout 回退了嵌入式模式支持的代码，导致：
- `readManifest` 从磁盘读取而非嵌入式 registry
- `copyIvySkillsForPlatform` 的 `fileExists` 检查从磁盘读取
- `copyIvyRulesForPlatform` 的源路径仍指向磁盘

### 问题 2：嵌入式模式支持不完整

以下函数缺少嵌入式模式（`isEmbeddedMode()`）支持：
- `readManifest` — ✅ 已修复（最新代码）
- `copyIvySkillsForPlatform` — ✅ 已修复（最新代码）
- `copyIvyRulesForPlatform` — ❌ 未修复，仍从磁盘读取
- `copyIvyCommandsForPlatform` — ✅ 已添加嵌入式模式

---

## 四、资产文件统计

| 角色 | role.yaml | SKILL.md | prompt/ | phase skills | commands/ | 合计 |
|------|-----------|----------|---------|-------------|-----------|------|
| developer | 1 | 1 | 3 | 8 (+10 refs) | 5 | 28 |
| pm | 1 | 1 | 3 | 6 | 3 | 14 |
| qa | 1 | 1 | 2 | 6 | 3 | 13 |
| architect | 1 | 1 | 2 | 5 | 3 | 12 |
| devops | 1 | 1 | 2 | 6 | 3 | 13 |
| common | — | — | — | — | 3 | 3 |
| workflows | — | — | — | — | — | 5 |
| templates | — | — | — | — | — | 3 |
| **总计** | **5** | **5** | **12** | **31** | **20** | **91** |

---

## 五、修复建议

### 立即修复（阻塞二进制发布）

1. `copyIvyRulesForPlatform` 添加嵌入式模式支持：
   - 规则源路径从 `assets/roles/developer/rules/` 读取
   - 嵌入式模式下从 `globalThis.__ivyflow_assets` 读取

2. `installForOnePlatform` 中 commands 安装确认使用嵌入式模式：
   - 当前 `copyIvyCommandsForPlatform` 已添加嵌入式支持，需确认打包后的二进制中生效

### 后续优化

3. 非 developer 角色的 phase skills 安装到平台目录
4. 按 role 过滤能力包安装（PM 不需要 testing capability）
5. 非 developer 角色跳过 OpenSpec 安装（PM/QA 不需要）

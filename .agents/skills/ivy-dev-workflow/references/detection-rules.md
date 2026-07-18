# 项目画像解析与技术栈检测规则

> 供 P0 阶段参考。优先从项目文档读取技术栈画像；仅在缺失、冲突、过期或用户要求时，从配置文件自动推断核心变量。

---

## 核心变量定义

| 变量名 | 说明 | 示例值 |
|-------|------|-------|
| `{PROJECT_TYPE}` | 项目类型 | `monorepo` / `backend-only` / `frontend-only` / `fullstack` |
| `{BACKEND_DIR}` | 后端代码目录 | `backend/` / `server/` / `src/` / `.` |
| `{FRONTEND_DIR}` | 前端代码目录 | `frontend/` / `client/` / `web/` / `.` |
| `{BACKEND_STACK}` | 后端技术栈 | `spring-boot` / `express` / `nestjs` / `django` / `go` / `rust` |
| `{FRONTEND_STACK}` | 前端技术栈 | `vue3` / `vue` / `vue2` / `react` / `angular` / `svelte` / `none` |
| `{BUILD_TOOL}` | 构建工具 | `maven` / `gradle` / `npm` / `pnpm` / `yarn` / `go` / `cargo` |
| `{TEST_FRAMEWORK}` | 测试框架 | `junit5` / `jest` / `vitest` / `pytest` / `go-test` / `cargo-test` |
| `{ENABLE_CODE_REVIEW}` | 代码审查开关 | `on` / `off`（默认 `off`） |
| `{ENABLE_UNIT_TEST}` | 单元测试开关 | `on` / `off`（默认 `off`） |

---

## 项目画像来源优先级

| 优先级 | 来源 | 处理规则 |
|-------:|------|---------|
| 1 | 用户本轮显式指定 | 直接采用，覆盖文档与检测结果 |
| 2 | `.claude/project-profile.yaml`（若存在） | 作为已确认画像；仍需轻量校验关键配置文件是否存在 |
| 3 | `CLAUDE.md` / `CODEBUDDY.md` / `AGENTS.md` / `README.md` | 抽取项目类型、语言/框架、构建工具、测试框架、目录约定 |
| 4 | `package.json` / `tsconfig.json` / lockfile / 测试配置 | 校验文档画像；发现冲突时以配置文件为准，并在输出中标注冲突 |
| 5 | 自动扫描 | 仅在文档缺失、冲突、过期或用户要求时执行 |

### 可直接采用文档画像的条件

- 文档已明确项目类型、主要语言/框架、构建工具、测试框架
- 配置文件轻量校验未发现明显冲突
- 用户没有要求重新检测

### 必须触发自动检测的条件

- 项目文档不存在或缺少关键字段
- 文档与 `package.json` / `tsconfig.json` / lockfile / 测试配置明显冲突
- 用户显式要求重新检测
- OpenSpec / GitNexus / E2E 框架等运行时状态尚未确认

---

## 配置文件 → 技术栈推断规则

```
配置文件 → 构建工具/技术栈推断（Fallback，仅文档画像缺失/冲突/过期时执行）
──────────────────────────────────────────────────────
pom.xml + spring-boot-starter    → BACKEND_STACK=spring-boot,  BUILD_TOOL=maven
build.gradle + springframework   → BACKEND_STACK=spring-boot,  BUILD_TOOL=gradle
package.json + @nestjs/core      → BACKEND_STACK=nestjs,        BUILD_TOOL=npm/pnpm/yarn
package.json + express           → BACKEND_STACK=express,       BUILD_TOOL=npm/pnpm/yarn
requirements.txt + django        → BACKEND_STACK=django,        BUILD_TOOL=pip
go.mod + gin-gonic/gin           → BACKEND_STACK=go,            BUILD_TOOL=go
Cargo.toml + actix-web           → BACKEND_STACK=rust,          BUILD_TOOL=cargo

package.json deps:
  vue ^3.x       → FRONTEND_STACK=vue3
  vue ^2.x       → FRONTEND_STACK=vue2
  react          → FRONTEND_STACK=react
  @angular/core  → FRONTEND_STACK=angular

包管理器（Node.js 项目）优先级：
  pnpm-lock.yaml 存在  → BUILD_TOOL=pnpm
  yarn.lock 存在       → BUILD_TOOL=yarn
  package-lock.json    → BUILD_TOOL=npm

目录结构 → PROJECT_TYPE 推断：
  backend/ + frontend/ 同时存在         → monorepo
  src/main/java/ 存在，无前端依赖        → backend-only
  仅 src/ + package.json（纯前端依赖）   → frontend-only
  其余情况                              → fullstack
```

## 开关变量规则

> `{ENABLE_CODE_REVIEW}` 和 `{ENABLE_UNIT_TEST}` **默认均为 `off`**，不做自动推断。
> 必须由用户在 P0.3 步骤**明确输入 on/off** 来设置，不得通过回车跳过。详见 SKILL.md P0.3 节。
>
> 以下 6 个开关由 P0.3 执行模式自动推导，用户无需手动设置：
> - `ENABLE_SECURITY_REVIEW` — full 模式开启
> - `ENABLE_E2E_TEST` — full 模式自动检测（跟随 E2E_FRAMEWORK）
> - `ENABLE_PLAN_AGENT` — full 模式条件触发
> - `ENABLE_KNOWLEDGE_ARCHIVE` — standard/full 模式开启
> - `ENABLE_ASCII_DIAGRAM` — 始终开启
> - `ENABLE_MEETING_PARSE` — 始终开启

---

## 检测失败时的用户输入回退

若无法识别配置文件或结果存在歧义，询问用户补充：

```
⚠️ 无法自动识别以下配置，请手动确认：

1. 项目类型 [monorepo / backend-only / frontend-only / fullstack]：
2. 后端目录（相对路径，如 backend/ 或 .）：
3. 前端目录（相对路径，如 frontend/ 或 .；纯后端项目留空）：
4. 后端技术栈 [spring-boot / express / nestjs / django / go / rust / other]：
5. 前端技术栈 [vue3 / react / angular / svelte / none]：
6. 构建工具 [maven / gradle / npm / pnpm / yarn / go / cargo]：
7. 测试框架 [junit5 / jest / vitest / pytest / go-test / cargo-test]：
8. 代码审查开关 [on / off]（默认 off）：
9. 单元测试开关 [on / off]（默认 off）：
```

---

## 检测结果展示模板

```
✅ 项目画像解析完成

- 画像来源：{PROFILE_SOURCE}（用户显式指定 / project-profile.yaml / CLAUDE.md / CODEBUDDY.md / AGENTS.md / README.md / fallback 自动检测）
- 画像状态：{PROFILE_STATUS}（confirmed / inferred / conflict-resolved / fallback-detected）
- 项目类型：{PROJECT_TYPE}
- 后端目录：{BACKEND_DIR}，技术栈：{BACKEND_STACK}
- 前端/扩展目录：{FRONTEND_DIR}，技术栈：{FRONTEND_STACK}
- 构建工具：{BUILD_TOOL}
- 测试框架：{TEST_FRAMEWORK}
- OpenSpec：{OPENSPEC_STATUS}
- 代码智能层（GitNexus）：{CI_MODE}（repo: {REPO_NAME}）
- E2E 框架：{E2E_FRAMEWORK}
- 代码审查开关：{ENABLE_CODE_REVIEW}（由 P0.3 执行模式推导）
- 单元测试开关：{ENABLE_UNIT_TEST}（由 P0.3 执行模式推导）

后续步骤将基于以上画像动态生成命令、测试模板和 Agent 分派策略。
如画像来源为文档且配置校验通过，不再重复完整扫描。
```

---

## P0.4 自动检测脚本

> 以下脚本仅在 P0.2.Fallback 阶段执行，或用于校验 OpenSpec / GitNexus / E2E 等运行时状态。系统自动推断变量，用户不可修改。

### 代码智能层检测（GitNexus 可用性）

```bash
CI_MODE="no"
if command -v gitnexus &>/dev/null; then
    STATUS=$(gitnexus status 2>&1)
    if echo "$STATUS" | grep -q "up-to-date"; then
        CI_MODE="full"
    elif echo "$STATUS" | grep -q "indexed"; then
        CI_MODE="stale"   # 仍可用，结果标记为"尽力"
    fi
    if [ "$CI_MODE" != "no" ]; then
        REPO_NAME=$(basename $(git rev-parse --show-toplevel 2>/dev/null))
    fi
fi
```

### E2E 框架检测

```bash
if [ -f "playwright.config.ts" ] || [ -f "playwright.config.js" ]; then
    E2E_FRAMEWORK="playwright"
elif [ -f "cypress.config.ts" ] || [ -f "cypress.config.js" ]; then
    E2E_FRAMEWORK="cypress"
else
    E2E_FRAMEWORK="none"
fi
```

### 项目类型检测

```bash
# 扫描子目录中的后端构建文件
HAS_BACKEND=$(find . -maxdepth 3 \( -name "pom.xml" -o -name "build.gradle" -o -name "go.mod" -o -name "Cargo.toml" -o -name "requirements.txt" \) -not -path "*/node_modules/*" 2>/dev/null | head -1)
# 扫描子目录中的前端依赖文件
HAS_FRONTEND=$(find . -maxdepth 3 -name "package.json" -not -path "*/node_modules/*" -exec grep -lE '"vue"|"react"|"@angular/core"' {} \; 2>/dev/null | head -1)

if [ -n "$HAS_BACKEND" ] && [ -n "$HAS_FRONTEND" ]; then
    PROJECT_TYPE="fullstack"
elif [ -n "$HAS_BACKEND" ]; then
    PROJECT_TYPE="backend-only"
elif [ -n "$HAS_FRONTEND" ]; then
    PROJECT_TYPE="frontend-only"
else
    PROJECT_TYPE="fullstack"  # 默认
fi
```

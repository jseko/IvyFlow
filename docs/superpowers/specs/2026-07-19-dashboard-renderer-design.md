---
comet_change: null
role: technical-design
canonical_spec: specs/analytics-dashboard.md
---

# Dashboard Renderer — 技术设计

> 日期：2026-07-19 | 状态：Design Doc | 关联 spec：`specs/analytics-dashboard.md` v2.0

## 1. 目标

将 `src/commands/dashboard.ts`（1109 行）的渲染逻辑抽离为独立的 renderer 模块，支持终端 ASCII 和静态 HTML 双输出，零外部依赖。

## 2. 技术栈

```
渲染层
├── Terminal Renderer    (ASCII, stdout)
│   └── src/core/render/terminal-renderer.ts
│       输出到终端，保持现有纯 ASCII 约束
│
├── HTML Renderer        (Static HTML file)
│   └── src/core/render/html-renderer.ts
│       生成单文件 HTML，内联 CSS/JS，零外部依赖
│       浏览器打开即可查看
│
└── Shared Data Layer
    └── src/core/render/render-context.ts
        统一数据模型，两个 renderer 共享同一份数据
```

## 3. 架构

```
                        ivy dashboard CLI
                              │
                    ┌─────────┴─────────┐
                    │  --html flag?     │
                    └─────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               │               ▼
        Terminal          数据采集          HTML
        Renderer      AdoptionEngineV2    Renderer
              │          JSONLEventStore      │
              │               │               │
              ▼               ▼               ▼
           stdout          RenderContext    .html file
        (ASCII 面板)     (统一数据模型)    (浏览器打开)
```

## 4. 组件设计

### 4.1 RenderContext（统一数据模型）

```typescript
// src/core/render/render-context.ts

interface RenderContext {
  meta: {
    repository: string;
    period: { start: string; end: string };
    model: string;
    confidence: string;
  };

  // Phase 1+2A 指标
  funnel?: AdoptionProfile['funnel'];
  lifecycle?: LifecycleDistribution;
  abandonment?: AbandonmentMetrics;
  failureIntelligence?: FailureMetrics;
  lineage?: LineageMetrics;

  // Phase 2B 指标
  valueIndex?: ValueIndex;
  csi?: CSIMetrics;
  feedback?: FeedbackLoopSummary;

  // 面板开关
  panels: {
    funnel: boolean;
    lifecycle: boolean;
    abandonment: boolean;
    failure: boolean;
    value: boolean;
    csi: boolean;
    feedback: boolean;
    lineage: boolean;
  };
}
```

### 4.2 Terminal Renderer

```typescript
// src/core/render/terminal-renderer.ts

function renderTerminal(ctx: RenderContext): string;
```

- 从 `dashboard.ts` 迁移现有 ASCII 渲染逻辑
- 输出到 `process.stdout`
- 保持纯 ASCII 约束，终端宽度自适应（80-120 列）
- 每个面板通过 `panels` flag 控制显示

### 4.3 HTML Renderer

```typescript
// src/core/render/html-renderer.ts

function renderHTML(ctx: RenderContext): string;
```

- 生成单文件 HTML，内联所有 CSS 和 JS
- 零外部依赖（无 CDN、无 npm 包）
- 响应式布局，适配桌面和移动端
- 支持面板折叠/展开（纯 CSS，无 JS 框架）

**HTML 结构**：

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>IvyFlow Dashboard</title>
  <style>/* 内联 CSS */</style>
</head>
<body>
  <header><!-- 元数据 --></header>
  <main>
    <section id="executive-summary"><!-- Value Index + 关键 KPI --></section>
    <section id="funnel"><!-- AI Development Funnel --></section>
    <section id="lifecycle"><!-- 三维 Lifecycle --></section>
    <section id="abandonment"><!-- Abandonment Reasons --></section>
    <section id="failure"><!-- Failure Intelligence --></section>
    <section id="value-index"><!-- Value Index 详情 --></section>
    <section id="csi"><!-- Context Intelligence --></section>
    <section id="feedback"><!-- Feedback Loop --></section>
  </main>
  <footer><!-- 生成时间 + 置信度声明 --></footer>
</body>
</html>
```

**CSS 设计约束**：
- 单色系配色（终端风格：深色背景 + 绿色/白色文字）
- 条形图用纯 CSS `width` 百分比实现
- 面板折叠用 `<details>/<summary>` 原生 HTML 元素
- 无动画、无外部字体、无图片

**HTML 模板独立文件**：

```typescript
// src/core/render/html-template.ts

export const HTML_TEMPLATE = {
  header: (meta: RenderContext['meta']) => string;
  executiveSummary: (ctx: RenderContext) => string;
  funnel: (funnel: AdoptionProfile['funnel']) => string;
  lifecycle: (lifecycle: LifecycleDistribution) => string;
  abandonment: (abandonment: AbandonmentMetrics) => string;
  failure: (failure: FailureMetrics) => string;
  valueIndex: (vi: ValueIndex) => string;
  csi: (csi: CSIMetrics) => string;
  feedback: (feedback: FeedbackLoopSummary) => string;
  footer: () => string;
  css: string;
};
```

### 4.4 Dashboard CLI（精简后）

```typescript
// src/commands/dashboard.ts（重构后）

async function runDashboard(opts: DashboardOptions): Promise<number> {
  // 1. 数据采集
  const ctx = await buildRenderContext(opts);

  // 2. 选择 renderer
  if (opts.html) {
    const html = renderHTML(ctx);
    const outputPath = opts.output ?? path.join(cwd, '.ivy', 'dashboard.html');
    await writeFile(outputPath, html);
    logger.info(`Dashboard saved: ${outputPath}`);
  } else {
    const ascii = renderTerminal(ctx);
    process.stdout.write(ascii);
  }

  return 0;
}
```

## 5. 文件结构

```
src/core/render/
├── render-context.ts        # RenderContext 数据模型 + buildRenderContext()
├── terminal-renderer.ts     # ASCII 终端渲染
├── html-renderer.ts         # 静态 HTML 渲染（组装）
└── html-template.ts         # HTML 模板片段 + 内联 CSS

src/commands/dashboard.ts    # 精简为编排层（采集 → 选择 renderer → 输出）
```

## 6. CLI 接口

```bash
# 终端 ASCII（默认）
ivy dashboard --provenance

# 生成 HTML 文件（默认路径 .ivy/dashboard.html）
ivy dashboard --provenance --html

# 指定输出路径
ivy dashboard --provenance --html --output ./reports/dashboard.html

# 组合面板
ivy dashboard --provenance --value --csi --feedback --html
```

## 7. 关键决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 渲染目标 | 终端 + 静态 HTML | 覆盖 CLI 和浏览器场景 |
| Web 级别 | 静态 HTML（零 server） | 无需端口管理，无安全风险 |
| 重构策略 | 抽离 renderer 模块 | dashboard.ts 只做编排 |
| HTML 依赖 | 零外部依赖，内联 CSS/JS | 符合项目约束 |
| 数据模型 | 共享 RenderContext | 两个 renderer 消费同一份数据 |
| CSS 方案 | 内联 `<style>` 标签 | 单文件，零请求 |
| 图表方案 | 纯 CSS 百分比条形图 | 零依赖，终端风格 |

## 8. 风险

| 风险 | 缓解 |
|------|------|
| dashboard.ts 1109 行重构 | 先抽离再增量替换，旧逻辑不删直到新 renderer 验证通过 |
| HTML 内联 CSS 体积 | 单文件 < 50KB，仅必要样式 |
| 两个 renderer 输出不一致 | 共享 RenderContext 保证数据一致性 |
| 终端宽度兼容性 | 自适应 `process.stdout.columns`，最小 80 列 |

## 9. 实施计划概要

| 步骤 | 说明 | 预估 |
|:----:|------|:--:|
| 1 | 创建 `src/core/render/render-context.ts` | 数据模型 + buildRenderContext() |
| 2 | 创建 `src/core/render/terminal-renderer.ts` | 从 dashboard.ts 迁移 ASCII 渲染 |
| 3 | 创建 `src/core/render/html-template.ts` | HTML 模板 + 内联 CSS |
| 4 | 创建 `src/core/render/html-renderer.ts` | HTML 组装渲染 |
| 5 | 重构 `src/commands/dashboard.ts` | 精简为编排层 |
| 6 | 测试 + 向下兼容验证 | 确保旧 CLI 行为不变 |

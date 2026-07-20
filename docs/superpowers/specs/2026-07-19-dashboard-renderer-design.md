---
comet_change: null
role: technical-design
canonical_spec: specs/analytics-dashboard.md
---

# Dashboard Renderer — 技术设计 v0.2

> 日期：2026-07-19 | 状态：Implementation-Ready | 基于架构评审优化

## 1. 目标

将 `src/commands/dashboard.ts`（1109 行）的渲染逻辑抽离为独立的 renderer 模块，支持终端 ASCII、静态 HTML 和未来 JSON/Markdown 多格式输出，零外部依赖。

## 2. 架构总览

```
                    ivy dashboard CLI
                         │
                         ▼
                  DashboardService
                   (编排层：采集数据)
                         │
                         ▼
                  DashboardData
                   (统一数据模型)
                         │
                         ▼
                  RenderContext
                   (data + options)
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
      Terminal        HTML           JSON
      Renderer       Renderer      Renderer
      (Phase 1)      (Phase 2)     (Phase 3 预留)
          │              │
          ▼              ▼
     stdout / file   .html file
```

## 3. 核心抽象

### 3.1 Renderer Interface

```typescript
// src/core/render/types/renderer.ts

interface DashboardRenderer {
  render(ctx: RenderContext): RenderResult;
}

interface RenderResult {
  content: string;
  mimeType: string;
  extension: string;
}
```

### 3.2 RenderContext（data + options 分层）

```typescript
// src/core/render/types/render-context.ts

interface DashboardData {
  meta: DashboardMeta;
  metrics: DashboardMetrics;
}

interface DashboardMeta {
  repository: string;
  period: { start: string; end: string };
  model: string;
  confidence: 'low' | 'medium' | 'high';
}

interface DashboardMetrics {
  funnel?: FunnelMetrics;
  lifecycle?: LifecycleMetrics;
  abandonment?: AbandonmentMetrics;
  failure?: FailureMetrics;
  lineage?: LineageMetrics;
  value?: ValueMetrics;
  csi?: CSIMetrics;
  feedback?: FeedbackMetrics;
}

interface RenderOptions {
  panels: string[];
  format: 'terminal' | 'html' | 'json' | 'markdown';
  width?: number;
  outputPath?: string;
}

interface RenderContext {
  data: DashboardData;
  options: RenderOptions;
}
```

## 4. 文件结构

```
src/core/render/
├── index.ts                      # 导出 DashboardRenderer, RenderContext 等
│
├── types/
│   ├── renderer.ts               # DashboardRenderer, RenderResult 接口
│   └── render-context.ts         # DashboardData, DashboardMetrics, RenderOptions, RenderContext
│
├── terminal/
│   ├── terminal-renderer.ts      # TerminalRenderer implements DashboardRenderer
│   ├── layout.ts                 # Layout primitives (Box, Row, Column, Table, Bar)
│   └── sections/                 # 面板渲染函数
│       ├── header.ts
│       ├── funnel.ts
│       ├── lifecycle.ts
│       ├── abandonment.ts
│       ├── failure.ts
│       ├── value-index.ts
│       ├── csi.ts
│       └── feedback.ts
│
├── html/
│   ├── html-renderer.ts          # HtmlRenderer implements DashboardRenderer
│   ├── template.ts               # HTML 文档骨架组装
│   ├── styles.ts                 # 内联 CSS（终端风格配色）
│   └── components/               # HTML 面板组件
│       ├── header.ts
│       ├── funnel.ts
│       ├── lifecycle.ts
│       ├── abandonment.ts
│       ├── failure.ts
│       ├── value-index.ts
│       ├── csi.ts
│       └── feedback.ts
│
└── utils/
    └── escape-html.ts            # HTML 实体转义（防注入）
```

## 5. 组件设计

### 5.1 Terminal Layout Primitives

零外部依赖，自建轻量布局：

```typescript
// src/core/render/terminal/layout.ts

function box(title: string, content: string, width?: number): string;
function row(label: string, value: string, width?: number): string;
function bar(label: string, value: number, max: number, width?: number): string;
function table(headers: string[], rows: string[][], width?: number): string;
```

宽度自适应：`width ?? Math.min(process.stdout.columns ?? 80, 120)`。

### 5.2 HTML Escape

```typescript
// src/core/render/utils/escape-html.ts

function escapeHtml(value: string): string;
```

所有动态字段（repository、model、period、metrics label）必须经过此函数。

### 5.3 HTML 安全策略

- 所有动态数据字段经过 `escapeHtml()`
- 无外部 CDN、无 `<script src>`、无 `eval()`
- 单文件自包含，浏览器直接打开
- Snapshot test 断言 `not.toContain('<script>alert')`

### 5.4 Terminal Renderer（Phase 1：迁移现有行为）

```typescript
// src/core/render/terminal/terminal-renderer.ts

class TerminalRenderer implements DashboardRenderer {
  render(ctx: RenderContext): RenderResult {
    const sections: string[] = [];
    if (ctx.options.panels.includes('funnel')) sections.push(renderFunnel(ctx.data));
    if (ctx.options.panels.includes('lifecycle')) sections.push(renderLifecycle(ctx.data));
    // ...
    return {
      content: sections.join('\n\n'),
      mimeType: 'text/plain',
      extension: '.txt',
    };
  }
}
```

### 5.5 HTML Renderer（Phase 2：新增）

```typescript
// src/core/render/html/html-renderer.ts

class HtmlRenderer implements DashboardRenderer {
  render(ctx: RenderContext): RenderResult {
    const sections: string[] = [];
    if (ctx.options.panels.includes('funnel')) sections.push(renderFunnel(ctx.data));
    // ...
    return {
      content: assembleHtmlDoc(ctx.data.meta, sections),
      mimeType: 'text/html',
      extension: '.html',
    };
  }
}
```

HTML 模板结构（`src/core/render/html/template.ts`）：

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>IvyFlow Dashboard — ${escapeHtml(meta.repository)}</title>
  <style>${STYLES}</style>
</head>
<body>
  <header><!-- meta info --></header>
  <main>${sections.join('\n')}</main>
  <footer><!-- generated at + confidence --></footer>
</body>
</html>
```

## 6. CLI 接口

```bash
# 终端 ASCII（默认）
ivy dashboard --provenance

# 指定格式
ivy dashboard --provenance --format html
ivy dashboard --provenance --format terminal   # 显式指定

# 兼容旧 flag（alias）
ivy dashboard --provenance --html              # 等价于 --format html

# 指定输出路径
ivy dashboard --provenance --format html --output ./reports/dashboard.html

# 组合面板
ivy dashboard --provenance --format html --value --csi --feedback

# 未来扩展
ivy dashboard --provenance --format json       # Phase 3
ivy dashboard --provenance --format markdown   # Phase 3
```

## 7. Dashboard CLI（精简后）

```typescript
// src/commands/dashboard.ts（重构后，~200 行）

async function runDashboard(opts: DashboardOptions): Promise<number> {
  // 1. 数据采集
  const data = await collectDashboardData(opts);

  // 2. 构建 RenderContext
  const ctx: RenderContext = {
    data,
    options: {
      panels: resolvePanels(opts),
      format: opts.format ?? (opts.html ? 'html' : 'terminal'),
      width: opts.width,
      outputPath: opts.output,
    },
  };

  // 3. 选择 Renderer
  const renderer = getRenderer(ctx.options.format);

  // 4. 渲染输出
  const result = renderer.render(ctx);

  if (ctx.options.outputPath) {
    await writeFile(ctx.options.outputPath, result.content);
    logger.info(`Dashboard saved: ${ctx.options.outputPath}`);
  } else if (ctx.options.format === 'terminal') {
    process.stdout.write(result.content);
  } else {
    // 默认输出到 .ivy/dashboard.<ext>
    const defaultPath = path.join(cwd, '.ivy', `dashboard${result.extension}`);
    await writeFile(defaultPath, result.content);
    logger.info(`Dashboard saved: ${defaultPath}`);
  }

  return 0;
}
```

## 8. 测试策略

### 8.1 Snapshot Tests

```
src/core/render/
├── terminal/
│   └── terminal-renderer.test.ts    # Snapshot: 固定输入 → 固定 ASCII 输出
├── html/
│   └── html-renderer.test.ts        # Snapshot: 固定输入 → 固定 HTML 输出
└── __snapshots__/                   # Vitest snapshot 文件
```

**Terminal snapshot 示例**：

```typescript
it('renders funnel panel', () => {
  const ctx = createMockContext({ funnel: { adoption: 80 } });
  const result = new TerminalRenderer().render(ctx);
  expect(result.content).toMatchSnapshot();
  // 验证输出包含 "AI Adoption" 和 "80%"
});
```

**HTML snapshot 示例**：

```typescript
it('renders HTML without XSS', () => {
  const ctx = createMockContext({
    meta: { repository: '<script>alert(1)</script>' },
  });
  const result = new HtmlRenderer().render(ctx);
  expect(result.content).not.toContain('<script>alert');
  expect(result.content).toContain('&lt;script&gt;');
});
```

### 8.2 RenderContext 构建测试

```typescript
// render-context.test.ts
it('builds RenderContext from AdoptionEngineV2 output');
it('handles empty provenance data gracefully');
it('resolves panel flags correctly');
```

## 9. 实施顺序

| Phase | 内容 | 预估 |
|:-----:|------|:--:|
| **Phase 0** | 冻结 Renderer Contract（types/renderer.ts + types/render-context.ts） | 小 |
| **Phase 1** | 抽离 Terminal Renderer（从 dashboard.ts 迁移，保证输出完全一致） | 中 |
| **Phase 2** | 新增 HTML Renderer（`--format html`） | 中 |
| **Phase 3** | 扩展 Renderer（JSON / Markdown，预留接口） | 小 |

## 10. 关键决策

| 决策 | 选择 | 理由 |
|------|------|------|
| RenderContext 分层 | data + options 独立 | 避免数据/UI 配置/元信息混合膨胀 |
| Renderer 接口 | DashboardRenderer + RenderResult | 为 JSON/Markdown 预留扩展点 |
| HTML 安全 | escapeHtml() 统一入口 | 本地生成风险低但需符合 Governable 原则 |
| CLI flag | `--format` 为主，`--html` 为 alias | 统一 Renderer 扩展点 |
| 目录结构 | types/terminal/html/utils 分层 | 为 v0.40 预留扩展空间 |
| 实施顺序 | 先冻结 Contract → Terminal → HTML | 先定义接口再迁移，降低风险 |
| Layout primitives | 自建 Box/Row/Bar/Table | 零外部依赖 |
| Snapshot tests | 终端 + HTML 固定输入输出 | 确定性验证，防止渲染回归 |

## 11. 风险

| 风险 | 缓解 |
|------|------|
| dashboard.ts 1109 行重构 | 先冻结 Contract → Terminal 抽离（保持输出一致）→ HTML 新增 |
| HTML 模板膨胀 | components/ 拆分，单文件 < 200 行 |
| 终端宽度兼容 | layout primitives 自适应 `process.stdout.columns`，最小 80 列 |
| RenderContext 未来膨胀 | data/options 分层，新指标只追加到 DashboardMetrics |

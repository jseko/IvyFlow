# Defense-in-Depth Validation — 多层验证加固

> 本参考文档供 systematic-debugging Phase 4 使用，提供在数据流每一层添加验证的方法论。修复 Bug 后，单一验证点可能被不同代码路径、重构或 Mock 绕过。多层验证使 Bug 在结构上不可能重现。

---

## 为什么需要多层

- 单一验证："我们修复了这个 Bug"
- 多层验证："我们让这个 Bug 不可能再次发生"

不同层捕获不同情况：
- 入口验证捕获大多数 Bug
- 业务逻辑捕获边界情况
- 环境守卫防止特定上下文的危险操作
- 调试日志在其他层失效时提供线索

---

## 四层防御体系

### Layer 1: Entry Point Validation

**目的：** 在 API 边界拒绝明显无效的输入

```typescript
function createProject(name: string, workingDirectory: string) {
  if (!workingDirectory || workingDirectory.trim() === '') {
    throw new Error('workingDirectory cannot be empty');
  }
  if (!existsSync(workingDirectory)) {
    throw new Error(`workingDirectory does not exist: ${workingDirectory}`);
  }
  if (!statSync(workingDirectory).isDirectory()) {
    throw new Error(`workingDirectory is not a directory: ${workingDirectory}`);
  }
  // ... proceed
}
```

### Layer 2: Business Logic Validation

**目的：** 确保数据对当前操作有意义

```typescript
function initializeWorkspace(projectDir: string, sessionId: string) {
  if (!projectDir) {
    throw new Error('projectDir required for workspace initialization');
  }
  // ... proceed
}
```

### Layer 3: Environment Guards

**目的：** 防止在特定上下文中执行危险操作

```typescript
async function gitInit(directory: string) {
  // 在测试中，拒绝在临时目录外执行 git init
  if (process.env.NODE_ENV === 'test') {
    const normalized = normalize(resolve(directory));
    const tmpDir = normalize(resolve(tmpdir()));

    if (!normalized.startsWith(tmpDir)) {
      throw new Error(
        `Refusing git init outside temp dir during tests: ${directory}`
      );
    }
  }
  // ... proceed
}
```

### Layer 4: Debug Instrumentation

**目的：** 捕获上下文用于事后分析

```typescript
async function gitInit(directory: string) {
  const stack = new Error().stack;
  logger.debug('About to git init', {
    directory,
    cwd: process.cwd(),
    stack,
  });
  // ... proceed
}
```

---

## 应用模式

当找到一个 Bug 时：

1. **追踪数据流** — 坏值从哪里来？在哪里被使用？
2. **映射所有检查点** — 列出数据经过的每个点
3. **在每层添加验证** — 入口、业务、环境、调试
4. **测试每层** — 尝试绕过 Layer 1，验证 Layer 2 能否捕获

---

## 真实案例

**Bug：** 空 `projectDir` 导致 `git init` 在源代码中运行

**数据流：**
1. 测试设置 → 空字符串
2. `Project.create(name, '')`
3. `WorkspaceManager.createWorkspace('')`
4. `git init` 在 `process.cwd()` 运行

**添加的四层：**
- Layer 1: `Project.create()` 验证非空/存在/可写
- Layer 2: `WorkspaceManager` 验证 projectDir 非空
- Layer 3: `WorktreeManager` 在测试中拒绝在 tmpdir 外执行 git init
- Layer 4: git init 前记录堆栈跟踪

**结果：** 全部 1847 个测试通过，Bug 无法重现

---

## 关键洞见

全部四层都是必要的。在测试过程中，每层捕获了其他层错过的 Bug：
- 不同代码路径绕过了入口验证
- Mock 绕过了业务逻辑检查
- 不同平台的边界情况需要环境守卫
- 调试日志识别了结构性误用

**不要止步于一个验证点。在每一层都添加检查。**

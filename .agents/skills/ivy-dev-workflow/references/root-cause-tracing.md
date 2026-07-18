# Root Cause Tracing — 调用栈反向追踪

> 本参考文档供 systematic-debugging Phase 1 使用，提供从调用栈末端反向追踪到原始触发点的方法论。

---

## 核心原则

Bug 通常深层出现在调用栈中（git init 在错误目录、文件创建在错误位置、数据库以错误路径打开）。你的直觉是在错误出现的地方修复，但那只是治标。

**核心原则：** 反向追踪调用链直到找到原始触发点，然后在源头修复。

---

## 5 步追踪流程

### 1. Observe the Symptom

```
Error: git init failed in ~/project/packages/core
```

### 2. Find Immediate Cause

**什么代码直接导致了这个错误？**

```typescript
await execFileAsync('git', ['init'], { cwd: projectDir });
```

### 3. Ask: What Called This?

```typescript
WorktreeManager.createSessionWorktree(projectDir, sessionId)
  → called by Session.initializeWorkspace()
  → called by Session.create()
  → called by test at Project.create()
```

### 4. Keep Tracing Up

**传入了什么值？**

- `projectDir = ''`（空字符串！）
- 空字符串作为 `cwd` 解析为 `process.cwd()`
- 那就是源代码目录！

### 5. Find Original Trigger

**空字符串从哪里来？**

```typescript
const context = setupCoreTest(); // Returns { tempDir: '' }
Project.create('name', context.tempDir); // Accessed before beforeEach!
```

---

## 诊断埋点技巧

### 添加堆栈跟踪

当无法手动追踪时，添加诊断埋点：

```typescript
// 在问题操作之前
async function gitInit(directory: string) {
  const stack = new Error().stack;
  console.error('DEBUG git init:', {
    directory,
    cwd: process.cwd(),
    nodeEnv: process.env.NODE_ENV,
    stack,
  });

  await execFileAsync('git', ['init'], { cwd: directory });
}
```

**关键规则：**
- 在测试中使用 `console.error()` 而非 logger（logger 可能被抑制）
- 在危险操作**之前**记录，而非失败之后
- 包含上下文：目录、cwd、环境变量、时间戳
- 使用 `new Error().stack` 获取完整调用链

### 运行并捕获

```bash
npm test 2>&1 | grep 'DEBUG git init'
```

### 分析堆栈跟踪

- 寻找测试文件名
- 找到触发调用的行号
- 识别模式（同一个测试？相同参数？）

---

## 定位哪个测试引起污染

如果某物在测试期间出现但不确定是哪个测试：

使用二分法逐个运行测试：

```bash
# 逐个运行测试文件，第一个产生污染的即为目标
for f in src/**/*.test.ts; do
  echo "Testing: $f"
  npx jest "$f" --silent
  # 检查污染标记
done
```

---

## 真实案例：空 projectDir

**症状：** `.git` 在 `packages/core/`（源代码）中创建

**追踪链：**
1. `git init` 在 `process.cwd()` 运行 ← 空 cwd 参数
2. WorktreeManager 收到空的 projectDir
3. Session.create() 传入空字符串
4. 测试在 beforeEach 之前访问 `context.tempDir`
5. setupCoreTest() 初始返回 `{ tempDir: '' }`

**根因：** 顶层变量初始化访问了空值

**修复：** 让 tempDir 成为 getter，在 beforeEach 之前访问则抛出异常

**同时添加 defense-in-depth：**
- Layer 1: Project.create() 验证目录
- Layer 2: WorkspaceManager 验证非空
- Layer 3: NODE_ENV 守卫拒绝在 tmpdir 外执行 git init
- Layer 4: git init 前记录堆栈跟踪

---

## 核心戒律

```
NEVER fix just where the error appears.
Trace back to find the original trigger.
```

- 找到直接原因后，问："谁调用了它？传入了什么？"
- 继续向上直到找到原始触发点
- 在源头修复，而非在症状处

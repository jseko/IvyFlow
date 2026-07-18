# Condition-Based Waiting — 条件轮询替代任意 sleep

> 本参考文档供测试稳定性辅助使用，提供用条件轮询替代任意延迟的方法论。

---

## 核心原则

Flaky tests 通常使用任意延迟来猜测时序。这会产生竞态条件——在快速机器上通过，但在负载下或 CI 中失败。

**核心原则：** 等待你真正关心的**条件**，而不是猜测需要多长时间。

---

## Core Pattern

```typescript
// ❌ BEFORE: 猜测时序
await new Promise(r => setTimeout(r, 50));
const result = getResult();
expect(result).toBeDefined();

// ✅ AFTER: 等待条件
await waitFor(() => getResult() !== undefined);
const result = getResult();
expect(result).toBeDefined();
```

---

## 通用 waitFor 实现

```typescript
async function waitFor<T>(
  condition: () => T | undefined | null | false,
  description: string,
  timeoutMs = 5000
): Promise<T> {
  const startTime = Date.now();

  while (true) {
    const result = condition();
    if (result) return result;

    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Timeout waiting for ${description} after ${timeoutMs}ms`);
    }

    await new Promise(r => setTimeout(r, 10)); // Poll every 10ms
  }
}
```

---

## Quick Patterns

| Scenario | Pattern |
|----------|---------|
| Wait for event | `waitFor(() => events.find(e => e.type === 'DONE'))` |
| Wait for state | `waitFor(() => machine.state === 'ready')` |
| Wait for count | `waitFor(() => items.length >= 5)` |
| Wait for file | `waitFor(() => fs.existsSync(path))` |
| Complex condition | `waitFor(() => obj.ready && obj.value > 10)` |

---

## Common Mistakes

**❌ Polling too fast:** `setTimeout(check, 1)` — 浪费 CPU
**✅ Fix:** Poll every 10ms

**❌ No timeout:** 条件永远不满足时无限循环
**✅ Fix:** 始终包含带清晰错误消息的超时

**❌ Stale data:** 在循环外缓存状态
**✅ Fix:** 在循环内调用 getter 以获取最新数据

---

## 合法使用任意 Timeout 的场景

```typescript
// 工具每 100ms tick 一次 — 需要 2 个 tick 来验证部分输出
await waitForEvent(manager, 'TOOL_STARTED'); // First: wait for condition
await new Promise(r => setTimeout(r, 200));   // Then: wait for timed behavior
// 200ms = 2 ticks at 100ms intervals — documented and justified
```

**使用固定 timeout 的前提条件：**
1. 先等待触发条件（condition-based）
2. 基于已知的时序（非猜测）
3. 注释解释 WHY

---

## When to Use

**Use when:**
- Tests have arbitrary delays (`setTimeout`, `sleep`, `time.sleep()`)
- Tests are flaky (pass sometimes, fail under load)
- Tests timeout when run in parallel
- Waiting for async operations to complete

**Don't use when:**
- Testing actual timing behavior (debounce, throttle intervals)
- Always document WHY if using arbitrary timeout

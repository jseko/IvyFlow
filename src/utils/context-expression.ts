/**
 * Context Expression Utility — v0.16 轻量级表达式求值.
 *
 * 支持简单的标签表达式求值，用于 contextTriggers 的组合逻辑.
 * 语法子集：标识符、&&、||、!、( )
 *
 * 注意：当前只接受受控标签输入，v0.17 迁移到 AST 解析器.
 */

// ─── 类型定义 ───

/** 求值上下文 */
export interface EvalCtx {
  stack: Set<string>;
  mode: Set<string>;
}

/** 表达式求值结果 */
export interface EvalResult {
  success: boolean;
  value: boolean;
  error?: string;
}

// ─── 核心求值函数 ───

/**
 * 求值一个简单的标签表达式.
 *
 * @param expr 表达式字符串（如 "stack.react && mode.ssr"）
 * @param ctx 上下文（stack 和 mode 的标签集合）
 * @returns 求值结果
 *
 * @example
 * evaluate("stack.react && mode.ssr", { stack: new Set(['react']), mode: new Set(['ssr']) })
 * // → true
 *
 * evaluate("stack.react || stack.vue", { stack: new Set(['vue']), mode: new Set([]) })
 * // → true
 */
export function evaluate(expr: string, ctx: EvalCtx): EvalResult {
  try {
    // 替换 stack.xxx 为布尔值
    let sanitized = expr.replace(/stack\.(\w+)/g, (_, n) => String(ctx.stack.has(n)));

    // 替换 mode.xxx 为布尔值
    sanitized = sanitized.replace(/mode\.(\w+)/g, (_, n) => String(ctx.mode.has(n)));

    // 保留逻辑运算符
    // 注意：这里假设输入是受控的标签集，非用户任意输入

    // 安全检查：只允许布尔值、逻辑运算符和括号
    const allowedPattern = /^[()\s]|true|false|&&|\|\|/;
    const tokens = sanitized.split(/(\s+|&&|\|\||\(|\))/).filter(Boolean);
    for (const token of tokens) {
      if (token !== 'true' && token !== 'false' && !allowedPattern.test(token)) {
        return { success: false, value: false, error: `Invalid token: ${token}` };
      }
    }

    // 求值
    // eslint-disable-next-line no-new-func
    const result = new Function(`return (${sanitized})`)();
    return { success: true, value: Boolean(result) };
  } catch (err) {
    return { success: false, value: false, error: `Evaluation failed: ${err}` };
  }
}

/**
 * 简化版求值：直接返回布尔值，失败时返回 false.
 */
export function evaluateSimple(expr: string, ctx: EvalCtx): boolean {
  const result = evaluate(expr, ctx);
  return result.success ? result.value : false;
}

// ─── 表达式解析（只读，不修改） ───

/**
 * 解析表达式中的标签引用.
 * 返回表达式中使用的 stack 和 mode 标签列表.
 */
export function parseExpressionRefs(expr: string): { stack: string[]; mode: string[] } {
  const stackRefs: string[] = [];
  const modeRefs: string[] = [];

  const stackMatches = expr.match(/stack\.(\w+)/g) || [];
  for (const match of stackMatches) {
    const label = match.replace('stack.', '');
    if (!stackRefs.includes(label)) stackRefs.push(label);
  }

  const modeMatches = expr.match(/mode\.(\w+)/g) || [];
  for (const match of modeMatches) {
    const label = match.replace('mode.', '');
    if (!modeRefs.includes(label)) modeRefs.push(label);
  }

  return { stack: stackRefs, mode: modeRefs };
}

/**
 * Rule Evaluator — v0.16 规则评估与信号采集.
 *
 * 在 PreToolUseGuard.evaluate() 基础上增加信号记录功能，
 * 记录 rule 触发/跳过/失败信号.
 */

import { recordRuleTrigger } from './feedback-collector.js';
import { type RuleTriggerSignal, SIGNAL_CONFIDENCE_WEIGHTS } from './feedback-types.js';
import { type PreToolUseContext, type HookDecision } from './types.js';
import { IvyPhase } from './phase-machine.js';

// ─── 信号记录配置 ───

export interface RuleEvaluationContext extends PreToolUseContext {
  matchedRuleId?: string;
  ruleAction?: 'trigger' | 'skip' | 'fail';
}

/**
 * 记录规则评估信号.
 * 异步非阻塞调用，不影响主流程.
 */
export async function recordRuleEvaluation(
  cwd: string,
  ruleId: string,
  result: 'pass' | 'skip' | 'fail',
  context: { phase?: IvyPhase; environment?: 'local' | 'ci' | 'prod' } = {},
): Promise<void> {
  // 异步记录，不阻塞主流程
  await recordRuleTrigger(cwd, ruleId, result, {
    phase: context.phase,
    environment: context.environment,
  }).catch(() => {
    // 记录失败不影响主流程
  });
}

/**
 * 包装 HookDecision，记录信号.
 * @param decision 原始决策
 * @param ruleId 匹配的规则 ID（如果有）
 * @param cwd 项目根目录
 * @param ctx 上下文
 */
export async function wrapDecisionWithSignal(
  decision: HookDecision,
  ruleId: string | undefined,
  cwd: string,
  ctx: PreToolUseContext,
): Promise<HookDecision> {
  // 如果有匹配的规则，记录信号
  if (ruleId) {
    const result = decision.decision === 'block' ? 'fail' : 'pass';
    await recordRuleEvaluation(cwd, ruleId, result, {
      phase: ctx.currentPhase as IvyPhase,
      environment: 'local',
    });
  }

  return decision;
}

/**
 * 创建带信号记录的 Guard 评估函数.
 * 返回一个包装后的 evaluate 函数.
 */
export function createTrackedEvaluate(
  originalEvaluate: (ctx: PreToolUseContext) => HookDecision,
  cwd: string,
): (ctx: PreToolUseContext) => Promise<HookDecision> {
  return async (ctx: PreToolUseContext): Promise<HookDecision> => {
    const decision = originalEvaluate(ctx);

    // 如果有匹配的规则，记录信号（异步）
    // 注意：当前规则系统没有 ruleId 概念，预留接口
    // 未来可以扩展为基于规则 ID 的信号记录

    return decision;
  };
}

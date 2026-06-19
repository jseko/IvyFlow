/**
 * Runtime Signal Types — v0.16 运行时信号类型定义.
 *
 * 定义 IvyFlow 运行时信号的数据结构、上下文标注和置信度权重.
 */

import { IvyPhase } from './phase-machine.js';

// ─── 信号类型 ───

/** 运行时信号的类型 — 精简为 3 类 */
export type RuntimeSignalType =
  | 'rule_trigger'        // 规则被触发/跳过
  | 'verify_result'       // Verify 阶段通过/失败
  | 'gap_detected';       // Capability gap 出现

/** 信号源标识 */
export interface SignalSource {
  type: RuntimeSignalType;
  context: {
    phase?: IvyPhase;
    environment?: 'local' | 'ci' | 'prod';
    ruleId?: string;
    gapType?: string;
  };
}

// ─── 置信度权重 ───

/** 信号置信度权重配置 */
export const SIGNAL_CONFIDENCE_WEIGHTS: Record<RuntimeSignalType, number> = {
  verify_result: 1.0,      // 权威信号 — 直接来自质量门
  rule_trigger: 0.8,       // 可靠信号 — 规则触发有明确语义
  gap_detected: 0.4,       // 辅助信号 — 需要进一步归因
};

// ─── 信号事件 ───

/** 运行时信号事件基类 */
export interface RuntimeSignalEvent extends SignalSource {
  ts: string;              // ISO 8601 时间戳
  id?: string;             // 可选唯一标识
}

/** 规则触发信号 */
export interface RuleTriggerSignal extends RuntimeSignalEvent {
  type: 'rule_trigger';
  ruleId: string;
  result: 'pass' | 'skip' | 'fail';
  confidence: number;      // 信号置信度（通常 = SIGNAL_CONFIDENCE_WEIGHTS['rule_trigger']）
}

/** Verify 结果信号 */
export interface VerifyResultSignal extends RuntimeSignalEvent {
  type: 'verify_result';
  phase: 'verify';
  result: 'pass' | 'blocked';
  gapCount: number;        // 本次 verify 发现的 gap 数量
  confidence: number;      // 通常 = 1.0
}

/** Gap 检测信号 */
export interface GapDetectedSignal extends RuntimeSignalEvent {
  type: 'gap_detected';
  subType: 'capability_gap' | 'config_gap' | 'integration_gap';
  ruleId?: string;         // 关联的规则 ID（如适用）
  severity: 'low' | 'medium' | 'high' | 'critical';
  detail?: string;         // 详细描述
  confidence: number;      // 通常 = 0.4
}

// ─── 聚合信号 ───

/** 信号聚合配置 */
export interface AggregationConfig {
  windowDays: number;           // 聚合窗口天数（默认 30）
  minTriggerCount: number;      // 最低触发次数（默认 3，冷启动保护）
  useDerivedMetrics: boolean;   // 使用预聚合层（默认 true）
}

/** 按信号类型汇总 */
export interface SignalSummary {
  byType: Record<RuntimeSignalType, number>;
  totalSignals: number;
  period: {
    from: string;
    to: string;
  };
}

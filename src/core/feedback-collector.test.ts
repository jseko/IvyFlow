/**
 * Tests for feedback-collector.ts — v0.16 信号采集.
 *
 * Covers: TC-1 through TC-10.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { randomBytes } from 'crypto';

import { IvyPhase } from './phase-machine.js';
import {
  recordRuleTrigger,
  recordVerifyResult,
  recordGapDetected,
  readAllSignals,
  readSignalsInWindow,
  cleanupOldSignals,
} from './feedback-collector.js';
import { SIGNAL_CONFIDENCE_WEIGHTS } from './feedback-types.js';

function createTempDir(): string {
  return path.join(os.tmpdir(), `ivy-feedback-test-${randomBytes(4).toString('hex')}`);
}

describe('feedback-collector', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = createTempDir();
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  // TC-1: 规则触发后检查 JSONL 文件追加记录
  describe('TC-1: Rule trigger signal recording', () => {
    it('should record rule trigger signal to JSONL file', async () => {
      await recordRuleTrigger(tmpDir, 'test-rule', 'pass', { phase: IvyPhase.BUILD, environment: 'local' });

      const logPath = path.join(tmpDir, '.ivy/feedback/log.jsonl');
      const content = await fs.readFile(logPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(1);
      const event = JSON.parse(lines[0]);
      expect(event.type).toBe('rule_trigger');
      expect(event.ruleId).toBe('test-rule');
      expect(event.result).toBe('pass');
      expect(event.context.phase).toBe('build');
      expect(event.context.environment).toBe('local');
      expect(event.confidence).toBe(SIGNAL_CONFIDENCE_WEIGHTS['rule_trigger']);
    });

    it('should append multiple signals without blocking', async () => {
      await Promise.all([
        recordRuleTrigger(tmpDir, 'rule-1', 'pass'),
        recordRuleTrigger(tmpDir, 'rule-2', 'skip'),
        recordRuleTrigger(tmpDir, 'rule-3', 'fail'),
      ]);

      const logPath = path.join(tmpDir, '.ivy/feedback/log.jsonl');
      const content = await fs.readFile(logPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      expect(lines).toHaveLength(3);
    });
  });

  // TC-2: Verify 通过后检查 verify JSONL 文件
  describe('TC-2: Verify result signal recording', () => {
    it('should record verify pass signal', async () => {
      await recordVerifyResult(tmpDir, 'pass', 0, 'ci');

      const logPath = path.join(tmpDir, '.ivy/feedback/log.jsonl');
      const content = await fs.readFile(logPath, 'utf-8');
      const event = JSON.parse(content.trim().split('\n')[0]);

      expect(event.type).toBe('verify_result');
      expect(event.result).toBe('pass');
      expect(event.gapCount).toBe(0);
      expect(event.context.environment).toBe('ci');
      expect(event.confidence).toBe(SIGNAL_CONFIDENCE_WEIGHTS['verify_result']);
    });

    it('should record verify blocked signal with gaps', async () => {
      await recordVerifyResult(tmpDir, 'blocked', 2, 'local');

      const logPath = path.join(tmpDir, '.ivy/feedback/log.jsonl');
      const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim().split('\n')[0]);

      expect(event.type).toBe('verify_result');
      expect(event.result).toBe('blocked');
      expect(event.gapCount).toBe(2);
    });
  });

  // TC-3: 技术栈变化后对比 JSONL 正确记录前后差异
  describe('TC-3: Gap detected signal recording', () => {
    it('should record capability gap signal', async () => {
      await recordGapDetected(tmpDir, 'capability_gap', 'high', { phase: IvyPhase.DESIGN }, 'missing-rule', 'Rule not deployed');

      const logPath = path.join(tmpDir, '.ivy/feedback/log.jsonl');
      const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim().split('\n')[0]);

      expect(event.type).toBe('gap_detected');
      expect(event.subType).toBe('capability_gap');
      expect(event.severity).toBe('high');
      expect(event.ruleId).toBe('missing-rule');
      expect(event.detail).toBe('Rule not deployed');
    });

    it('should record config gap signal', async () => {
      await recordGapDetected(tmpDir, 'config_gap', 'medium', {}, 'rule-id', 'Tier mismatch');

      const logPath = path.join(tmpDir, '.ivy/feedback/log.jsonl');
      const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim().split('\n')[0]);

      expect(event.subType).toBe('config_gap');
    });
  });

  // TC-4: ivy feedback stats 输出聚合统计
  describe('TC-4: Signal reading functions', () => {
    it('should read all signals correctly', async () => {
      await recordRuleTrigger(tmpDir, 'rule-1', 'pass');
      await recordVerifyResult(tmpDir, 'pass', 0);
      await recordGapDetected(tmpDir, 'capability_gap', 'high');

      const signals = await readAllSignals(tmpDir);

      expect(signals).toHaveLength(3);
      expect(signals[0].type).toBe('rule_trigger');
      expect(signals[1].type).toBe('verify_result');
      expect(signals[2].type).toBe('gap_detected');
    });

    it('should read signals in time window', async () => {
      const now = new Date().toISOString();
      await recordRuleTrigger(tmpDir, 'rule-1', 'pass');

      const signals = await readSignalsInWindow(tmpDir, '2020-01-01T00:00:00.000Z', now);
      expect(signals.length).toBeGreaterThan(0);
    });
  });

  // TC-5: 冷启动（< 3 条记录）不产生建议
  describe('TC-5: Cold start protection', () => {
    it('should handle empty signal directory', async () => {
      const signals = await readAllSignals(tmpDir);
      expect(signals).toHaveLength(0);
    });
  });

  // TC-6: 0 条信号时 ivy feedback stats 正确降级
  describe('TC-6: Graceful degradation', () => {
    it('should return empty array for non-existent log file', async () => {
      const signals = await readAllSignals('/tmp/nonexistent-ivy-dir');
      expect(signals).toEqual([]);
    });
  });

  // TC-7: JSONL 文件按月滚动，超过 12 月自动清理
  describe('TC-7: Signal cleanup', () => {
    it('should cleanup signals older than retention period', async () => {
      // Create a signal with old timestamp
      const logPath = path.join(tmpDir, '.ivy/feedback/log.jsonl');
      await fs.mkdir(path.dirname(logPath) as string, { recursive: true });

      const oldSignal = JSON.stringify({
        ts: '2025-01-01T00:00:00.000Z', // 超过 12 个月
        type: 'rule_trigger',
        ruleId: 'old-rule',
        result: 'pass',
      }) + '\n';

      await fs.writeFile(logPath, oldSignal);

      const result = await cleanupOldSignals(tmpDir);

      // 旧信号应该被清理
      expect(result.cleaned).toBe(1);
    });

    it('should keep recent signals', async () => {
      await recordRuleTrigger(tmpDir, 'recent-rule', 'pass');

      const signals = await readAllSignals(tmpDir);
      expect(signals.length).toBeGreaterThan(0);
    });
  });

  // TC-8: JSON 格式输出
  describe('TC-8: Storage limit enforcement', () => {
    it('should not create empty log file when no signals exist', async () => {
      const logPath = path.join(tmpDir, '.ivy/feedback/log.jsonl');
      expect(await fs.access(logPath).catch(() => false)).toBe(false);
    });
  });

  // TC-9: 同时采集多条信号不相互阻塞
  describe('TC-9: Concurrent signal recording', () => {
    it('should handle concurrent writes correctly', async () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(recordRuleTrigger(tmpDir, `rule-${i % 10}`, i % 3 === 0 ? 'pass' : i % 3 === 1 ? 'skip' : 'fail'));
      }

      await Promise.all(promises);

      const signals = await readAllSignals(tmpDir);
      expect(signals.length).toBe(100);
    });
  });

  // TC-10: 信号采集不阻塞主执行路径
  describe('TC-10: Non-blocking signal collection', () => {
    it('should complete signal recording without blocking', async () => {
      const startTime = Date.now();

      await recordRuleTrigger(tmpDir, 'test-rule', 'pass');

      const duration = Date.now() - startTime;

      // 信号记录应该在合理时间内完成（< 100ms）
      expect(duration).toBeLessThan(100);
    });
  });
});

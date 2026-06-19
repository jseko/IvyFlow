import { describe, it, expect } from 'vitest';
import { assessHealth } from './capability-health.js';

describe('capability-health', () => {
  describe('assessHealth', () => {
    it('TC-26: returns deterministic output (same input → same result)', async () => {
      const r1 = await assessHealth('/tmp/nonexistent-ivy-test');
      const r2 = await assessHealth('/tmp/nonexistent-ivy-test');
      expect(r1.status).toBe(r2.status);
      expect(r1.gaps.length).toBe(r2.gaps.length);
      expect(r1.riskFlags.length).toBe(r2.riskFlags.length);
    });

    it('TC-22: returns status for empty project (gap expected)', async () => {
      const report = await assessHealth('/tmp/nonexistent-ivy-test');
      expect(['healthy', 'warning', 'error']).toContain(report.status);
      expect(typeof report.gaps).toBe('object');
      expect(typeof report.riskFlags).toBe('object');
    });

    it('TC-35: NO overallScore in report', async () => {
      const report = await assessHealth('/tmp/nonexistent-ivy-test');
      const reportObj = report as unknown as Record<string, unknown>;
      expect(reportObj.overallScore).toBeUndefined();
      expect(reportObj.percentage).toBeUndefined();
      expect(reportObj.weighted).toBeUndefined();
    });
  });
});

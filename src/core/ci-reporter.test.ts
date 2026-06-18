import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  runCiCheck,
  formatCliReport,
  formatMarkdownReport,
  formatJsonReport,
} from './ci-reporter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.resolve(__dirname, '..', '..');

describe('ci-reporter', () => {
  it('produces a valid CiReport structure', async () => {
    const report = await runCiCheck(FIXTURE_PATH, 'test-change', 'quick');
    expect(report.change).toBe('test-change');
    expect(report.nonBlocking).toBe(true);
    expect(report.checks.length).toBeGreaterThanOrEqual(1);
    expect(report.mode).toBeDefined();
  });

  it('includes phase check', async () => {
    const report = await runCiCheck(FIXTURE_PATH, 'test-change', 'quick');
    const phase = report.checks.find((c) => c.name === 'Phase');
    expect(phase).toBeDefined();
  });

  it('has summary matching checks count', async () => {
    const report = await runCiCheck(FIXTURE_PATH, 'test-change', 'standard');
    const totalFromChecks = report.checks.length;
    const totalFromSummary = report.summary.passed + report.summary.warning + report.summary.info + report.summary.failed;
    expect(totalFromSummary).toBe(totalFromChecks);
  });

  it('formats CLI output', async () => {
    const report = await runCiCheck(FIXTURE_PATH, 'test-change', 'quick');
    const output = formatCliReport(report);
    expect(output).toContain('IvyFlow Check');
    expect(output).toContain('non-blocking');
  });

  it('formats Markdown output with table', async () => {
    const report = await runCiCheck(FIXTURE_PATH, 'test-change', 'quick');
    const output = formatMarkdownReport(report);
    expect(output).toContain('| Status | Check | Detail |');
    expect(output).toContain('non-blocking');
  });

  it('formats JSON output', async () => {
    const report = await runCiCheck(FIXTURE_PATH, 'test-change', 'quick');
    const output = formatJsonReport(report);
    const parsed = JSON.parse(output);
    expect(parsed.nonBlocking).toBe(true);
    expect(parsed.mode).toBeDefined();
    expect(parsed.checks).toBeInstanceOf(Array);
  });

  it('quick mode does not include stuck check', async () => {
    const report = await runCiCheck(FIXTURE_PATH, 'test-change', 'quick');
    const stuck = report.checks.find((c) => c.name === 'Stuck');
    expect(stuck).toBeUndefined();
  });

  it('standard mode may include stuck and rollback checks', async () => {
    const report = await runCiCheck(FIXTURE_PATH, 'test-change', 'standard');
    // May or may not have stuck/rollback depending on events data
    const checkNames = report.checks.map((c) => c.name);
    expect(checkNames.length).toBeGreaterThanOrEqual(1);
  });
});
